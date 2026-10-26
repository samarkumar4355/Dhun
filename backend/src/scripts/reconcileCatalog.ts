import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase } from '../config/database.js';
import { metadataService } from '../services/metadata.service.js';
import { catalogService } from '../services/catalog.service.js';
import { Track } from '../models/track.model.js';
import { logger } from '../utils/logger.js';

interface ManifestItem {
  fileHash: string;
  fileName: string;
  title: string;
  artist: string;
  driveFolderId?: string;
  driveAudioFileId?: string;
  importedAt?: string;
}

async function reconcile() {
  console.log('🔄 Reconciling local audio files and import manifest with MongoDB...');
  await connectDatabase();

  const manifestPath = path.join(env.localImportFolder, 'import-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Manifest not found at:', manifestPath);
    process.exit(1);
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifestItems: ManifestItem[] = JSON.parse(manifestRaw);
  const manifestMap = new Map<string, ManifestItem>();
  for (const item of manifestItems) {
    manifestMap.set(item.fileHash, item);
  }

  const audioDir = path.join(env.localImportFolder, 'audio');
  const files = fs.readdirSync(audioDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.flac', '.mp3', '.m4a', '.wav'].includes(ext);
  });

  console.log(`Found ${files.length} audio files in ${audioDir}.`);
  let syncedCount = 0;

  for (const file of files) {
    const fullPath = path.join(audioDir, file);
    try {
      const data = await metadataService.extractMetadata(fullPath);
      const manifestEntry = manifestMap.get(data.fileHash);

      const updateFields: any = {
        title: data.title,
        artist: data.artist,
        album: data.album,
        year: data.year,
        genre: data.genre,
        trackNumber: data.trackNumber,
        discNumber: data.discNumber,
        durationSeconds: data.durationSeconds,
        durationMs: data.durationSeconds ? Math.round(data.durationSeconds * 1000) : 0,
        codec: data.codec,
        lossless: data.lossless,
        sampleRate: data.sampleRate,
        bitDepth: data.bitDepth,
        bitrate: data.bitrate,
        numberOfChannels: data.numberOfChannels,
        fileHash: data.fileHash,
        originalFileName: data.originalFileName,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType,
        driveFolderId: manifestEntry?.driveFolderId || '',
        driveAudioFileId: manifestEntry?.driveAudioFileId || '',
        importedAt: manifestEntry?.importedAt ? new Date(manifestEntry.importedAt) : new Date(),
      };

      const updateOps: any = { $set: updateFields };

      if (data.lyricsText && metadataService.isValidLyrics(data.lyricsText)) {
        updateOps.$set.lyrics = data.lyricsText;
        updateOps.$set.hasLyrics = true;
      } else {
        updateOps.$setOnInsert = {
          lyrics: null,
          hasLyrics: false,
        };
      }

      const updatedTrack = await Track.findOneAndUpdate(
        { fileHash: data.fileHash },
        updateOps,
        { upsert: true, new: true }
      );

      if (updatedTrack) {
        await catalogService.linkTrackToCatalog(updatedTrack);
        syncedCount++;
        console.log(`  ✅ Synced & Linked: "${data.title}" by ${data.artist} [${data.codec}]`);
      }
    } catch (err: any) {
      console.error(`  ❌ Failed to process ${file}:`, err.message);
    }
  }

  console.log(`\n🎉 Successfully reconciled ${syncedCount} tracks into MongoDB catalog.`);
  await mongoose.disconnect();
  process.exit(0);
}

reconcile().catch((err) => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
