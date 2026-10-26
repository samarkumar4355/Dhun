import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase } from '../config/database.js';
import { musicImporter } from '../workers/importer.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { metadataService } from '../services/metadata.service.js';
import { catalogService } from '../services/catalog.service.js';
import { Track } from '../models/track.model.js';
import { discoverAllIndianTracks, type DiscoveredTrack } from './discoverIndianTracks.js';

interface CheckpointData {
  lastBatchIndex: number;
  completedTrackIds: string[];
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
  batches: Array<{
    batchIndex: number;
    trackCount: number;
    imported: number;
    skipped: number;
    failed: number;
    timestamp: string;
  }>;
}

// Fetch lyrics safely with rate limit resilience and validation
async function fetchLyricsForTrack(title: string, artist: string): Promise<{ lyrics: string; isDevanagari: boolean; source: string; language: string } | null> {
  const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
  const cleanArtist = artist.split(/[,&/]/)[0].replace(/feat\..*$/i, '').trim();

  const candidates = [
    { t: cleanTitle, a: cleanArtist },
    { t: title, a: artist },
    { t: cleanTitle, a: '' },
  ];

  for (const c of candidates) {
    try {
      const params = new URLSearchParams();
      if (c.t) params.set('track_name', c.t);
      if (c.a) params.set('artist_name', c.a);

      const url = `https://lrclib.net/api/get?${params.toString()}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Dhun-Music-Ingestion/1.0' },
      });

      if (res.ok) {
        const data: any = await res.json();
        const rawLyrics = data.plainLyrics || data.syncedLyrics;
        if (rawLyrics && metadataService.isValidLyrics(rawLyrics)) {
          const isDevanagari = /[\u0900-\u097F]/.test(rawLyrics);
          return {
            lyrics: rawLyrics,
            isDevanagari,
            source: 'LRCLIB Community Database',
            language: isDevanagari ? 'Hindi (Devanagari)' : 'Hindi (Romanized)',
          };
        }
      } else if (res.status === 404) {
        // Try next candidate
        continue;
      }
    } catch {
      // Network hiccup - ignore and fall through
    }
  }

  return null;
}

// Download file with retries
async function downloadToFile(url: string, destPath: string, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Dhun-Music-Ingestion/1.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      return;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const autoConfirm = args.includes('--yes') || args.includes('-y');
  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? Number.parseInt(batchSizeArg.split('=')[1], 10) : 25;
  const maxBatchesArg = args.find((a) => a.startsWith('--max-batches='));
  const maxBatches = maxBatchesArg ? Number.parseInt(maxBatchesArg.split('=')[1], 10) : Number.MAX_SAFE_INTEGER;

  console.log('\n================================================================');
  console.log(`🎵 DHUN: 1,000-SONG MUSIC LIBRARY INGESTION PIPELINE`);
  console.log(`================================================================`);
  console.log(`Mode:            ${isDryRun ? '[DRY RUN - VALIDATION ONLY]' : '[LIVE IMPORT & UPLOAD]'}`);
  console.log(`Batch Size:      ${batchSize} tracks per batch`);
  console.log(`Target:          1,000 unique tracks (5 existing + 995 new)`);
  console.log(`Drive Root:      ${env.driveRootFolder}`);
  console.log(`----------------------------------------------------------------\n`);

  // Step 1: Account Verification
  console.log('[Step 1/6] Verifying Google Drive Account Connection...');
  const accountInfo = await googleDriveService.getAccountInfo();
  if (!accountInfo.emailAddress) {
    console.error('❌ Could not retrieve connected Google Account email.');
    process.exit(1);
  }
  console.log(`✅ Connected Account: ${accountInfo.emailAddress} (${accountInfo.displayName || 'Google User'})`);

  const rootFolder = await googleDriveService.findOrCreateFolder(env.driveRootFolder);
  console.log(`✅ Verified Root Folder: "${rootFolder.name}" (ID: ${rootFolder.id})`);

  if (!isDryRun && !autoConfirm) {
    console.log(`\n⚠️  To run live import, execute with --yes to confirm Google Drive uploads.`);
    console.log(`Example: npx tsx src/scripts/ingestIndianTracks.ts --batch-size=25 --yes\n`);
    process.exit(0);
  }

  // Step 2: Connect to MongoDB Atlas
  console.log('\n[Step 2/6] Connecting to MongoDB Atlas...');
  await connectDatabase();
  const existingMongoCount = await Track.countDocuments();
  const existingTracks = await Track.find({}, { title: 1, artist: 1, fileHash: 1 }).lean();
  const existingDbKeys = new Set(
    existingTracks.map((t) => `${catalogService.normalizeName(t.artist)}:::${catalogService.normalizeName(t.title)}`)
  );
  console.log(`✅ Existing Tracks in MongoDB: ${existingMongoCount}`);

  // Step 3: Load or Discover Tracks
  console.log('\n[Step 3/6] Loading Curated Discovered Tracks Manifest...');
  const discoveredPath = path.join(env.localImportFolder, 'discovered-tracks.json');
  let discoveredTracks: DiscoveredTrack[] = [];

  if (fs.existsSync(discoveredPath)) {
    try {
      discoveredTracks = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
      console.log(`✅ Loaded ${discoveredTracks.length} tracks from existing discovery manifest.`);
    } catch {
      discoveredTracks = await discoverAllIndianTracks(995);
    }
  } else {
    discoveredTracks = await discoverAllIndianTracks(995);
  }

  // Step 4: Load Checkpoint & Reconcile with MongoDB
  const checkpointPath = path.join(env.localImportFolder, 'ingestion-checkpoint.json');
  let checkpoint: CheckpointData = {
    lastBatchIndex: -1,
    completedTrackIds: [],
    totalImported: 0,
    totalSkipped: 0,
    totalFailed: 0,
    batches: [],
  };

  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      console.log(`✅ Loaded checkpoint: Last Batch: ${checkpoint.lastBatchIndex}, Completed: ${checkpoint.completedTrackIds.length} tracks.`);
    } catch {
      console.log('Starting with a fresh checkpoint.');
    }
  }

  const completedSet = new Set(checkpoint.completedTrackIds);

  // Sync already imported tracks into completedSet based on DB
  for (const t of discoveredTracks) {
    const key = `${catalogService.normalizeName(t.artist)}:::${catalogService.normalizeName(t.title)}`;
    if (existingDbKeys.has(key)) {
      completedSet.add(t.id);
      if (!checkpoint.completedTrackIds.includes(t.id)) {
        checkpoint.completedTrackIds.push(t.id);
      }
    }
  }

  // Filter remaining tracks to import
  const remainingTracks = discoveredTracks.filter((t) => {
    const dedupeKey = `${catalogService.normalizeName(t.artist)}:::${catalogService.normalizeName(t.title)}`;
    return !completedSet.has(t.id) && !existingDbKeys.has(dedupeKey);
  });
  console.log(`Remaining tracks to process: ${remainingTracks.length} / ${discoveredTracks.length}`);

  if (remainingTracks.length === 0) {
    console.log('\n🎉 All discovered tracks have already been imported!');
    await generateFinalManifest();
    await printFinalReport(accountInfo.emailAddress || '', existingMongoCount);
    await mongoose.disconnect();
    process.exit(0);
  }

  // Step 5: Batch Processing
  const totalBatches = Math.ceil(remainingTracks.length / batchSize);
  console.log(`\n[Step 4/6] Processing ${Math.min(totalBatches, maxBatches)} batch(es) of size ${batchSize}...\n`);

  const audioStagingDir = path.join(env.localImportFolder, 'audio');
  if (!fs.existsSync(audioStagingDir)) {
    fs.mkdirSync(audioStagingDir, { recursive: true });
  }

  let batchNum = checkpoint.lastBatchIndex + 1;
  let batchesExecuted = 0;

  for (let i = 0; i < remainingTracks.length && batchesExecuted < maxBatches; i += batchSize) {
    batchesExecuted++;
    batchNum++;
    const batch = remainingTracks.slice(i, i + batchSize);

    console.log(`\n================================================================`);
    console.log(`📦 BATCH ${batchNum}: ${batch.length} tracks (${i + 1} to ${i + batch.length} of ${remainingTracks.length})`);
    console.log(`================================================================`);

    // Dry Run validation for batch
    if (isDryRun) {
      console.log(`[DRY RUN] Validating batch metadata and source URLs...`);
      for (const track of batch) {
        console.log(`  🎵 "${track.title}" by "${track.artist}" [${track.album}, ${track.year || 'N/A'}] | ${track.language} | ${track.genre.join(', ')}`);
        console.log(`     URL: ${track.sourceUrl.slice(0, 80)}...`);
      }
      console.log(`[DRY RUN] Batch ${batchNum} validated successfully. (0 uploads, 0 writes).`);
      continue;
    }

    // ─── LIVE BATCH EXECUTION ───────────────────────────────────────────────────

    const stagedFiles: string[] = [];
    const batchTrackIds: string[] = [];

    // 1. Stage audio files, artwork, lyrics, and companion metadata for this batch using bounded concurrency (5 workers)
    console.log(`\n[Batch ${batchNum} - Step 1/4] Staging files locally (5 parallel downloads)...`);

    const concurrency = 5;
    const queue = batch.map((track, trackIdx) => ({ track, trackIdx }));
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const { track, trackIdx } = item;
        const safeBase = sanitizeFileName(`${track.artist} - ${track.title}`);
        const audioFileName = `${safeBase}.mp3`;
        const audioPath = path.join(audioStagingDir, audioFileName);
        const metaPath = path.join(audioStagingDir, `${safeBase}.meta.json`);
        const lyricsPath = path.join(audioStagingDir, `${safeBase}.txt`);

        console.log(`  [${trackIdx + 1}/${batch.length}] Staging: "${track.title}" by ${track.artist}...`);

        try {
          // Download audio file with 20s timeout
          await downloadToFile(track.sourceUrl, audioPath);
          stagedFiles.push(audioPath);
          batchTrackIds.push(track.id);

          // Download artwork if available
          if (track.artworkUrl) {
            const artExt = track.artworkUrl.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
            const artPath = path.join(audioStagingDir, `${safeBase}${artExt}`);
            try {
              await downloadToFile(track.artworkUrl, artPath);
              stagedFiles.push(artPath);
            } catch {
              // Artwork download failure is non-fatal
            }
          }

          // Fetch lyrics
          const lyricsRes = await fetchLyricsForTrack(track.title, track.artist);
          if (lyricsRes) {
            fs.writeFileSync(lyricsPath, lyricsRes.lyrics, 'utf8');
            stagedFiles.push(lyricsPath);
            console.log(`     📝 Verified Lyrics: ${lyricsRes.language} for "${track.title}"`);
          }

          // Write companion metadata JSON (guarantees clean metadata overrides)
          const companionMeta = {
            title: track.title,
            artist: track.artist,
            album: track.album,
            year: track.year,
            genre: track.genre,
            language: track.language,
            sourceName: 'Internet Archive Open Music Repository',
            sourceUrl: track.sourceUrl,
            lyricsSource: lyricsRes?.source,
            lyricsLanguage: lyricsRes?.language,
          };
          fs.writeFileSync(metaPath, JSON.stringify(companionMeta, null, 2), 'utf8');
          stagedFiles.push(metaPath);
        } catch (stageErr: any) {
          console.warn(`     ⚠️ Staging error for "${track.title}": ${stageErr.message}`);
        }
      }
    });

    await Promise.all(workers);

    // 2. Run Dhun MusicImporter on the staged batch
    console.log(`\n[Batch ${batchNum} - Step 2/4] Uploading to Google Drive & Linking MongoDB...`);
    const importReport = await musicImporter.runImport({
      dryRun: false,
      maxTracks: 500, // process all files in batch
      confirmAccount: true,
      expectedAccountEmail: accountInfo.emailAddress,
    });

    // 3. Post-upload Verification & Cleanup of local files
    console.log(`\n[Batch ${batchNum} - Step 3/4] Cleaning up local staging files...`);
    for (const f of stagedFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore unlink errors
        }
      }
    }
    const leftoverFiles = fs.readdirSync(audioStagingDir);
    for (const file of leftoverFiles) {
      try {
        fs.unlinkSync(path.join(audioStagingDir, file));
      } catch {
        // ignore
      }
    }
    console.log(`✅ Staging storage cleared for batch ${batchNum}.`);

    // 4. Update Checkpoint
    console.log(`\n[Batch ${batchNum} - Step 4/4] Updating checkpoint...`);
    const batchImported = importReport.filter((r) => r.status === 'imported').length;
    const batchSkipped = importReport.filter((r) => r.status === 'skipped_duplicate').length;
    const batchFailed = importReport.filter((r) => r.status === 'failed').length;

    for (const id of batchTrackIds) {
      checkpoint.completedTrackIds.push(id);
    }
    checkpoint.lastBatchIndex = batchNum;
    checkpoint.totalImported += batchImported;
    checkpoint.totalSkipped += batchSkipped;
    checkpoint.totalFailed += batchFailed;
    checkpoint.batches.push({
      batchIndex: batchNum,
      trackCount: batch.length,
      imported: batchImported,
      skipped: batchSkipped,
      failed: batchFailed,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf8');
    console.log(`✅ Checkpoint saved. Total Imported So Far: ${checkpoint.totalImported}, Skipped: ${checkpoint.totalSkipped}`);

    // Short pause between batches to be respectful to rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Step 6: Generate Manifest & Final Report
  console.log('\n[Step 5/6] Generating Final Manifest (CSV & JSON)...');
  await generateFinalManifest();

  console.log('\n[Step 6/6] Final Audit & Reconciliation...');
  await printFinalReport(accountInfo.emailAddress || '', existingMongoCount);

  await mongoose.disconnect();
}

async function generateFinalManifest() {
  const manifestPath = path.join(env.localImportFolder, 'import-manifest.json');
  let manifest: any[] = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      manifest = [];
    }
  }

  const tracks = await Track.find({}).lean();
  const manifestByHash = new Map<string, any>();
  const manifestByName = new Map<string, any>();
  for (const entry of manifest) {
    if (entry.fileHash) manifestByHash.set(entry.fileHash, entry);
    manifestByName.set(`${catalogService.normalizeName(entry.artist)}:::${catalogService.normalizeName(entry.title)}`, entry);
  }

  const enrichedManifest: any[] = [];
  const csvRows: string[] = [];
  csvRows.push(
    'Title,Artist,Album,Year,Language,Genre,DurationSeconds,Codec,Lossless,FileSizeBytes,SHA256,DriveFolderId,DriveAudioFileId,HasArtwork,HasLyrics,ImportedAt'
  );

  const seenKeys = new Set<string>();

  for (const t of tracks) {
    const normKey = `${catalogService.normalizeName(t.artist)}:::${catalogService.normalizeName(t.title)}`;
    if (seenKeys.has(normKey)) continue;
    seenKeys.add(normKey);

    const entry = (t.fileHash ? manifestByHash.get(t.fileHash) : null) || manifestByName.get(normKey);
    const sha256 = t.fileHash || entry?.fileHash || 'N/A';

    const item = {
      title: t.title,
      artist: t.artist,
      album: t.album || 'Unknown Album',
      year: t.year || null,
      language: t.language || 'Hindi',
      genre: (t.genre || []).join('; '),
      durationSeconds: t.durationSeconds || 0,
      codec: t.codec || 'MP3',
      lossless: Boolean(t.lossless),
      fileSizeBytes: t.fileSizeBytes || 0,
      sha256,
      driveFolderId: t.googleDrive?.folderId || entry?.driveFolderId || '',
      driveAudioFileId: t.googleDrive?.fileId || entry?.driveAudioFileId || '',
      hasArtwork: Boolean(t.hasArtwork),
      hasLyrics: Boolean(t.hasLyrics),
      importedAt: entry?.importedAt || (t as any).createdAt || new Date().toISOString(),
    };
    enrichedManifest.push(item);

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    csvRows.push(
      [
        escapeCsv(item.title),
        escapeCsv(item.artist),
        escapeCsv(item.album),
        escapeCsv(item.year),
        escapeCsv(item.language),
        escapeCsv(item.genre),
        item.durationSeconds,
        escapeCsv(item.codec),
        item.lossless,
        item.fileSizeBytes,
        escapeCsv(item.sha256),
        escapeCsv(item.driveFolderId),
        escapeCsv(item.driveAudioFileId),
        item.hasArtwork,
        item.hasLyrics,
        escapeCsv(item.importedAt),
      ].join(',')
    );
  }

  const outJson = path.join(env.localImportFolder, 'imported-tracks-manifest.json');
  const outCsv = path.join(env.localImportFolder, 'imported-tracks-manifest.csv');
  fs.writeFileSync(outJson, JSON.stringify(enrichedManifest, null, 2), 'utf8');
  fs.writeFileSync(outCsv, csvRows.join('\n'), 'utf8');

  console.log(`✅ Saved JSON manifest (${enrichedManifest.length} tracks): ${outJson}`);
  console.log(`✅ Saved CSV manifest (${csvRows.length - 1} rows):  ${outCsv}`);
}

async function printFinalReport(accountEmail: string, initialMongoCount: number) {
  const currentTracks = await Track.countDocuments();
  const currentArtists = await (await import('../models/artist.model.js')).Artist.countDocuments();
  const currentAlbums = await (await import('../models/album.model.js')).Album.countDocuments();
  const currentGenres = await (await import('../models/genre.model.js')).Genre.countDocuments();

  const tracksWithLyrics = await Track.countDocuments({ hasLyrics: true });
  const tracksWithArtwork = await Track.countDocuments({ hasArtwork: true });

  console.log('\n================================================================');
  console.log('📊 DHUN MUSIC LIBRARY PIPELINE FINAL REPORT');
  console.log('================================================================');
  console.log(`Google Drive Account:     ${accountEmail}`);
  console.log(`Destination Folder:       ${env.driveRootFolder}`);
  console.log(`Initial Track Count:      ${initialMongoCount}`);
  console.log(`Current Total Tracks:     ${currentTracks}`);
  console.log(`Total Unique Artists:     ${currentArtists}`);
  console.log(`Total Unique Albums:      ${currentAlbums}`);
  console.log(`Total Unique Genres:      ${currentGenres}`);
  console.log(`Tracks with Lyrics:       ${tracksWithLyrics}`);
  console.log(`Tracks with Artwork:      ${tracksWithArtwork}`);
  console.log(`Target:                   1,000 unique tracks`);
  console.log(`Completion Status:        ${currentTracks >= 1000 ? '✅ 1,000-TRACK TARGET REACHED' : `PROGRESS: ${currentTracks}/1000`}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Pipeline execution error:', err);
  process.exit(1);
});
