import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { metadataService, type ExtractedTrackData } from '../services/metadata.service.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { Track } from '../models/track.model.js';
import { catalogService } from '../services/catalog.service.js';
import mongoose from 'mongoose';

export interface ManifestEntry {
  fileHash: string; // SHA-256
  fileName: string;
  title: string;
  artist: string;
  driveFolderId?: string;
  driveAudioFileId?: string;
  importedAt: string;
}

export interface ImportReportItem {
  fileName: string;
  title: string;
  artist: string;
  status: 'imported' | 'skipped_duplicate' | 'dry_run_ready' | 'failed';
  codec: string;
  lossless: boolean;
  driveFolderId?: string;
  driveAudioFileId?: string;
  error?: string;
}

export interface ImportOptions {
  dryRun?: boolean;
  maxTracks?: number; // Default: 10
  confirmAccount?: boolean;
  expectedAccountEmail?: string;
}

export class MusicImporter {
  private readonly supportedExtensions = new Set(['.flac', '.alac', '.m4a', '.mp3', '.wav']);
  private readonly manifestPath: string;

  constructor(manifestPath?: string) {
    this.manifestPath = manifestPath || path.join(env.localImportFolder, 'import-manifest.json');
  }

  /**
   * Loads the persistent import manifest from disk.
   */
  loadManifest(): Map<string, ManifestEntry> {
    const map = new Map<string, ManifestEntry>();
    if (fs.existsSync(this.manifestPath)) {
      try {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const entries: ManifestEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          map.set(entry.fileHash, entry);
        }
      } catch (err: any) {
        console.warn(`Could not read manifest at ${this.manifestPath}: ${err.message}`);
      }
    }
    return map;
  }

  /**
   * Persists the updated manifest to disk.
   */
  saveManifest(manifest: Map<string, ManifestEntry>): void {
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const entries = Array.from(manifest.values());
    fs.writeFileSync(this.manifestPath, JSON.stringify(entries, null, 2), 'utf8');
  }

  /**
   * Sanitizes strings for use as folder or file names in Google Drive and local paths.
   */
  private sanitizeName(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  }

  /**
   * Executes an operation with retry logic for network resilience.
   */
  private async retryOperation<T>(fn: () => Promise<T>, retries = 3, delayMs = 1500): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        // Do not retry on explicit integrity conflicts or verification errors
        if (err.message && (err.message.includes('[Existing File Conflict]') || err.message.includes('[Integrity Verification Error]'))) {
          throw err;
        }
        if (attempt < retries) {
          console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`);
          await new Promise((res) => setTimeout(res, delayMs * attempt));
        }
      }
    }
    throw lastError;
  }

  /**
   * Runs the automated importer for up to 10 authorized tracks.
   * Includes account verification, dry-run mode, SHA-256 deduplication, and Google Drive upload.
   */
  async runImport(options: ImportOptions = {}): Promise<ImportReportItem[]> {
    const dryRun = options.dryRun ?? false;
    const maxTracks = options.maxTracks ?? 10;
    const audioDir = path.join(env.localImportFolder, 'audio');

    console.log(`\n================================================================`);
    console.log(`🎵 Dhun Music Importer ${dryRun ? '[DRY RUN MODE]' : '[LIVE IMPORT MODE]'}`);
    console.log(`================================================================`);
    console.log(`Source Folder: ${audioDir}`);
    console.log(`Batch Limit:   Up to ${maxTracks} authorized tracks\n`);

    // 1. Google Account Verification before any live action
    if (!dryRun) {
      if (options.confirmAccount !== true) {
        throw new Error(
          `[Account Confirmation Required] Explicit confirmation required before live upload to Google account. Aborting.`
        );
      }

      console.log(`Verifying connected Google account...`);
      const accountInfo = await googleDriveService.getAccountInfo();
      if (!accountInfo.emailAddress) {
        throw new Error(`[Google Account Verification Error] Could not retrieve connected account email from Google Drive API.`);
      }

      console.log(`Connected Google Account: ${accountInfo.emailAddress} (${accountInfo.displayName || 'Google User'})`);

      if (options.expectedAccountEmail && options.expectedAccountEmail.toLowerCase() !== accountInfo.emailAddress.toLowerCase()) {
        throw new Error(
          `[Google Account Mismatch] Connected account (${accountInfo.emailAddress}) does not match expected account (${options.expectedAccountEmail}). Aborting upload.`
        );
      }
    }

    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
      console.log(`Created audio staging folder at: ${audioDir}`);
      console.log(`Please place your authorized music files (.flac, .m4a, .mp3, .wav) inside this folder.`);
      return [];
    }

    // Scan for audio files
    const allFiles = fs.readdirSync(audioDir);
    const audioFiles = allFiles
      .filter((file) => this.supportedExtensions.has(path.extname(file).toLowerCase()))
      .slice(0, maxTracks);

    if (audioFiles.length === 0) {
      console.log(`No audio files found in ${audioDir}.`);
      console.log(`Supported extensions: .flac, .alac, .m4a, .mp3, .wav`);
      return [];
    }

    console.log(`Found ${audioFiles.length} file(s) to process.`);
    const manifest = this.loadManifest();
    const report: ImportReportItem[] = [];

    // Ensure root Google Drive library folder exists if doing live import
    let rootFolderId = '';
    if (!dryRun) {
      const rootFolder = await this.retryOperation(() =>
        googleDriveService.findOrCreateFolder(env.driveRootFolder)
      );
      rootFolderId = rootFolder.id;
      console.log(`Root Library Folder: "${env.driveRootFolder}" (ID: ${rootFolderId})\n`);
    }

    for (const fileName of audioFiles) {
      const filePath = path.join(audioDir, fileName);

      try {
        console.log(`Processing: ${fileName}...`);

        // 1. Extract metadata and compute SHA-256
        const data: ExtractedTrackData = await metadataService.extractMetadata(filePath);
        console.log(`  Title: "${data.title}" | Artist: "${data.artist}" | Format: ${data.codec} (${data.lossless ? 'Lossless' : 'Lossy'})`);

        // 2. Check for duplicate using SHA-256 hash
        if (manifest.has(data.fileHash)) {
          const existing = manifest.get(data.fileHash)!;
          console.log(`  ⏭️  Skipped: Already imported previously (Hash: ${data.fileHash.substring(0, 10)}...).`);

          // Reconcile with MongoDB if connected
          if (mongoose.connection.readyState === 1) {
            try {
              const updateFields: any = {
                title: data.title,
                artist: data.artist,
                album: data.album,
                year: data.year,
                genre: data.genre,
                trackNumber: data.trackNumber,
                discNumber: data.discNumber,
                durationSeconds: data.durationSeconds,
                codec: data.codec,
                lossless: data.lossless,
                sampleRate: data.sampleRate,
                bitDepth: data.bitDepth,
                bitrate: data.bitrate,
                numberOfChannels: data.numberOfChannels,
                fileHash: data.fileHash,
                originalFileName: data.originalFileName,
                fileSizeBytes: data.fileSizeBytes,
                mimeType: data.mimeType,
                driveFolderId: existing.driveFolderId || '',
                driveAudioFileId: existing.driveAudioFileId || '',
                importedAt: existing.importedAt ? new Date(existing.importedAt) : new Date(),
              };

              const updateOps: any = {
                $set: updateFields,
              };

              // Only update lyrics if valid incoming lyrics exist; never overwrite valid lyrics with null
              if (data.lyricsText && metadataService.isValidLyrics(data.lyricsText)) {
                updateOps.$set.lyrics = data.lyricsText;
                updateOps.$set.hasLyrics = true;
              } else {
                updateOps.$setOnInsert = {
                  lyrics: null,
                  hasLyrics: false,
                };
              }

              const updatedDoc = await Track.findOneAndUpdate(
                { fileHash: data.fileHash },
                updateOps,
                { upsert: true, new: true }
              );

              if (updatedDoc) {
                try {
                  await catalogService.linkTrackToCatalog(updatedDoc);
                } catch (linkErr: any) {
                  console.warn(`  ⚠️ Catalog linking warning for ${fileName}: ${linkErr.message}`);
                }
              }
            } catch (dbErr: any) {
              console.warn(`  ⚠️ MongoDB sync warning for ${fileName}: ${dbErr.message}`);
            }
          }

          report.push({
            fileName,
            title: data.title,
            artist: data.artist,
            status: 'skipped_duplicate',
            codec: data.codec,
            lossless: data.lossless,
            driveAudioFileId: existing.driveAudioFileId,
            driveFolderId: existing.driveFolderId,
          });
          continue;
        }

        // 3. Dry-run handling (Guaranteed zero Drive API calls or uploads)
        if (dryRun) {
          console.log(`  [Dry Run] Ready to import. Missing fields: [${data.missingFields.join(', ') || 'none'}]`);
          report.push({
            fileName,
            title: data.title,
            artist: data.artist,
            status: 'dry_run_ready',
            codec: data.codec,
            lossless: data.lossless,
          });
          continue;
        }

        // 4. Live import: Create or find track subfolder on Google Drive
        const folderName = this.sanitizeName(`${data.artist} - ${data.title}`);
        const trackFolder = await this.retryOperation(() =>
          googleDriveService.findOrCreateFolder(folderName, rootFolderId)
        );

        // 5. Upload original audio bytes (with existing-file check and MD5 verification)
        console.log(`  Uploading/verifying audio file in Drive...`);
        const audioUpload = await this.retryOperation(() =>
          googleDriveService.uploadFile({
            filePath,
            fileName: data.originalFileName,
            mimeType: data.mimeType,
            parentFolderId: trackFolder.id,
          })
        );

        // 6. Upload Artwork (if available)
        let artworkFileId: string | undefined;
        if (data.embeddedArtwork) {
          const ext = data.embeddedArtwork.format.includes('png') ? '.png' : '.jpg';
          const tempArtPath = path.join(env.localImportFolder, `temp_art_${Date.now()}${ext}`);
          fs.writeFileSync(tempArtPath, data.embeddedArtwork.data);

          const artUpload = await this.retryOperation(() =>
            googleDriveService.uploadFile({
              filePath: tempArtPath,
              fileName: `cover${ext}`,
              mimeType: data.embeddedArtwork!.format,
              parentFolderId: trackFolder.id,
            })
          );
          artworkFileId = artUpload.id;
          fs.unlinkSync(tempArtPath);
        } else if (data.externalArtworkPath) {
          const ext = path.extname(data.externalArtworkPath);
          const artUpload = await this.retryOperation(() =>
            googleDriveService.uploadFile({
              filePath: data.externalArtworkPath!,
              fileName: `cover${ext}`,
              mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
              parentFolderId: trackFolder.id,
            })
          );
          artworkFileId = artUpload.id;
        }

        // 7. Upload Lyrics ONLY if verified legitimate (never upload placeholders or empty text)
        let lyricsFileId: string | undefined;
        if (data.lyricsPath && data.lyricsText && metadataService.isValidLyrics(data.lyricsText)) {
          const ext = path.extname(data.lyricsPath);
          const lyricsUpload = await this.retryOperation(() =>
            googleDriveService.uploadFile({
              filePath: data.lyricsPath!,
              fileName: `lyrics${ext}`,
              mimeType: 'text/plain',
              parentFolderId: trackFolder.id,
            })
          );
          lyricsFileId = lyricsUpload.id;
        }

        // 8. Generate and upload metadata.json
        const metadataJson = metadataService.generateMetadataJson(data);
        const metaUpload = await this.retryOperation(() =>
          googleDriveService.uploadJson({
            data: metadataJson,
            fileName: 'metadata.json',
            parentFolderId: trackFolder.id,
          })
        );

        // 9. Post-upload verification for all files
        await this.retryOperation(() => googleDriveService.verifyFile(audioUpload.id));
        if (artworkFileId) {
          await this.retryOperation(() => googleDriveService.verifyFile(artworkFileId!));
        }
        if (lyricsFileId) {
          await this.retryOperation(() => googleDriveService.verifyFile(lyricsFileId!));
        }
        await this.retryOperation(() => googleDriveService.verifyFile(metaUpload.id));

        // 10. Persist manifest immediately so partial failure does not re-upload Drive files
        const entry: ManifestEntry = {
          fileHash: data.fileHash,
          fileName: data.originalFileName,
          title: data.title,
          artist: data.artist,
          driveFolderId: trackFolder.id,
          driveAudioFileId: audioUpload.id,
          importedAt: new Date().toISOString(),
        };
        manifest.set(data.fileHash, entry);
        this.saveManifest(manifest);

        // 11. Record in MongoDB Atlas if connected (safely isolated from Drive/manifest success)
        if (mongoose.connection.readyState === 1) {
          try {
            // If lyrics weren't provided locally, check if lyrics.txt already exists in Drive folder
            if (!data.lyricsText && trackFolder.id) {
              try {
                const driveLyrics = await this.retryOperation(() =>
                  googleDriveService.readLyricsFromFolder(trackFolder.id)
                );
                if (driveLyrics && metadataService.isValidLyrics(driveLyrics)) {
                  data.lyricsText = driveLyrics;
                }
              } catch {
                // Non-fatal fallback
              }
            }

            const updateFields: any = {
              title: data.title,
              artist: data.artist,
              album: data.album,
              year: data.year,
              genre: data.genre,
              trackNumber: data.trackNumber,
              discNumber: data.discNumber,
              durationSeconds: data.durationSeconds,
              codec: data.codec,
              lossless: data.lossless,
              sampleRate: data.sampleRate,
              bitDepth: data.bitDepth,
              bitrate: data.bitrate,
              numberOfChannels: data.numberOfChannels,
              fileHash: data.fileHash,
              originalFileName: data.originalFileName,
              fileSizeBytes: data.fileSizeBytes,
              mimeType: data.mimeType,
              driveFolderId: trackFolder.id,
              driveAudioFileId: audioUpload.id,
              driveArtworkFileId: artworkFileId,
              driveLyricsFileId: lyricsFileId,
              driveMetadataFileId: metaUpload.id,
              hasArtwork: Boolean(artworkFileId),
              missingFields: data.missingFields,
              importedAt: new Date(),
            };

            const updateOps: any = {
              $set: updateFields,
            };

            if (data.lyricsText && metadataService.isValidLyrics(data.lyricsText)) {
              updateOps.$set.lyrics = data.lyricsText;
              updateOps.$set.hasLyrics = true;
            } else {
              updateOps.$setOnInsert = {
                lyrics: null,
                hasLyrics: false,
              };
            }

            const savedTrack = await Track.findOneAndUpdate(
              { fileHash: data.fileHash },
              updateOps,
              { upsert: true, new: true }
            );

            if (savedTrack) {
              try {
                await catalogService.linkTrackToCatalog(savedTrack);
              } catch (linkErr: any) {
                console.warn(`  ⚠️ Catalog linking warning for ${fileName}: ${linkErr.message}`);
              }
            }
          } catch (mongoErr: any) {
            console.warn(`  ⚠️ MongoDB write failed for ${fileName}: ${mongoErr.message}. Google Drive files and manifest entry remain safely preserved.`);
          }
        }

        console.log(`  Imported successfully! (Folder ID: ${trackFolder.id})`);
        report.push({
          fileName,
          title: data.title,
          artist: data.artist,
          status: 'imported',
          codec: data.codec,
          lossless: data.lossless,
          driveFolderId: trackFolder.id,
          driveAudioFileId: audioUpload.id,
        });
      } catch (err: any) {
        console.error(`  Import error for ${fileName}: ${err.message}`);
        report.push({
          fileName,
          title: fileName,
          artist: 'Unknown',
          status: 'failed',
          codec: 'Unknown',
          lossless: false,
          error: err.message,
        });
      }
    }

    return report;
  }

  /**
   * Reads and validates lyrics.txt from a song's Google Drive folder.
   * Rejects empty or placeholder content, preserving original line breaks and verse spacing.
   * Returns valid lyrics string or null if unavailable.
   */
  async importLyricsFromDrive(driveFolderId: string): Promise<string | null> {
    const rawLyrics = await googleDriveService.readLyricsFromFolder(driveFolderId);
    if (!rawLyrics) {
      return null;
    }
    if (metadataService.isValidLyrics(rawLyrics)) {
      return rawLyrics;
    }
    return null;
  }
}

export const musicImporter = new MusicImporter();
