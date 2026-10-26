import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests allowed in window
  message?: string;
}

interface ClientRecord {
  timestamps: number[];
}

/**
 * In-memory sliding-window rate limiter per client IP.
 * Does not require Redis or external infrastructure to run.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.' } = options;
  const clients = new Map<string, ClientRecord>();

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        clients.delete(ip);
      }
    }
  }, Math.max(windowMs, 60000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = clients.get(ip);
    if (!record) {
      record = { timestamps: [] };
      clients.set(ip, record);
    }

    // Filter to requests within current sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());
      return sendError(res, message, 429, 'RATE_LIMITED');
    }

    record.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.timestamps.length).toString());

    next();
  };
}
