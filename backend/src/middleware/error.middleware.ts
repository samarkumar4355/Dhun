import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

/**
 * Global error-handling middleware.
 * Ensures internal secrets and stack traces are not leaked in production.
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected internal server error occurred'
      : err.message || 'Internal server error';

  const code = err.code || 'INTERNAL_ERROR';
  return sendError(res, message, statusCode, code);
}
