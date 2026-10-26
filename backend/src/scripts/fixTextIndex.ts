import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Track } from '../models/track.model.js';

async function fix() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDatabase();

  const indexes = await Track.collection.indexes();
  console.log('Current indexes:', indexes.map((i) => i.name));

  for (const idx of indexes) {
    if (idx.name?.includes('text') || idx.weights) {
      console.log('Dropping index:', idx.name);
      try {
        await Track.collection.dropIndex(idx.name);
        console.log('Dropped:', idx.name);
      } catch (e: any) {
        console.warn('Error dropping:', e.message);
      }
    }
  }

  console.log('Re-syncing Track indexes with language_override: none...');
  await Track.syncIndexes();

  const updated = await Track.collection.indexes();
  console.log('Updated indexes:', updated.map((i) => ({ name: i.name, language_override: i.language_override })));

  await mongoose.disconnect();
  console.log('Done.');
}

fix().catch(console.error);
