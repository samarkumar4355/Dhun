import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase } from '../config/database.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { metadataService, type ExtractedTrackData } from '../services/metadata.service.js';
import { catalogService } from '../services/catalog.service.js';
import { Track } from '../models/track.model.js';

interface PilotTrackConfig {
  fileName: string;
  canonicalTitle: string;
  assignedSinger: string;
  featuredArtists: string[];
  album: string;
  year: number;
  language: string;
  genre: string[];
}

const PILOT_TRACKS: PilotTrackConfig[] = [
  {
    fileName: 'Kishore Kumar & Lata Mangeshkar - Tere bina zindagi se shikhwa.mp3',
    canonicalTitle: 'Tere Bina Zindagi Se',
    assignedSinger: 'Kishore Kumar',
    featuredArtists: ['Lata Mangeshkar'],
    album: 'Aandhi',
    year: 1975,
    language: 'Hindi',
    genre: ['Bollywood', 'Classic-Ghazal'],
  },
  {
    fileName: 'Kishore Kumar & Lata Mangeshkar - Tum Aa Gaye Ho.mp3',
    canonicalTitle: 'Tum Aa Gaye Ho Noor Aa Gaya',
    assignedSinger: 'Kishore Kumar',
    featuredArtists: ['Lata Mangeshkar'],
    album: 'Aandhi',
    year: 1975,
    language: 'Hindi',
    genre: ['Bollywood', 'Classic-Romantic'],
  },
  {
    fileName: 'Kishore Kumar & Lata Mangeshkar - Dekha Ek Khwab To.mp3',
    canonicalTitle: 'Dekha Ek Khwab',
    assignedSinger: 'Kishore Kumar',
    featuredArtists: ['Lata Mangeshkar'],
    album: 'Silsila',
    year: 1981,
    language: 'Hindi',
    genre: ['Bollywood', 'Classic-Romance'],
  },
  {
    fileName: 'Kishore Kumar & Lata Mangeshkar - Kya Yahi Pyar Hai.mp3',
    canonicalTitle: 'Kya Yahi Pyar Hai',
    assignedSinger: 'Kishore Kumar',
    featuredArtists: ['Lata Mangeshkar'],
    album: 'Rocky',
    year: 1981,
    language: 'Hindi',
    genre: ['Bollywood', 'Classic-Romance'],
  },
  {
    fileName: 'Mohammed Rafi & Asha Bhosle - Chura liya hai tum ne.mp3',
    canonicalTitle: 'Chura Liya Hai Tumne Jo Dil Ko',
    assignedSinger: 'Mohammed Rafi',
    featuredArtists: ['Asha Bhosle'],
    album: 'Yaadon Ki Baaraat',
    year: 1973,
    language: 'Hindi',
    genre: ['Bollywood', 'Classic-Romantic'],
  },
];

async function runPilotImport() {
  console.log('\n================================================================');
  console.log('🚀 DHUN BATCH A — 5-SONG PILOT IMPORT & DRIVE VERIFICATION');
  console.log('================================================================\n');

  await connectDatabase();

  // 1. Verify Google Drive account
  console.log('1. Verifying Google Account Connection...');
  const accountInfo = await googleDriveService.getAccountInfo();
  console.log(`   Connected Account: ${accountInfo.emailAddress} (${accountInfo.displayName || 'Google User'})`);

  const rootFolderId = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';
  console.log(`   Target Root: Dhun Music Library (ID: ${rootFolderId})\n`);

  const projectRoot = fs.existsSync(path.resolve('batch-copilot.json'))
    ? path.resolve('.')
    : path.resolve('..');
  const audioDir = path.join(projectRoot, 'DhunMusicImport/audio');

  const results: any[] = [];

  for (let i = 0; i < PILOT_TRACKS.length; i++) {
    const config = PILOT_TRACKS[i];
    console.log(`----------------------------------------------------------------`);
    console.log(`[Track ${i + 1}/5] Processing: ${config.assignedSinger} — ${config.canonicalTitle}`);
    console.log(`----------------------------------------------------------------`);

    const filePath = path.join(audioDir, config.fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`);
    }

    // A. Extract metadata and calculate SHA-256
    const extracted: ExtractedTrackData = await metadataService.extractMetadata(filePath);
    extracted.title = config.canonicalTitle;
    extracted.artist = `${config.assignedSinger} feat. ${config.featuredArtists.join(', ')}`;
    extracted.album = config.album;
    extracted.year = config.year;
    extracted.genre = config.genre;
    extracted.language = config.language;

    console.log(`   File: ${config.fileName} (${extracted.fileSizeBytes} bytes, SHA-256: ${extracted.fileHash.slice(0, 16)}...)`);

    // B. Target dedicated folder directly under Dhun Music Library
    const folderName = `${config.canonicalTitle} - ${config.assignedSinger}`;
    console.log(`   Song Folder: "${folderName}"`);

    let songFolder = await googleDriveService.findFolderByName(folderName, rootFolderId);
    if (!songFolder) {
      console.log(`   Creating folder "${folderName}" inside Dhun Music Library...`);
      songFolder = await googleDriveService.createFolder(folderName, rootFolderId);
    } else {
      console.log(`   Found existing folder: ${songFolder.id}`);
    }

    const songFolderId = songFolder.id;
    console.log(`   Song Folder ID: ${songFolderId}`);

    // C. Upload / verify Audio File
    console.log(`   Uploading/verifying audio file...`);
    const audioExt = path.extname(filePath);
    const audioUpload = await googleDriveService.uploadFile({
      filePath,
      fileName: `audio${audioExt}`,
      mimeType: extracted.mimeType,
      parentFolderId: songFolderId,
    });
    console.log(`   ✅ Audio File ID: ${audioUpload.id} (Size: ${audioUpload.size} bytes)`);

    // D. Upload Artwork (artwork.jpg / artwork.png)
    let artworkUploadId: string | undefined;
    const companionPng = filePath.replace('.mp3', '.png');
    const companionJpg = filePath.replace('.mp3', '.jpg');
    let artSourcePath: string | null = null;
    if (fs.existsSync(companionPng)) artSourcePath = companionPng;
    else if (fs.existsSync(companionJpg)) artSourcePath = companionJpg;

    if (artSourcePath) {
      const artExt = path.extname(artSourcePath);
      const artUpload = await googleDriveService.uploadFile({
        filePath: artSourcePath,
        fileName: `artwork${artExt}`,
        mimeType: artExt === '.png' ? 'image/png' : 'image/jpeg',
        parentFolderId: songFolderId,
      });
      artworkUploadId = artUpload.id;
      console.log(`   ✅ Artwork File ID: ${artworkUploadId}`);
    }

    // E. Upload Lyrics (lyrics.txt)
    let lyricsUploadId: string | undefined;
    const companionTxt = filePath.replace('.mp3', '.txt');
    if (fs.existsSync(companionTxt)) {
      const txtContent = fs.readFileSync(companionTxt, 'utf8');
      if (metadataService.isValidLyrics(txtContent)) {
        extracted.lyricsText = txtContent;
        const lyricsUpload = await googleDriveService.uploadFile({
          filePath: companionTxt,
          fileName: 'lyrics.txt',
          mimeType: 'text/plain',
          parentFolderId: songFolderId,
        });
        lyricsUploadId = lyricsUpload.id;
        console.log(`   ✅ Lyrics File ID: ${lyricsUploadId}`);
      }
    }

    // F. Generate and upload metadata.json
    const metadataPayload = {
      title: config.canonicalTitle,
      artist: extracted.artist,
      assignedSinger: config.assignedSinger,
      featuredArtists: config.featuredArtists,
      album: config.album,
      year: config.year,
      language: config.language,
      genre: config.genre,
      durationSeconds: extracted.durationSeconds,
      codec: extracted.codec,
      lossless: extracted.lossless,
      bitrate: extracted.bitrate,
      sampleRate: extracted.sampleRate,
      fileSizeBytes: extracted.fileSizeBytes,
      fileHash: extracted.fileHash,
      importedAt: new Date().toISOString(),
    };

    const metaUpload = await googleDriveService.uploadJson({
      data: metadataPayload,
      fileName: 'metadata.json',
      parentFolderId: songFolderId,
    });
    console.log(`   ✅ Metadata File ID: ${metaUpload.id}`);

    // G. Verify all uploaded items in Drive
    await googleDriveService.verifyFile(audioUpload.id);
    if (artworkUploadId) await googleDriveService.verifyFile(artworkUploadId);
    if (lyricsUploadId) await googleDriveService.verifyFile(lyricsUploadId);
    await googleDriveService.verifyFile(metaUpload.id);

    // H. Upsert into MongoDB
    const mongoUpdate = {
      title: config.canonicalTitle,
      artist: extracted.artist,
      album: config.album,
      year: config.year,
      genre: config.genre,
      durationSeconds: extracted.durationSeconds,
      durationMs: extracted.durationSeconds ? Math.round(extracted.durationSeconds * 1000) : 0,
      language: config.language,
      codec: extracted.codec,
      lossless: extracted.lossless,
      sampleRate: extracted.sampleRate,
      bitrate: extracted.bitrate,
      numberOfChannels: extracted.numberOfChannels,
      fileHash: extracted.fileHash,
      originalFileName: config.fileName,
      fileSizeBytes: extracted.fileSizeBytes,
      mimeType: extracted.mimeType,
      driveFolderId: songFolderId,
      driveAudioFileId: audioUpload.id,
      driveArtworkFileId: artworkUploadId,
      driveLyricsFileId: lyricsUploadId,
      driveMetadataFileId: metaUpload.id,
      hasArtwork: Boolean(artworkUploadId),
      hasLyrics: Boolean(lyricsUploadId),
      lyrics: extracted.lyricsText || null,
      importedAt: new Date(),
    };

    const savedDoc = await Track.findOneAndUpdate(
      { fileHash: extracted.fileHash },
      { $set: mongoUpdate },
      { upsert: true, new: true }
    );

    if (savedDoc) {
      await catalogService.linkTrackToCatalog(savedDoc);
      console.log(`   ✅ MongoDB Record Upserted: ID ${savedDoc._id}`);
    }

    results.push({
      canonicalTitle: config.canonicalTitle,
      assignedSinger: config.assignedSinger,
      folderName,
      folderId: songFolderId,
      audioFileId: audioUpload.id,
      artworkFileId: artworkUploadId,
      lyricsFileId: lyricsUploadId,
      metadataFileId: metaUpload.id,
      mongoId: savedDoc?._id.toString(),
      sha256: extracted.fileHash,
    });
  }

  // Update batch-antigravity.json
  const manifestPath = path.join(projectRoot, 'batch-antigravity.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const r of results) {
      const match = manifest.tracks.find((t: any) =>
        t.assignedSinger === r.assignedSinger && t.title === r.canonicalTitle
      );
      if (match) {
        match.status = 'imported_verified';
        match.driveFolderId = r.folderId;
        match.driveAudioFileId = r.audioFileId;
        match.driveArtworkFileId = r.artworkFileId;
        match.driveLyricsFileId = r.lyricsFileId;
        match.driveMetadataFileId = r.metadataFileId;
        match.mongoId = r.mongoId;
        match.importedAt = new Date().toISOString();
      }
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\n✅ Updated batch-antigravity.json with 5 imported_verified tracks.`);
  }

  console.log('\n================================================================');
  console.log('🎉 5-SONG PILOT IMPORT COMPLETED SUCCESSFULLY');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      Song: `${r.canonicalTitle} (${r.assignedSinger})`,
      Folder: r.folderName,
      DriveFolderId: r.folderId,
      AudioId: r.audioFileId,
      Art: r.artworkFileId ? 'YES' : 'NO',
      Lyrics: r.lyricsFileId ? 'YES' : 'NO',
      MongoSynced: r.mongoId ? 'YES' : 'NO',
    }))
  );

  await mongoose.disconnect();
}

runPilotImport().catch(console.error);
