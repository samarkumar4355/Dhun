import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { musicImporter } from '../workers/importer.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { Track } from '../models/track.model.js';

async function testSingle() {
  console.log('Connecting to MongoDB...');
  await connectDatabase();

  const accountInfo = await googleDriveService.getAccountInfo();
  console.log(`Google Account: ${accountInfo.emailAddress}`);

  // Test importing 1 track from the staged folder
  console.log('Running import for 1 track...');
  const report = await musicImporter.runImport({
    dryRun: false,
    maxTracks: 6, // 5 Josh Woodward + 1 new
    confirmAccount: true,
    expectedAccountEmail: accountInfo.emailAddress || undefined,
  });

  console.log('\nReport items:');
  for (const r of report) {
    console.log(` - ${r.fileName} => Status: ${r.status} | Title: "${r.title}" | Artist: "${r.artist}" | DriveFolder: ${r.driveFolderId}`);
  }

  // Check MongoDB for new track
  const tracks = await Track.find({ artist: { $ne: 'Josh Woodward' } }).lean();
  console.log('\nNew tracks in MongoDB:');
  for (const t of tracks) {
    console.log(`🎵 "${t.title}" by "${t.artist}" | Album: "${t.album}" | Language: "${t.language}" | HasLyrics: ${t.hasLyrics} | HasArtwork: ${t.hasArtwork} | DriveAudio: ${t.driveAudioFileId}`);
  }

  await mongoose.disconnect();
}

testSingle().catch(console.error);
