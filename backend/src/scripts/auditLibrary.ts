import mongoose from 'mongoose';
import { googleDriveService } from '../services/googleDrive.service.js';
import { connectDatabase } from '../config/database.js';
import { Track } from '../models/track.model.js';
import { Artist } from '../models/artist.model.js';
import { Album } from '../models/album.model.js';
import { Genre } from '../models/genre.model.js';
import { env } from '../config/env.js';

async function audit() {
  console.log('================================================================');
  console.log('🔍 DHUN MUSIC LIBRARY AUDIT');
  console.log('================================================================\n');

  // 1. Google Drive Audit
  const drive = await googleDriveService.getClient();
  const rootFolderId = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';
  console.log(`Auditing Google Drive Root Folder ID: ${rootFolderId}`);

  try {
    const rootFolder = await googleDriveService.verifyFolder(rootFolderId);
    console.log(`✅ Root Folder Name: "${rootFolder.name}" (ID: ${rootFolder.id})`);

    const resolved = await googleDriveService.findOrCreateFolder(env.driveRootFolder);
    console.log(`✅ findOrCreateFolder("${env.driveRootFolder}") resolved to ID: ${resolved.id}`);
    if (resolved.id !== rootFolderId) {
      console.warn(`⚠️ Warning: resolved ID (${resolved.id}) does not match rootFolderId (${rootFolderId})!`);
    } else {
      console.log(`🎉 Perfect match with rootFolderId: ${rootFolderId}`);
    }
  } catch (err: any) {
    console.error(`❌ Could not verify root folder ID ${rootFolderId}: ${err.message}`);
  }

  // List all direct subfolders/files in the root folder
  let driveTracksCount = 0;
  const driveFolders: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined = undefined;

  do {
    const res: any = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
    });
    const files = res.data.files || [];
    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        driveFolders.push({ id: f.id, name: f.name });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${driveFolders.length} subfolder(s) in Google Drive "Dhun Music Library":`);
  for (const f of driveFolders) {
    console.log(`  📁 ${f.name} (ID: ${f.id})`);
  }

  // 2. MongoDB Atlas Audit
  console.log('\n----------------------------------------------------------------');
  console.log('Connecting to MongoDB Atlas...');
  await connectDatabase();

  const totalTracks = await Track.countDocuments();
  const totalArtists = await Artist.countDocuments();
  const totalAlbums = await Album.countDocuments();
  const totalGenres = await Genre.countDocuments();

  console.log(`MongoDB Tracks:  ${totalTracks}`);
  console.log(`MongoDB Artists: ${totalArtists}`);
  console.log(`MongoDB Albums:  ${totalAlbums}`);
  console.log(`MongoDB Genres:  ${totalGenres}`);

  const tracks = await Track.find({}).lean();
  console.log('\nCurrent tracks in MongoDB:');
  for (const t of tracks) {
    console.log(`  🎵 "${t.title}" by "${t.artist}" | Album: "${t.album}" | Hash: ${t.fileHash.slice(0, 10)}... | DriveFile: ${t.driveAudioFileId || 'none'} | HasLyrics: ${t.hasLyrics} | HasArtwork: ${t.hasArtwork}`);
  }

  console.log('\n================================================================');
  console.log(`Target: 1,000 unique tracks`);
  console.log(`Current existing tracks: ${totalTracks}`);
  console.log(`Needed additional unique tracks: ${Math.max(0, 1000 - totalTracks)}`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
