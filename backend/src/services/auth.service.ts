import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../models/user.model.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
}

export class AuthService {
  /**
   * Sanitizes a User document by stripping sensitive fields like passwordHash and refresh tokens.
   */
  sanitizeUser(user: IUser): SanitizedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Generates a short-lived JWT access token.
   */
  generateAccessToken(user: IUser): string {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as any,
    });
  }

  /**
   * Hashes a refresh token string using SHA-256 for secure storage in MongoDB.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a cryptographically random refresh token.
   */
  async createRefreshToken(
    user: IUser,
    context?: { userAgent?: string; ip?: string }
  ): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Refresh token valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Prune expired tokens before adding new one
    const now = new Date();
    user.refreshTokens = user.refreshTokens.filter((s) => s.expiresAt > now);

    user.refreshTokens.push({
      tokenHash,
      expiresAt,
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    await user.save();
    return rawToken;
  }

  /**
   * Registers a new user with hashed password.
   */
  async register(
    data: { email: string; password: string; displayName: string },
    context?: { userAgent?: string; ip?: string }
  ): Promise<{ user: SanitizedUser; tokens: TokenPair }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // First user is automatically assigned admin role if none exist yet
    const count = await User.countDocuments();
    const role = count === 0 ? 'admin' : 'user';

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      displayName: data.displayName.trim(),
      role,
      refreshTokens: [],
    });

    logger.info(`User registered: ${user.email} (Role: ${user.role})`);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user, context);

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.jwtExpiresIn,
      },
    };
  }

  /**
   * Logs in or registers a user authenticated via Google.
   */
  async loginWithGoogle(
    data: { email: string; displayName?: string; avatarUrl?: string },
    context?: { userAgent?: string; ip?: string }
  ): Promise<{ user: SanitizedUser; tokens: TokenPair }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const count = await User.countDocuments();
      const role = count === 0 ? 'admin' : 'user';
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = await User.create({
        email: normalizedEmail,
        displayName: data.displayName?.trim() || normalizedEmail.split('@')[0],
        avatarUrl: data.avatarUrl,
        passwordHash,
        role,
        refreshTokens: [],
        emailVerified: true,
      });
      logger.info(`User registered via Google: ${user.email} (Role: ${user.role})`);
    } else {
      if (data.displayName && (!user.displayName || user.displayName === 'Listener')) {
        user.displayName = data.displayName.trim();
      }
      if (data.avatarUrl && !user.avatarUrl) {
        user.avatarUrl = data.avatarUrl;
      }
      user.emailVerified = true;
      await user.save();
      logger.info(`User signed in via Google: ${user.email}`);
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user, context);

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.jwtExpiresIn,
      },
    };
  }

  /**
   * Authenticates user with email and password.
   */
  async login(
    data: { email: string; password: string },
    context?: { userAgent?: string; ip?: string }
  ): Promise<{ user: SanitizedUser; tokens: TokenPair }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatch) {
      throw new Error('Invalid email or password.');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user, context);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.jwtExpiresIn,
      },
    };
  }

  /**
   * Rotates refresh tokens to provide a new access token and refresh token.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    context?: { userAgent?: string; ip?: string }
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });

    if (!user) {
      throw new Error('Invalid or revoked refresh token.');
    }

    const sessionIndex = user.refreshTokens.findIndex((s: any) => s.tokenHash === tokenHash);
    const session = user.refreshTokens[sessionIndex];

    if (session.expiresAt < new Date()) {
      user.refreshTokens.splice(sessionIndex, 1);
      await user.save();
      throw new Error('Refresh token has expired.');
    }

    // Revoke old session and issue new token pair
    user.refreshTokens.splice(sessionIndex, 1);
    await user.save();

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(user, context);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: env.jwtExpiresIn,
    };
  }

  /**
   * Logs out the user by revoking the specified refresh token.
   */
  async logout(userId: string, rawRefreshToken?: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      user.refreshTokens = user.refreshTokens.filter((s: any) => s.tokenHash !== tokenHash);
    } else {
      user.refreshTokens = [];
    }

    await user.save();
    logger.info(`User logged out: ${user.email}`);
  }

  /**
   * Generates a single-use password reset token with 1 hour expiry.
   */
  async forgotPassword(email: string): Promise<{ resetToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Don't disclose whether email exists for security; return dummy token
      return { resetToken: crypto.randomBytes(20).toString('hex') };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = this.hashToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    logger.info(`Password reset requested for: ${user.email}`);
    return { resetToken };
  }

  /**
   * Resets password using the expiring single-use reset token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashed = this.hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error('Password reset token is invalid or has expired.');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    // Revoke all existing sessions on password reset
    user.refreshTokens = [];
    await user.save();

    logger.info(`Password successfully reset for: ${user.email}`);
  }
}

export const authService = new AuthService();
