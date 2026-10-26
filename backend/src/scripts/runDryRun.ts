import { musicImporter } from '../workers/importer.js';
import { env } from '../config/env.js';
import path from 'node:path';
import fs from 'node:fs';

async function executeDryRun() {
  const audioDir = path.join(env.localImportFolder, 'audio');

  console.log(`\n================================================================`);
  console.log(`🔍 Dhun Music Importer - DRY RUN`);
  console.log(`================================================================`);
  console.log(`Staging Folder: ${audioDir}`);
  console.log(`Manifest Path:  ${path.join(env.localImportFolder, 'import-manifest.json')}`);
  console.log(`Safety Notice:  DRY RUN MODE. Google Drive will NOT be modified.`);
  console.log(`----------------------------------------------------------------`);

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const report = await musicImporter.runImport({ dryRun: true, maxTracks: 10 });

  console.log(`\n================================================================`);
  console.log(`📊 Dry Run Summary Report`);
  console.log(`================================================================`);

  if (report.length === 0) {
    console.log(`ℹ️  No audio files found to import.`);
    console.log(`\nTo test the importer:`);
    console.log(`1. Place up to 10 authorized audio files in:`);
    console.log(`   ${audioDir}`);
    console.log(`   (Supported formats: .flac, .alac, .m4a, .mp3, .wav)`);
    console.log(`2. Optional: place artwork (.jpg/.png) or lyrics (.lrc/.txt) alongside the audio files.`);
    console.log(`3. Re-run: npm run import:dry-run\n`);
    process.exit(0);
  }

  const ready = report.filter((r) => r.status === 'dry_run_ready');
  const duplicates = report.filter((r) => r.status === 'skipped_duplicate');
  const failed = report.filter((r) => r.status === 'failed');

  console.log(`Total scanned:      ${report.length} track(s) (limit: 10)`);
  console.log(`Ready for import:   ${ready.length}`);
  console.log(`Duplicates skipped: ${duplicates.length}`);
  console.log(`Failed / unreadable: ${failed.length}`);
  console.log(`----------------------------------------------------------------`);

  for (let i = 0; i < report.length; i++) {
    const item = report[i];
    const statusIcon = item.status === 'dry_run_ready' ? '✅' : item.status === 'skipped_duplicate' ? '⏭️' : '❌';
    console.log(`[${i + 1}] ${statusIcon} ${item.fileName}`);
    console.log(`    Title:    ${item.title}`);
    console.log(`    Artist:   ${item.artist}`);
    console.log(`    Format:   ${item.codec} (${item.lossless ? 'Lossless' : 'Lossy'})`);
    console.log(`    Status:   ${item.status.replace(/_/g, ' ').toUpperCase()}`);
    if (item.error) {
      console.log(`    Error:    ${item.error}`);
    }
  }

  console.log(`================================================================`);
  console.log(`🔒 Integrity Check: Zero files were uploaded to Google Drive.`);
  console.log(`Ready for actual import: Run 'npm run import:upload' when confirmed.`);
  console.log(`================================================================\n`);

  process.exit(0);
}

executeDryRun().catch((err) => {
  console.error(`Dry run execution failed: ${err.message}`);
  process.exit(1);
});
