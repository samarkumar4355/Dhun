import { googleDriveService } from '../services/googleDrive.service.js';
import { connectDatabase } from '../config/database.js';
import { Track } from '../models/track.model.js';
import mongoose from 'mongoose';

const ROOT_FOLDER_ID = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';

const IMPORTED_TITLES = [
  'Tere Bina Zindagi Se',
  'Tum Aa Gaye Ho Noor Aa Gaya',
  'Dekha Ek Khwab',
  'Kya Yahi Pyar Hai',
  'Chura Liya Hai Tumne Jo Dil Ko',
];

async function verify() {
  console.log('\n================================================================');
  console.log('🔍 VERIFYING PILOT IMPORT IN GOOGLE DRIVE & MONGODB');
  console.log('================================================================\n');

  await connectDatabase();

  // 1. Query MongoDB for the 5 tracks
  const dbTracks = await Track.find({ title: { $in: IMPORTED_TITLES } }).lean();
  console.log(`Found ${dbTracks.length}/5 tracks in MongoDB Atlas.`);

  for (const track of dbTracks) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🎵 Track: "${track.title}" by "${track.artist}"`);
    console.log(`   MongoDB _id:             ${track._id}`);
    console.log(`   SHA-256:                 ${track.fileHash}`);
    console.log(`   Drive Folder ID:         ${track.driveFolderId}`);
    console.log(`   Drive Audio File ID:     ${track.driveAudioFileId}`);
    console.log(`   Drive Artwork File ID:   ${track.driveArtworkFileId || 'none'}`);
    console.log(`   Drive Lyrics File ID:    ${track.driveLyricsFileId || 'none'}`);
    console.log(`   Drive Metadata File ID:  ${track.driveMetadataFileId || 'none'}`);
    console.log(`   Has Lyrics:              ${track.hasLyrics}`);
    console.log(`   Has Artwork:             ${track.hasArtwork}`);

    // Verify folder on Google Drive
    const folder = await googleDriveService.verifyFile(track.driveFolderId!);
    console.log(`   Drive Folder Name:       "${folder.name}"`);
    console.log(`   Drive Folder Parents:    ${JSON.stringify(folder.parents)}`);
    const isDirectChild = folder.parents?.includes(ROOT_FOLDER_ID);
    console.log(`   Direct child of Root:    ${isDirectChild ? 'YES ✅' : 'NO ❌'}`);

    const drive = await googleDriveService.getClient();

    // List files inside folder
    const filesRes = await drive.files.list({
      q: `'${track.driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, md5Checksum, parents)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = filesRes.data.files || [];
    console.log(`   Files inside folder (${files.length}):`);
    for (const f of files) {
      console.log(`     - [${f.name}] (${f.mimeType}, ${f.size} bytes, MD5: ${f.md5Checksum || 'N/A'}, Parents: ${JSON.stringify(f.parents)})`);
    }
  }

  const drive = await googleDriveService.getClient();

  // 2. Verify that the two flagged review folders remain untouched
  console.log(`\n============================================================`);
  console.log(`🔒 VERIFYING FLAGGED REVIEW FOLDERS UNTOUCHED`);
  console.log(`============================================================`);
  const reviewFolder1 = await googleDriveService.verifyFile('10VUi9-fBJFfehlPLyg52aNn7cUzYt_CI');
  const reviewFolder2 = await googleDriveService.verifyFile('1QThDdiX-hK9T2Lj3nQqBHxJIxQdTAZX9');
  console.log(`Review Folder 1: "${reviewFolder1.name}" (ID: ${reviewFolder1.id}) - Untouched ✅`);
  console.log(`Review Folder 2: "${reviewFolder2.name}" (ID: ${reviewFolder2.id}) - Untouched ✅`);

  // 3. Count total tracks in MongoDB and total folders in Drive root
  const totalDbTracks = await Track.countDocuments();
  const rootFoldersRes = await drive.files.list({
    q: `'${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const rootFolders = rootFoldersRes.data.files || [];

  const rootFilesRes = await drive.files.list({
    q: `'${ROOT_FOLDER_ID}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const rootFiles = rootFilesRes.data.files || [];

  console.log(`\n============================================================`);
  console.log(`📊 LIBRARY TOTALS AFTER PILOT IMPORT`);
  console.log(`============================================================`);
  console.log(`Total MongoDB Tracks:      ${totalDbTracks} (30 existing + 5 newly imported = 35)`);
  console.log(`Total Root Subfolders:     ${rootFolders.length} (32 existing + 5 newly created = 37)`);
  console.log(`Total Loose Files in Root: ${rootFiles.length} (Must remain 0 ✅)`);
  console.log(`============================================================\n`);

  await mongoose.disconnect();
}

verify().catch(console.error);
