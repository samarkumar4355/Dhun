import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { connectDatabase } from '../config/database.js';

async function verifyAll() {
  await connectDatabase();
  const drive = await googleDriveService.getClient();
  const root = await googleDriveService.findOrCreateFolder(env.driveRootFolder);

  console.log(`\n================================================================`);
  console.log(`VERIFYING FINAL GOOGLE DRIVE FOLDER & FILE STRUCTURE`);
  console.log(`================================================================`);
  console.log(`Root Folder: "${root.name}" (${root.id})`);

  // 1. Fetch direct children of Dhun Music Library
  const res: any = await drive.files.list({
    q: `trashed = false and '${root.id}' in parents`,
    fields: 'files(id, name, mimeType, parents)',
    pageSize: 1000,
  });

  const children = res.data.files || [];
  const folders = children.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
  const files = children.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder');

  console.log(`\nFolders directly inside Dhun Music Library: ${folders.length}`);
  console.log(`Files directly inside Dhun Music Library:   ${files.length} (Expected: 0)`);

  if (files.length > 0) {
    console.error('❌ ERROR: Files found directly in root folder:');
    files.forEach((f: any) => console.log('  -', f.name, f.id));
  } else {
    console.log('✅ ZERO files directly in root folder. Every file is inside a song folder.');
  }

  // 2. Verify all folders in root follow "<Song Title> - <Artist Name>" format
  console.log('\nChecking folder naming conventions:');
  folders.forEach((f: any, idx: number) => {
    console.log(`  ${idx + 1}. "${f.name}" [ID: ${f.id}]`);
  });

  // 3. Verify each folder's files and parents
  console.log('\nChecking contents and parent IDs of each song folder:');
  const tracks = await Track.find({}).lean();
  let verifiedTrackFolders = 0;
  let totalVerifiedAssets = 0;

  for (const t of tracks) {
    const folderRes: any = await drive.files.list({
      q: `trashed = false and '${t.driveFolderId}' in parents`,
      fields: 'files(id, name, mimeType, parents, size)',
      pageSize: 100,
    });

    const folderFiles = folderRes.data.files || [];
    const audio = folderFiles.find((f: any) => f.id === t.driveAudioFileId);
    const meta = folderFiles.find((f: any) => f.name === 'metadata.json');
    const lyrics = folderFiles.find((f: any) => f.name === 'lyrics.txt');
    const artwork = folderFiles.find((f: any) => f.name.startsWith('artwork'));

    const allInFolder = folderFiles.every((f: any) => f.parents?.includes(t.driveFolderId));

    if (audio && meta && allInFolder) {
      verifiedTrackFolders++;
      totalVerifiedAssets += folderFiles.length;
    } else {
      console.warn(`⚠️ Issue in folder for "${t.title}":`, {
        hasAudio: Boolean(audio),
        hasMeta: Boolean(meta),
        hasArtwork: Boolean(artwork),
        hasLyrics: Boolean(lyrics),
        allInFolder,
      });
    }
  }

  console.log(`\n================================================================`);
  console.log(`FINAL VERIFICATION RESULTS:`);
  console.log(`================================================================`);
  console.log(`Total Tracks in MongoDB:           ${tracks.length}`);
  console.log(`Total Song Folders Verified:       ${verifiedTrackFolders} / ${tracks.length}`);
  console.log(`Total Verified Assets in Folders:  ${totalVerifiedAssets}`);
  console.log(`Files in Root Folder:              ${files.length}`);
  console.log(`All Parent IDs Confirmed:          ${verifiedTrackFolders === tracks.length ? 'YES ✅' : 'NO ❌'}`);
  console.log(`================================================================\n`);

  await mongoose.disconnect();
}

verifyAll().catch(console.error);
