import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { connectDatabase } from '../config/database.js';

async function inspectDetailed() {
  await connectDatabase();
  const drive = await googleDriveService.getClient();
  const root = await googleDriveService.findOrCreateFolder(env.driveRootFolder);

  // 1. Fetch all items inside Dhun Music Library
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
  console.log(`TOTAL SUBFOLDERS IN ROOT: ${foldersInRoot.length}`);
  console.log(`======================================================`);

  const tracks = await Track.find({}).lean();
  console.log(`Tracks in MongoDB: ${tracks.length}`);

  const folderMap = new Map<string, any>();
  for (const f of foldersInRoot) {
    const children = allItems.filter((i) => i.parents && i.parents.includes(f.id));
    folderMap.set(f.id, { folder: f, children });
  }

  for (const [fId, data] of folderMap.entries()) {
    console.log(`\n📁 Folder: "${data.folder.name}" [ID: ${fId}]`);
    for (const c of data.children) {
      console.log(`   - ${c.name} (${c.mimeType}, ID: ${c.id})`);
    }
    // Match with MongoDB track
    const matchedTrack = tracks.find(
      (t) =>
        t.driveFolderId === fId ||
        data.children.some((c: any) => c.id === t.driveAudioFileId)
    );
    if (matchedTrack) {
      console.log(`   ✅ Matched DB Track: "${matchedTrack.title}" by "${matchedTrack.artist}" (driveFolderId: ${matchedTrack.driveFolderId}, audioFileId: ${matchedTrack.driveAudioFileId})`);
    } else {
      console.log(`   ⚠️ No direct DB match found!`);
    }
  }

  await mongoose.disconnect();
}

inspectDetailed().catch(console.error);
