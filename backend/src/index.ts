import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { recommendationService } from './services/recommendation.service.js';
import { sendSuccess } from './utils/response.js';

// Route imports
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import trackRoutes from './routes/track.routes.js';
import artistRoutes from './routes/artist.routes.js';
import albumRoutes from './routes/album.routes.js';
import genreRoutes from './routes/genre.routes.js';
import searchRoutes from './routes/search.routes.js';
import userRoutes from './routes/user.routes.js';
import playlistRoutes from './routes/playlist.routes.js';
import syncRoutes from './routes/sync.routes.js';
import adminRoutes from './routes/admin.routes.js';
import docsRoutes from './routes/docs.routes.js';

const app = express();

// Standard middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
);
app.use(express.json({ limit: '5mb' }));

// Health & Readiness probes
app.use('/health', healthRoutes);
app.get('/ready', (req, res, next) => {
  req.url = '/ready';
  healthRoutes(req, res, next);
});

// Documentation
app.use('/api/v1', docsRoutes);

// Version 1 API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tracks', trackRoutes);
app.use('/api/v1/artists', artistRoutes);
app.use('/api/v1/albums', albumRoutes);
app.use('/api/v1/genres', genreRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/me', userRoutes);
app.use('/api/v1/playlists', playlistRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/admin', adminRoutes);

// Discovery curated collections
app.get('/api/v1/discover', async (req, res) => {
  try {
    const data = await recommendationService.getDiscoverCollections();
    return sendSuccess(res, data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compatible routes for earlier development phases
app.use('/auth', authRoutes);
app.use('/tracks', trackRoutes);
app.use('/api/tracks', trackRoutes);

// API Root landing route
app.get('/', (req, res) => {
  res.json({
    name: 'Dhun Backend API',
    description: 'Lossless personal music streaming and offline synchronization platform',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/docs',
    endpoints: {
      health: '/health',
      ready: '/ready',
      openapi: '/api/v1/openapi.json',
      auth: '/api/v1/auth',
      tracks: '/api/v1/tracks',
      artists: '/api/v1/artists',
      albums: '/api/v1/albums',
      genres: '/api/v1/genres',
      search: '/api/v1/search',
      userLibrary: '/api/v1/me',
      playlists: '/api/v1/playlists',
      sync: '/api/v1/sync',
      admin: '/api/v1/admin',
    },
  });
});

// Centralized error handling
app.use(errorHandler);

// Server startup & graceful shutdown
let server: any;

async function startServer() {
  await connectDatabase();

  server = app.listen(env.port, () => {
    logger.info(`🎵 Dhun Backend server is running on http://localhost:${env.port}`);
    logger.info(`• Interactive Docs: http://localhost:${env.port}/api/v1/docs`);
    logger.info(`• Health Check:     http://localhost:${env.port}/health`);
    logger.info(`• Readiness Check:  http://localhost:${env.port}/ready`);
  });
}

function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        logger.info('MongoDB connection closed.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();

export { app };
