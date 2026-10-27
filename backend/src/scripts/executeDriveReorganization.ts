import fs from 'node:fs';
import path from 'node:path';
import { googleDriveService } from '../services/googleDrive.service.js';
import { catalogService } from '../services/catalog.service.js';
import { connectDatabase } from '../config/database.js';
import { Track } from '../models/track.model.js';
import { Artist } from '../models/artist.model.js';
import mongoose from 'mongoose';

const ROOT_FOLDER_ID = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';

export async function executeReorganization() {
  console.log(`\n================================================================`);
  console.log(`🚀 DHUN GOOGLE DRIVE LIVE REORGANIZATION`);
  console.log(`================================================================`);
  console.log(`Root Library: "Dhun Music Library" [ID: ${ROOT_FOLDER_ID}]\n`);

  await connectDatabase();
  const drive = await googleDriveService.getClient();

  // Load dry-run report
  const dryRunReportPath = path.resolve(process.cwd(), '../DhunMusicImport/reorganization-dry-run-report.json');
  if (!fs.existsSync(dryRunReportPath)) {
    throw new Error(`Dry-run report not found at ${dryRunReportPath}. Run dry run first.`);
  }
  const dryRun = JSON.parse(fs.readFileSync(dryRunReportPath, 'utf8'));

  // Load local manifests
  const importedManifestPath = path.resolve(process.cwd(), '../DhunMusicImport/imported-tracks-manifest.json');
  const importedManifest: any[] = fs.existsSync(importedManifestPath)
    ? JSON.parse(fs.readFileSync(importedManifestPath, 'utf8'))
    : [];

  const localImportManifestPath = path.resolve(process.cwd(), '../DhunMusicImport/import-manifest.json');
  const localImportManifest: any[] = fs.existsSync(localImportManifestPath)
    ? JSON.parse(fs.readFileSync(localImportManifestPath, 'utf8'))
    : [];

  // 1. Create or retrieve canonical Artist folders directly under root
  console.log(`[Phase 1/3] Resolving canonical artist folders under root...`);
  const artistFolders = new Map<string, string>(); // artistName -> folderId

  for (const item of dryRun.proposedArtistFolders) {
    console.log(` Resolving artist folder for "${item.artistName}"...`);
    const folder = await googleDriveService.findOrCreateArtistFolder(item.artistName, ROOT_FOLDER_ID);
    artistFolders.set(item.artistName, folder.id);
    console.log(`   ✅ "${folder.name}" [ID: ${folder.id}] (Parent: ${ROOT_FOLDER_ID})`);

    // Ensure canonical Artist record in MongoDB stores driveFolderId
    if (mongoose.connection.readyState === 1) {
      await catalogService.findOrCreateArtist(item.artistName, { driveFolderId: folder.id });
    }
  }

  // 2. Process song folders in batches
  console.log(`\n[Phase 2/3] Moving and renaming song folders...`);
  const executionResults: any[] = [];

  for (const item of dryRun.items) {
    console.log(`\n--- Processing #${item.index}: "${item.currentFolderName}" ---`);

    const targetArtistFolderId = artistFolders.get(item.proposedArtistFolderName);
    if (!targetArtistFolderId) {
      throw new Error(`Artist folder ID for "${item.proposedArtistFolderName}" not found.`);
    }

    if (item.folderAction === 'keep_flagged_for_review') {
      console.log(`   Preserving item #${item.index} into artist folder under safe review name...`);
      // Move under artist folder without deleting audio
      await googleDriveService.moveItem(item.currentFolderId, targetArtistFolderId, ROOT_FOLDER_ID);
      await googleDriveService.renameItem(item.currentFolderId, `${item.songTitle} (Duplicate Audio)`);

      executionResults.push({
        index: item.index,
        folderId: item.currentFolderId,
        songTitle: `${item.songTitle} (Duplicate Audio)`,
        primaryArtist: item.proposedArtistFolderName,
        artistFolderId: targetArtistFolderId,
        status: 'preserved_under_artist_for_review',
        reason: item.flagReason,
      });
      continue;
    }

    try {
      // Step A: Move song folder into canonical artist folder
      console.log(`   Moving folder "${item.currentFolderName}" into "${item.proposedArtistFolderName}" (${targetArtistFolderId})...`);
      const movedFolder = await googleDriveService.moveItem(item.currentFolderId, targetArtistFolderId, ROOT_FOLDER_ID);

      // Verify parent post-move
      if (!movedFolder.parents || !movedFolder.parents.includes(targetArtistFolderId)) {
        throw new Error(`Failed to verify parent for moved folder ${item.currentFolderId}`);
      }

      // Step B: Rename song folder to canonical song title
      if (movedFolder.name !== item.proposedSongFolderName) {
        console.log(`   Renaming folder from "${movedFolder.name}" to "${item.proposedSongFolderName}"...`);
        await googleDriveService.renameItem(item.currentFolderId, item.proposedSongFolderName);
      }

      // Step C: Rename artwork if needed (e.g. cover.png -> artwork.png)
      if (item.assets.artwork && item.assets.artwork.needsRename) {
        console.log(`   Renaming artwork from "${item.assets.artwork.name}" to "${item.assets.artwork.targetName}"...`);
        await googleDriveService.renameItem(item.assets.artwork.id, item.assets.artwork.targetName);
      }

      // Step D: Update metadata.json in Google Drive if present
      if (item.assets.metadata) {
        try {
          const raw = await googleDriveService.readFileText(item.assets.metadata.id);
          const meta = JSON.parse(raw);
          meta.title = item.songTitle;
          meta.primaryArtist = item.primaryArtist;
          meta.creditedArtists = item.allCreditedArtists;
          meta.artist = item.allCreditedArtists.join(' & ');
          meta.googleDrive = {
            ...(meta.googleDrive || {}),
            artistFolderId: targetArtistFolderId,
            songFolderId: item.currentFolderId,
            audioFileId: item.assets.audio.id,
            artworkFileId: item.assets.artwork?.id,
            lyricsFileId: item.assets.lyrics?.id,
            metadataFileId: item.assets.metadata.id,
          };
          meta.updatedAt = new Date().toISOString();

          // Upload updated JSON
          await drive.files.update({
            fileId: item.assets.metadata.id,
            requestBody: { name: 'metadata.json' },
            media: {
              mimeType: 'application/json',
              body: JSON.stringify(meta, null, 2),
            },
          });
          console.log(`   ✅ Updated metadata.json [ID: ${item.assets.metadata.id}]`);
        } catch (metaErr: any) {
          console.warn(`   ⚠️ Warning updating metadata.json: ${metaErr.message}`);
        }
      }

      // Step E: Update or insert MongoDB Track record
      if (mongoose.connection.readyState === 1) {
        try {
          const query = item.assets.audio.id !== 'MISSING'
            ? { driveAudioFileId: item.assets.audio.id }
            : { driveFolderId: item.currentFolderId };

          let trackDoc = await Track.findOne(query);
          const manifestMatch = importedManifest.find(
            (m) => m.driveFolderId === item.currentFolderId || (item.assets.audio.id !== 'MISSING' && m.driveAudioFileId === item.assets.audio.id)
          );

          if (trackDoc) {
            trackDoc.title = item.songTitle;
            trackDoc.artist = item.allCreditedArtists.join(' & ');
            trackDoc.driveArtistFolderId = targetArtistFolderId;
            trackDoc.driveFolderId = item.currentFolderId;
            if (item.assets.artwork) trackDoc.driveArtworkFileId = item.assets.artwork.id;
            if (item.assets.lyrics) trackDoc.driveLyricsFileId = item.assets.lyrics.id;
            if (item.assets.metadata) trackDoc.driveMetadataFileId = item.assets.metadata.id;
            await trackDoc.save();
            await catalogService.linkTrackToCatalog(trackDoc);
            console.log(`   ✅ Updated existing MongoDB Track record (ID: ${trackDoc._id})`);
          } else {
            trackDoc = await Track.create({
              title: item.songTitle,
              artist: item.allCreditedArtists.join(' & '),
              album: manifestMatch?.album || 'Unknown Album',
              year: manifestMatch?.year || undefined,
              genre: manifestMatch?.genre ? (Array.isArray(manifestMatch.genre) ? manifestMatch.genre : [manifestMatch.genre]) : [],
              durationSeconds: manifestMatch?.durationSeconds || 0,
              durationMs: manifestMatch?.durationSeconds ? manifestMatch.durationSeconds * 1000 : 0,
              codec: manifestMatch?.codec || 'MPEG 1 Layer 3',
              lossless: manifestMatch?.lossless || false,
              fileHash: manifestMatch?.sha256 || `drive-import-${item.assets.audio.id}`,
              originalFileName: item.assets.audio.name || `${item.songTitle}.mp3`,
              fileSizeBytes: manifestMatch?.fileSizeBytes || 0,
              mimeType: 'audio/mpeg',
              driveArtistFolderId: targetArtistFolderId,
              driveFolderId: item.currentFolderId,
              driveAudioFileId: item.assets.audio.id,
              driveArtworkFileId: item.assets.artwork?.id,
              driveLyricsFileId: item.assets.lyrics?.id,
              driveMetadataFileId: item.assets.metadata?.id,
              hasArtwork: Boolean(item.assets.artwork),
              hasLyrics: Boolean(item.assets.lyrics),
              missingFields: [],
            });
            await catalogService.linkTrackToCatalog(trackDoc);
            console.log(`   ✅ Inserted new MongoDB Track record (ID: ${trackDoc._id})`);
          }
        } catch (dbErr: any) {
          console.warn(`   ⚠️ Warning updating MongoDB: ${dbErr.message}`);
        }
      }

      // Step F: Update local manifests
      for (const m of importedManifest) {
        if (m.driveFolderId === item.currentFolderId || m.driveAudioFileId === item.assets.audio.id) {
          m.title = item.songTitle;
          m.driveArtistFolderId = targetArtistFolderId;
          m.driveFolderId = item.currentFolderId;
        }
      }
      for (const m of localImportManifest) {
        if (m.driveFolderId === item.currentFolderId || m.driveAudioFileId === item.assets.audio.id) {
          m.title = item.songTitle;
          m.driveArtistFolderId = targetArtistFolderId;
          m.driveFolderId = item.currentFolderId;
        }
      }

      executionResults.push({
        index: item.index,
        folderId: item.currentFolderId,
        songTitle: item.songTitle,
        primaryArtist: item.primaryArtist,
        artistFolderId: targetArtistFolderId,
        status: 'success',
      });
      console.log(`   🎉 Successfully reorganized: Dhun Music Library / ${item.proposedArtistFolderName} / ${item.proposedSongFolderName}`);
    } catch (err: any) {
      console.error(`   ❌ Failed processing #${item.index} (${item.currentFolderName}): ${err.message}`);
      executionResults.push({
        index: item.index,
        folderId: item.currentFolderId,
        songTitle: item.songTitle,
        status: 'failed',
        error: err.message,
      });
    }
  }

  // Save updated manifests
  fs.writeFileSync(importedManifestPath, JSON.stringify(importedManifest, null, 2), 'utf8');
  fs.writeFileSync(localImportManifestPath, JSON.stringify(localImportManifest, null, 2), 'utf8');
  console.log(`\nUpdated local manifests with new artist folder IDs.`);

  // 3. Post-execution report
  console.log(`\n================================================================`);
  console.log(`📊 LIVE REORGANIZATION SUMMARY`);
  console.log(`================================================================`);
  const successCount = executionResults.filter((r) => r.status === 'success').length;
  const preservedCount = executionResults.filter((r) => r.status === 'preserved_under_artist_for_review').length;
  const failedCount = executionResults.filter((r) => r.status === 'failed').length;

  console.log(`Total subfolders processed: ${executionResults.length}`);
  console.log(`Successfully moved and renamed: ${successCount}`);
  console.log(`Preserved safely under artist: ${preservedCount}`);
  console.log(`Failures: ${failedCount}`);

  const liveReportPath = path.resolve(process.cwd(), '../DhunMusicImport/live-reorganization-results.json');
  fs.writeFileSync(
    liveReportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        rootFolderId: ROOT_FOLDER_ID,
        artistFolders: Object.fromEntries(artistFolders.entries()),
        results: executionResults,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nFull results saved to: ${liveReportPath}\n`);

  await mongoose.disconnect();
}

// Only execute when invoked directly
if (process.argv.includes('--execute')) {
  executeReorganization().catch((err) => {
    console.error('Live reorganization failed:', err);
    process.exit(1);
  });
}
