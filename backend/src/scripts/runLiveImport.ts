import readline from 'node:readline';
import { musicImporter } from '../workers/importer.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { connectDatabase } from '../config/database.js';
import mongoose from 'mongoose';

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
}

async function executeLiveImport() {
  console.log(`\n================================================================`);
  console.log(`🚀 Dhun Music Importer - LIVE IMPORT`);
  console.log(`================================================================`);
  console.log(`Limit: Up to 10 authorized tracks`);
  console.log(`Integrity: Preserving original audio bytes, verifying all uploads.`);
  console.log(`----------------------------------------------------------------`);

  // Step 1: Verify Google Account via about.get
  console.log(`[Step 1/3] Verifying connected Google Drive account...`);
  const accountInfo = await googleDriveService.getAccountInfo();

  if (!accountInfo.emailAddress) {
    console.error(`\n❌ [Account Verification Error]: Could not verify connected Google Account email.`);
    process.exit(1);
  }

  console.log(`Connected Google Account: ${accountInfo.emailAddress} (${accountInfo.displayName || 'Google User'})`);
  console.log(`----------------------------------------------------------------`);

  // Step 2: Require explicit user confirmation before any live upload or folder creation
  const hasAutoConfirmFlag = process.argv.includes('--yes') || process.argv.includes('-y');
  let confirmed = hasAutoConfirmFlag;

  if (!confirmed) {
    confirmed = await askConfirmation(
      `⚠️  Are you sure you want to upload tracks to Google Drive account [${accountInfo.emailAddress}]? (yes/no): `
    );
  }

  if (!confirmed) {
    console.log(`\n🛑 Live import cancelled. Zero files were uploaded to Google Drive.\n`);
    process.exit(0);
  }

  console.log(`\n[Step 2/3] Confirmation received. Connecting to MongoDB Atlas (if configured)...`);
  await connectDatabase();

  console.log(`\n[Step 3/3] Running live import...`);
  const report = await musicImporter.runImport({
    dryRun: false,
    maxTracks: 10,
    confirmAccount: true,
    expectedAccountEmail: accountInfo.emailAddress,
  });

  console.log(`\n================================================================`);
  console.log(`🎉 Live Import Summary Report`);
  console.log(`================================================================`);

  const imported = report.filter((r) => r.status === 'imported');
  const skipped = report.filter((r) => r.status === 'skipped_duplicate');
  const failed = report.filter((r) => r.status === 'failed');

  console.log(`Total processed:       ${report.length} track(s)`);
  console.log(`Successfully imported: ${imported.length}`);
  console.log(`Duplicates skipped:    ${skipped.length}`);
  console.log(`Failed:                ${failed.length}`);
  console.log(`----------------------------------------------------------------`);

  for (let i = 0; i < report.length; i++) {
    const item = report[i];
    const icon = item.status === 'imported' ? '✅' : item.status === 'skipped_duplicate' ? '⏭️' : '❌';
    console.log(`[${i + 1}] ${icon} ${item.fileName}`);
    console.log(`    Title:           ${item.title}`);
    console.log(`    Artist:          ${item.artist}`);
    console.log(`    Format:          ${item.codec} (${item.lossless ? 'Lossless' : 'Lossy'})`);
    if (item.driveFolderId) {
      console.log(`    Drive Folder ID: ${item.driveFolderId}`);
    }
    if (item.driveAudioFileId) {
      console.log(`    Drive Audio ID:  ${item.driveAudioFileId}`);
    }
    if (item.error) {
      console.log(`    Error:           ${item.error}`);
    }
  }

  console.log(`================================================================\n`);

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  process.exit(0);
}

executeLiveImport().catch((err) => {
  console.error(`Live import execution failed: ${err.message}`);
  process.exit(1);
});
