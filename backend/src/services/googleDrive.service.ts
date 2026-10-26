import fs from 'node:fs';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import { getGoogleDriveClient } from '../config/googleAuth.js';

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string | null;
  trashed?: boolean | null;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: string | null;
  md5Checksum?: string | null;
}

/**
 * Computes the MD5 checksum of a local file.
 * Used exclusively for comparison against Google Drive's native md5Checksum field.
 * (Note: SHA-256 remains the standard for local manifest deduplication).
 */
export function computeLocalMd5(filePath: string): string {
  const hash = crypto.createHash('md5');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

export class GoogleDriveService {
  private driveClient: drive_v3.Drive | null = null;

  /**
   * Lazily initializes and returns the authenticated Google Drive API client.
   */
  async getClient(): Promise<drive_v3.Drive> {
    if (!this.driveClient) {
      this.driveClient = await getGoogleDriveClient();
    }
    return this.driveClient;
  }

  /**
   * Retrieves the connected Google account details via the Drive API about.get endpoint.
   * Never prints tokens or secrets.
   */
  async getAccountInfo(): Promise<{ emailAddress?: string | null; displayName?: string | null }> {
    const drive = await this.getClient();
    const res = await drive.about.get({
      fields: 'user(displayName, emailAddress)',
    });
    return {
      emailAddress: res.data.user?.emailAddress,
      displayName: res.data.user?.displayName,
    };
  }

  /**
   * Finds an existing folder by name or creates it if it does not already exist.
   * Respects trashed=false to avoid returning deleted folders.
   */
  async findOrCreateFolder(folderName: string, parentFolderId?: string): Promise<DriveFolderInfo> {
    const drive = await this.getClient();

    let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, trashed)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      const existing = response.data.files[0];
      return {
        id: existing.id as string,
        name: existing.name as string,
        webViewLink: existing.webViewLink,
        trashed: existing.trashed,
      };
    }

    // Create the folder if not found
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      fields: 'id, name, webViewLink, trashed',
    });

    return {
      id: createResponse.data.id as string,
      name: createResponse.data.name as string,
      webViewLink: createResponse.data.webViewLink,
      trashed: createResponse.data.trashed,
    };
  }

  /**
   * Phase 2 Connection Test:
   * Creates or verifies a folder named "Dhun Connection Test" in Google Drive.
   */
  async createTestFolder(): Promise<DriveFolderInfo> {
    return this.findOrCreateFolder('Dhun Connection Test');
  }

  /**
   * Verifies that a folder actually exists on Google Drive, is accessible, and not in the trash.
   */
  async verifyFolder(folderId: string): Promise<DriveFolderInfo> {
    const drive = await this.getClient();

    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, trashed, webViewLink',
    });

    if (response.data.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error(`Google Drive item with ID ${folderId} is not a folder (mimeType: ${response.data.mimeType})`);
    }

    if (response.data.trashed) {
      throw new Error(`Google Drive folder with ID ${folderId} is in the trash.`);
    }

    return {
      id: response.data.id as string,
      name: response.data.name as string,
      webViewLink: response.data.webViewLink,
      trashed: response.data.trashed,
    };
  }

  /**
   * Uploads a local file (such as FLAC audio or cover image) to a target Google Drive folder.
   * Preserves exact binary bytes without modification.
   * Validates existing files by size and MD5 checksum; never overwrites or assumes identity by name alone.
   * Verifies file size and MD5 post-upload.
   */
  async uploadFile(options: {
    filePath: string;
    fileName: string;
    mimeType: string;
    parentFolderId: string;
  }): Promise<DriveFileInfo> {
    const drive = await this.getClient();
    const localStats = fs.statSync(options.filePath);
    const localSize = localStats.size;
    const localMd5 = computeLocalMd5(options.filePath);

    // Check if file already exists in target folder
    const existing = await drive.files.list({
      q: `'${options.parentFolderId}' in parents and name = '${options.fileName.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id, name, mimeType, size, md5Checksum)',
      spaces: 'drive',
    });

    if (existing.data.files && existing.data.files.length > 0) {
      const file = existing.data.files[0];
      const remoteSize = file.size ? Number.parseInt(file.size, 10) : undefined;
      const remoteMd5 = file.md5Checksum ? file.md5Checksum.toLowerCase() : undefined;

      // Reliable integrity comparison: both size and MD5 must exist and match
      const sizeMatches = remoteSize !== undefined && remoteSize === localSize;
      const md5Matches = remoteMd5 !== undefined && remoteMd5 === localMd5.toLowerCase();

      if (sizeMatches && md5Matches) {
        return {
          id: file.id as string,
          name: file.name as string,
          mimeType: file.mimeType,
          size: file.size,
          md5Checksum: file.md5Checksum,
        };
      }

      // If integrity cannot be verified or mismatches, fail safely without overwriting
      throw new Error(
        `[Existing File Conflict] A file named "${options.fileName}" already exists in Drive folder ${options.parentFolderId}, but its integrity check does not match the local file.\n` +
        `Local file: size=${localSize}, MD5=${localMd5}\n` +
        `Drive file: size=${file.size}, MD5=${file.md5Checksum}\n` +
        `Upload aborted to prevent overwriting or data loss.`
      );
    }

    const media = {
      mimeType: options.mimeType,
      body: fs.createReadStream(options.filePath),
    };

    const response = await drive.files.create({
      requestBody: {
        name: options.fileName,
        parents: [options.parentFolderId],
      },
      media,
      fields: 'id, name, mimeType, size, md5Checksum',
    });

    const uploadedId = response.data.id as string;

    // Post-upload verification: verify file size and compare Drive MD5 with locally computed MD5
    const verified = await this.verifyFile(uploadedId);
    if (verified.size && Number.parseInt(verified.size, 10) !== localSize) {
      throw new Error(
        `[Integrity Verification Error] Uploaded file "${options.fileName}" size mismatch.\n` +
        `Expected local size: ${localSize}, Drive verified size: ${verified.size}`
      );
    }

    if (verified.md5Checksum && verified.md5Checksum.toLowerCase() !== localMd5.toLowerCase()) {
      throw new Error(
        `[Integrity Verification Error] Uploaded file "${options.fileName}" MD5 checksum mismatch.\n` +
        `Expected local MD5: ${localMd5}, Drive verified MD5: ${verified.md5Checksum}`
      );
    }

    return verified;
  }

  /**
   * Uploads an in-memory JSON object as a file (e.g. metadata.json).
   * Checks if already exists to prevent duplicate creation.
   */
  async uploadJson(options: {
    data: unknown;
    fileName: string;
    parentFolderId: string;
  }): Promise<DriveFileInfo> {
    const drive = await this.getClient();

    const existing = await drive.files.list({
      q: `'${options.parentFolderId}' in parents and name = '${options.fileName.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id, name, mimeType, size)',
      spaces: 'drive',
    });

    if (existing.data.files && existing.data.files.length > 0) {
      const file = existing.data.files[0];
      return {
        id: file.id as string,
        name: file.name as string,
        mimeType: file.mimeType,
        size: file.size,
      };
    }

    const jsonString = JSON.stringify(options.data, null, 2);
    const media = {
      mimeType: 'application/json',
      body: Readable.from([jsonString]),
    };

    const response = await drive.files.create({
      requestBody: {
        name: options.fileName,
        parents: [options.parentFolderId],
      },
      media,
      fields: 'id, name, mimeType, size',
    });

    return {
      id: response.data.id as string,
      name: response.data.name as string,
      mimeType: response.data.mimeType,
      size: response.data.size,
    };
  }

  /**
   * Verifies an uploaded file exists on Drive, is not trashed, and returns its metadata.
   */
  async verifyFile(fileId: string): Promise<DriveFileInfo> {
    const drive = await this.getClient();
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, md5Checksum, trashed',
    });

    if (response.data.trashed) {
      throw new Error(`Google Drive file ${fileId} is trashed.`);
    }

    return {
      id: response.data.id as string,
      name: response.data.name as string,
      mimeType: response.data.mimeType,
      size: response.data.size,
      md5Checksum: response.data.md5Checksum,
    };
  }

  /**
   * Reads raw text content from a Google Drive file.
   * Preserves all line breaks and exact characters.
   */
  async readFileText(fileId: string): Promise<string> {
    const drive = await this.getClient();
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    return typeof response.data === 'string' ? response.data : String(response.data);
  }

  /**
   * Finds a file by name within a parent folder in Google Drive.
   */
  async findFileInFolder(fileName: string, parentFolderId: string): Promise<DriveFileInfo | null> {
    const drive = await this.getClient();
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id, name, mimeType, size, md5Checksum)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      const file = response.data.files[0];
      return {
        id: file.id as string,
        name: file.name as string,
        mimeType: file.mimeType,
        size: file.size,
        md5Checksum: file.md5Checksum,
      };
    }
    return null;
  }

  /**
   * Reads lyrics.txt from a song's Google Drive folder if present.
   * Preserves original line breaks and verse spacing.
   */
  async readLyricsFromFolder(parentFolderId: string): Promise<string | null> {
    const file = await this.findFileInFolder('lyrics.txt', parentFolderId);
    if (!file) {
      return null;
    }
    return this.readFileText(file.id);
  }
}

export const googleDriveService = new GoogleDriveService();
