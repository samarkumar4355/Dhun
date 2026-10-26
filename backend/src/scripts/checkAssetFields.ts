import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { connectDatabase } from '../config/database.js';

async function checkAssetFields() {
  await connectDatabase();
  const tracks = await Track.find({}).lean();
  console.log(`Total tracks in DB: ${tracks.length}`);

  let withArtworkId = 0;
  let withLyricsId = 0;
  let withMetaId = 0;

  for (const t of tracks) {
    if (t.driveArtworkFileId) withArtworkId++;
    if (t.driveLyricsFileId) withLyricsId++;
    if (t.driveMetadataFileId) withMetaId++;
  }

  console.log(`Tracks with driveArtworkFileId: ${withArtworkId} / ${tracks.length}`);
  console.log(`Tracks with driveLyricsFileId: ${withLyricsId} / ${tracks.length}`);
  console.log(`Tracks with driveMetadataFileId: ${withMetaId} / ${tracks.length}`);

  await mongoose.disconnect();
}

checkAssetFields().catch(console.error);
