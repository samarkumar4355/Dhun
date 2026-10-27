import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { env } from './env.js';

// Preload circular mongodb driver and mongoose modules in safe dependency order to prevent CJS circular require TDZ on modern Node
try {
  const cjsRequire = createRequire(import.meta.url);
  try {
    cjsRequire('mongoose/lib/helpers/query/castUpdate');
    cjsRequire('mongoose/node_modules/mongodb/lib/cmap/connection.js');
    cjsRequire('mongoose/node_modules/mongodb/lib/cmap/connection_pool.js');
    cjsRequire('mongoose/node_modules/mongodb/lib/sdam/server.js');
    cjsRequire('mongoose/node_modules/mongodb/lib/sdam/monitor.js');
  } catch {
    cjsRequire('mongoose/lib/helpers/query/castUpdate');
    cjsRequire('mongodb/lib/cmap/connection.js');
    cjsRequire('mongodb/lib/cmap/connection_pool.js');
    cjsRequire('mongodb/lib/sdam/server.js');
    cjsRequire('mongodb/lib/sdam/monitor.js');
  }
} catch {
  // Non-fatal if paths differ
}

/**
 * Connects to MongoDB Atlas using Mongoose.
 * If MONGODB_URI is not set in .env, logs a clear message and does not crash the server,
 * allowing Phase 2 Google Drive authentication to work independently.
 */
export async function connectDatabase(): Promise<void> {
  if (!env.mongodbUri) {
    console.log('ℹ️  MongoDB Atlas: MONGODB_URI not set in .env. Skipping database connection for now.');
    return;
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB successfully.');
  } catch (error: any) {
    console.warn(`Primary MongoDB connection error: ${error.message}`);
    const localUri = 'mongodb://127.0.0.1:27017/dhun';
    if (env.mongodbUri !== localUri) {
      try {
        console.log(`Attempting fallback to local MongoDB (${localUri})...`);
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
        console.log('Connected to local MongoDB successfully.');
      } catch (localErr: any) {
        console.warn(`Local MongoDB fallback error: ${localErr.message}`);
      }
    }
  }
}
