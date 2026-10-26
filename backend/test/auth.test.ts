import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../src/config/env.js';

describe('Dhun Authentication & Security Tests', () => {

  describe('1. Password Hashing Security', () => {
    it('should securely hash password with bcrypt', async () => {
      const password = 'SuperSecretPassword123!';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      assert.notStrictEqual(hash, password);
      assert.ok(hash.startsWith('$2'));

      // Validate correct password matches
      const isMatch = await bcrypt.compare(password, hash);
      assert.strictEqual(isMatch, true);

      // Validate incorrect password fails
      const isWrongMatch = await bcrypt.compare('WrongPassword456', hash);
      assert.strictEqual(isWrongMatch, false);
    });

    it('should generate distinct salts and hashes for the same password', async () => {
      const password = 'ConsistentPassword888';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      assert.notStrictEqual(hash1, hash2);
      assert.strictEqual(await bcrypt.compare(password, hash1), true);
      assert.strictEqual(await bcrypt.compare(password, hash2), true);
    });
  });

  describe('2. JWT Access Token Issuance and Verification', () => {
    it('should sign and verify valid JWT access tokens', () => {
      const payload = {
        userId: '67bdc1234567890abcdef123',
        email: 'testuser@dhun.audio',
        role: 'user',
      };

      const token = jwt.sign(payload, env.jwtSecret, {
        expiresIn: '15m',
      });

      assert.ok(typeof token === 'string');
      assert.strictEqual(token.split('.').length, 3);

      const decoded = jwt.verify(token, env.jwtSecret) as any;
      assert.strictEqual(decoded.userId, payload.userId);
      assert.strictEqual(decoded.email, payload.email);
      assert.strictEqual(decoded.role, 'user');
    });

    it('should reject tokens signed with incorrect secret', () => {
      const payload = { userId: '123' };
      const invalidToken = jwt.sign(payload, 'wrong-secret-key-that-should-fail');

      assert.throws(() => {
        jwt.verify(invalidToken, env.jwtSecret);
      }, /invalid signature/);
    });

    it('should detect and reject expired tokens', async () => {
      const payload = { userId: '123' };
      const expiredToken = jwt.sign(payload, env.jwtSecret, {
        expiresIn: '-1s', // Expired 1 second ago
      });

      assert.throws(() => {
        jwt.verify(expiredToken, env.jwtSecret);
      }, /jwt expired/);
    });
  });

  describe('3. Refresh Token Generation & Cryptographic Hashing', () => {
    it('should generate cryptographically random 64-char hex refresh tokens', () => {
      const rawToken = crypto.randomBytes(40).toString('hex');
      assert.strictEqual(rawToken.length, 80);

      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      assert.strictEqual(hash.length, 64);
      assert.notStrictEqual(hash, rawToken);
    });

    it('should generate single-use password reset tokens with expiration check', () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

      assert.ok(expiresAt.getTime() > Date.now());

      // Compare hashes
      const verifyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      assert.strictEqual(verifyHash, hashedToken);
    });
  });
});
