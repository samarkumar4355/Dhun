import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Resolves a file path, checking both relative to current working directory
 * and relative to the project root.
 */
function resolveExistingPath(relativePath: string, defaultPath: string): string {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), defaultPath),
    path.resolve(process.cwd(), '../', relativePath),
    path.resolve(process.cwd(), '../', defaultPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Return the standard expected path if file doesn't exist yet
  return path.resolve(process.cwd(), relativePath);
}

export const env = {
  port: Number.parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dhun',

  // OAuth & Google Drive settings
  credentialsPath: resolveExistingPath(
    process.env.GOOGLE_CREDENTIALS_PATH || '../credentials/credentials.json',
    'credentials/credentials.json'
  ),
  tokenPath: resolveExistingPath(
    process.env.GOOGLE_TOKEN_PATH || '../credentials/tokens.json',
    'credentials/tokens.json'
  ),
  oauthRedirectPort: Number.parseInt(process.env.OAUTH_REDIRECT_PORT || '3000', 10),
  driveRootFolder: process.env.GOOGLE_DRIVE_ROOT_FOLDER || 'Dhun Music Library',
  driveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM',

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || 'dhun-jwt-secret-dev-key-never-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dhun-jwt-refresh-secret-dev-key-never-use-in-production',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  adminApiKey: process.env.ADMIN_API_KEY || '',

  // Local music staging folder for import
  localImportFolder: path.resolve(
    process.cwd(),
    process.env.LOCAL_IMPORT_FOLDER || '../DhunMusicImport'
  ),

  // Dedicated temporary directory outside the project for ephemeral staging/processing
  tempStagingDir: process.env.DHUN_TEMP_STAGING_DIR || path.join(os.tmpdir(), 'dhun-staging'),
};
