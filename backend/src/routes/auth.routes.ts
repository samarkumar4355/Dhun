import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { loadSavedTokens, getAuthenticatedOAuth2Client } from '../config/googleAuth.js';
import { authService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { rateLimit } from '../middleware/rateLimit.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { User } from '../models/user.model.js';

const router = Router();

// Rate limiter for authentication endpoints: 10 attempts per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please try again after 1 minute.',
});

// ─── Legacy Google Drive OAuth Endpoints ─────────────────────────────────────

/**
 * Check whether Google Drive OAuth tokens are present locally.
 */
router.get('/status', (req: Request, res: Response) => {
  const tokens = loadSavedTokens();
  res.json({
    authorized: Boolean(tokens),
    message: tokens
      ? 'Google Drive is authorized.'
      : 'Google Drive is not yet authorized. Run npm run test:drive to connect.',
  });
});

/**
 * Trigger OAuth authentication via API endpoint if needed.
 */
router.get('/connect', async (req: Request, res: Response) => {
  try {
    await getAuthenticatedOAuth2Client();
    res.json({
      success: true,
      message: 'Google Drive connected successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ─── User Authentication Endpoints ──────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters long'),
});

/**
 * POST /api/v1/auth/register
 */
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;
      const context = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const result = await authService.register({ email, password, displayName }, context);
      return sendSuccess(res, result, undefined, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400, 'REGISTRATION_FAILED');
    }
  }
);

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/v1/auth/login
 */
router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const context = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const result = await authService.login({ email, password }, context);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 401, 'INVALID_CREDENTIALS');
    }
  }
);

const googleAuthSchema = z.object({
  email: z.string().email('Invalid email address'),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
});

/**
 * POST /api/v1/auth/google
 */
router.post(
  '/google',
  authLimiter,
  validate({ body: googleAuthSchema }),
  async (req: Request, res: Response) => {
    try {
      const { email, displayName, avatarUrl } = req.body;
      const context = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const result = await authService.loginWithGoogle({ email, displayName, avatarUrl }, context);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 500, 'GOOGLE_AUTH_FAILED');
    }
  }
);

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/v1/auth/refresh
 */
router.post(
  '/refresh',
  validate({ body: refreshSchema }),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const context = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const tokens = await authService.rotateRefreshToken(refreshToken, context);
      return sendSuccess(res, { tokens });
    } catch (err: any) {
      return sendError(res, err.message, 401, 'INVALID_REFRESH_TOKEN');
    }
  }
);

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

/**
 * POST /api/v1/auth/logout
 */
router.post(
  '/logout',
  requireAuth,
  validate({ body: logoutSchema }),
  async (req: Request, res: Response) => {
    try {
      await authService.logout(req.user!.userId, req.body.refreshToken);
      return sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err: any) {
      return sendError(res, err.message, 500, 'LOGOUT_FAILED');
    }
  }
);

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/v1/auth/forgot-password
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response) => {
    try {
      const result = await authService.forgotPassword(req.body.email);
      return sendSuccess(res, {
        message: 'Password reset instructions have been generated.',
        resetToken: result.resetToken, // Available for development/testing
      });
    } catch (err: any) {
      return sendError(res, err.message, 500, 'REQUEST_FAILED');
    }
  }
);

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

/**
 * POST /api/v1/auth/reset-password
 */
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response) => {
    try {
      await authService.resetPassword(req.body.token, req.body.newPassword);
      return sendSuccess(res, { message: 'Password has been reset successfully' });
    } catch (err: any) {
      return sendError(res, err.message, 400, 'RESET_FAILED');
    }
  }
);

/**
 * GET /api/v1/auth/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return sendError(res, 'User not found', 404, 'NOT_FOUND');
    }
    return sendSuccess(res, authService.sanitizeUser(user));
  } catch (err: any) {
    return sendError(res, err.message, 500, 'FETCH_FAILED');
  }
});

export default router;
