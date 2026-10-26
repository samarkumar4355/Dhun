import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Middleware that requires a valid Bearer JWT access token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Access token has expired', 401, 'TOKEN_EXPIRED');
    }
    return sendError(res, 'Invalid access token', 401, 'INVALID_TOKEN');
  }
}

/**
 * Optional authentication middleware:
 * Populates req.user if a valid token is provided, but does not block unauthenticated requests.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthUserPayload;
    req.user = decoded;
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
}

/**
 * Middleware that requires the authenticated user to have the admin role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
  }

  // Also support admin API key header for automated management/CLI operations
  const adminApiKey = req.headers['x-admin-key'];
  const hasValidAdminKey = env.adminApiKey && adminApiKey === env.adminApiKey;

  if (req.user.role !== 'admin' && !hasValidAdminKey) {
    return sendError(res, 'Admin privileges required', 403, 'FORBIDDEN');
  }

  next();
}
