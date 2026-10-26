import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';

async function runConnectionTest() {
  console.log(`\n================================================================`);
  console.log(`🚀 Starting Dhun Google Drive Connection Test`);
  console.log(`================================================================`);
  console.log(`Credentials Path: ${env.credentialsPath}`);
  console.log(`Token Path:       ${env.tokenPath}`);
  console.log(`----------------------------------------------------------------`);

  try {
    // Step 1: Initialize client and perform OAuth authorization if needed
    console.log(`\n[Step 1/3] Connecting to Google Drive API...`);
    const driveClient = await googleDriveService.getClient();
    console.log(`[Step 1/3] Connected to Google Drive API successfully.`);

    // Step 2: Create the test folder named "Dhun Connection Test"
    console.log(`\n[Step 2/3] Creating test folder: "Dhun Connection Test"...`);
    const testFolder = await googleDriveService.createTestFolder();
    console.log(`[Step 2/3] Folder created/retrieved with ID: ${testFolder.id}`);

    // Step 3: Verify the folder exists and is active on Google Drive
    console.log(`\n[Step 3/3] Verifying folder on Google Drive...`);
    const verifiedFolder = await googleDriveService.verifyFolder(testFolder.id);

    console.log(`\n================================================================`);
    console.log(`🎉 Google Drive Connection Test Succeeded!`);
    console.log(`================================================================`);
    console.log(`Folder Name:         ${verifiedFolder.name}`);
    console.log(`Google Drive ID:     ${verifiedFolder.id}`);
    console.log(`Active / Not Trashed: ${!verifiedFolder.trashed ? 'Yes (Verified)' : 'No'}`);
    if (verifiedFolder.webViewLink) {
      console.log(`Google Drive Link:   ${verifiedFolder.webViewLink}`);
    }
    console.log(`----------------------------------------------------------------`);
    console.log(`Note: As requested, no songs or files were uploaded.`);
    console.log(`Phase 2 is verified and ready for Phase 3 importer execution.`);
    console.log(`================================================================\n`);

    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ [Connection Test Failed]:`);
    console.error(error.message);
    console.error(`\nPlease check your credentials file or network connection and retry.\n`);
    process.exit(1);
  }
}

runConnectionTest();
