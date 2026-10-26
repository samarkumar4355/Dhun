import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { connectDatabase } from '../config/database.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';

async function auditTracksAndDrive() {
  await connectDatabase();
  const drive = await googleDriveService.getClient();
  const root = await googleDriveService.findOrCreateFolder(env.driveRootFolder);

  // 1. Fetch all items in Drive under root
  const res: any = await drive.files.list({
    q: 'trashed = false',
    fields: 'files(id, name, mimeType, parents, size, md5Checksum)',
    pageSize: 1000,
  });

  const allItems: any[] = res.data.files || [];
  const foldersInRoot = allItems.filter(
    (item) => item.parents && item.parents.includes(root.id) && item.mimeType === 'application/vnd.google-apps.folder'
  );

  console.log(`\n======================================================`);
  console.log(`AUDIT: GOOGLE DRIVE FOLDERS & MONGODB TRACKS`);
  console.log(`======================================================`);
  console.log(`Google Drive Root: "${root.name}" (${root.id})`);
  console.log(`Total Subfolders in Root: ${foldersInRoot.length}`);

  const tracks = await Track.find({}).lean();
  console.log(`Total Tracks in MongoDB: ${tracks.length}`);

  const itemsByParent = new Map<string, any[]>();
  for (const item of allItems) {
    if (item.parents) {
      for (const p of item.parents) {
        if (!itemsByParent.has(p)) itemsByParent.set(p, []);
        itemsByParent.get(p)!.push(item);
      }
    }
  }

  // Check each track against Google Drive
  let fullyLinkedCount = 0;
  let missingFilesCount = 0;

  for (const t of tracks) {
    const folder = foldersInRoot.find((f) => f.id === t.driveFolderId);
    const children = t.driveFolderId ? itemsByParent.get(t.driveFolderId) || [] : [];
    const audio = children.find((c) => c.id === t.driveAudioFileId);
    const meta = children.find((c) => c.name === 'metadata.json');
    const lyrics = children.find((c) => c.name === 'lyrics.txt');
    const artwork = children.find((c) => c.name.startsWith('cover') || c.name.startsWith('artwork'));

    console.log(`\n🎵 Track: "${t.title}" by "${t.artist}"`);
    console.log(`   Expected Folder: "${t.title} - ${t.artist}"`);
    console.log(`   Current Drive Folder: ${folder ? `"${folder.name}" (${folder.id})` : '❌ NOT FOUND'}`);
    console.log(`   Audio File: ${audio ? `✅ "${audio.name}" (${audio.id})` : '❌ MISSING'}`);
    console.log(`   metadata.json: ${meta ? `✅ (${meta.id})` : '❌ MISSING'}`);
    console.log(`   lyrics.txt: ${lyrics ? `✅ (${lyrics.id})` : t.hasLyrics ? '⚠️ flagged hasLyrics but missing file' : 'none'}`);
    console.log(`   Artwork: ${artwork ? `✅ "${artwork.name}" (${artwork.id})` : t.hasArtwork ? '⚠️ flagged hasArtwork but missing file' : 'none'}`);

    if (folder && audio && meta) {
      fullyLinkedCount++;
    } else {
      missingFilesCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`SUMMARY:`);
  console.log(`Tracks fully linked with folder, audio, metadata: ${fullyLinkedCount} / ${tracks.length}`);
  console.log(`Tracks with issues or missing files: ${missingFilesCount}`);

  // Check for orphan or redundant folders on Google Drive
  const trackFolderIds = new Set(tracks.map((t) => t.driveFolderId));
  const unlinkedFolders = foldersInRoot.filter((f) => !trackFolderIds.has(f.id));
  console.log(`Google Drive subfolders not associated with any Track: ${unlinkedFolders.length}`);
  for (const f of unlinkedFolders) {
    const children = itemsByParent.get(f.id) || [];
    console.log(` - "${f.name}" (${f.id}) with ${children.length} items`);
    for (const c of children) {
      console.log(`    * ${c.name} (${c.id})`);
    }
  }

  await mongoose.disconnect();
}

auditTracksAndDrive().catch(console.error);
