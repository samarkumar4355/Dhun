import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { loadSavedTokens } from '../config/googleAuth.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /health
 * Basic liveness check.
 */
router.get('/', (req: Request, res: Response) => {
  const hasTokens = Boolean(loadSavedTokens());

  res.json({
    status: 'ok',
    service: 'Dhun Music Backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    googleDriveAuthorized: hasTokens,
    environment: env.nodeEnv,
  });
});

/**
 * GET /ready
 * Readiness probe: checks database and essential dependency status.
 */
router.get('/ready', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const isDbReady = dbState === 1 || !env.mongodbUri; // Ready if connected, or if DB is optional in dev
  const hasTokens = Boolean(loadSavedTokens());

  const isReady = isDbReady;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    database: {
      connected: dbState === 1,
      state: dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected',
    },
    googleDriveAuthorized: hasTokens,
    timestamp: new Date().toISOString(),
  });
});

export default router;
