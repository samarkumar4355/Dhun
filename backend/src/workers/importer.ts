import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { metadataService, type ExtractedTrackData } from '../services/metadata.service.js';
import { googleDriveService, type DriveFolderInfo, type DriveFileInfo } from '../services/googleDrive.service.js';
import { Track } from '../models/track.model.js';
import { catalogService } from '../services/catalog.service.js';
import mongoose from 'mongoose';

export interface ManifestEntry {
  fileHash: string; // SHA-256
  fileName: string;
  title: string;
  artist: string;
  driveArtistFolderId?: string;
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
  driveArtistFolderId?: string;
  driveFolderId?: string;
  driveAudioFileId?: string;
  error?: string;
}

export interface ImportOptions {
  dryRun?: boolean;
  maxTracks?: number; // Default: 10
  confirmAccount?: boolean;
  expectedAccountEmail?: string;
  sourceDir?: string;
  cleanupLocalSourceAfterUpload?: boolean;
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
  sanitizeName(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  }

  /**
   * Generates the canonical song folder name: strictly the song title.
   * Format: <Song Title> (e.g. "Tum Hi Ho", NOT "Tum Hi Ho - Arijit Singh")
   */
  getSongFolderName(title: string, artist?: string): string {
    return this.sanitizeName(title);
  }

  /**
   * Generates the canonical artist folder name directly under library root.
   */
  getArtistFolderName(artist: string): string {
    const { primary } = catalogService.parseArtistNames(artist);
    return this.sanitizeName(primary || artist);
  }

  /**
   * Finds or creates dedicated canonical artist and song folders inside Dhun Music Library.
   * Architecture: Dhun Music Library / <Primary Artist> / <Song Title> / assets
   */
  async findOrCreateArtistAndSongFolders(
    title: string,
    artist: string,
    rootFolderId: string
  ): Promise<{ artistFolder: DriveFolderInfo; songFolder: DriveFolderInfo }> {
    const { primary } = catalogService.parseArtistNames(artist);
    const canonicalArtist = primary || 'Unknown Artist';

    // 1. Find or create canonical artist folder directly under rootFolderId
    const artistFolder = await googleDriveService.findOrCreateArtistFolder(canonicalArtist, rootFolderId);

    // 2. Find or create canonical song folder directly inside the artist folder
    const songFolder = await googleDriveService.findOrCreateSongFolder(title, artistFolder.id, {
      legacySearchParentId: rootFolderId,
      artistName: canonicalArtist,
    });

    return { artistFolder, songFolder };
  }

  /**
   * Finds or creates a dedicated folder per song inside the canonical artist folder.
   * Backward-compatible alias returning the song folder.
   */
  async findOrCreateSongFolder(title: string, artist: string, rootFolderId: string): Promise<DriveFolderInfo> {
    const { songFolder } = await this.findOrCreateArtistAndSongFolders(title, artist, rootFolderId);
    return songFolder;
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
    const audioDir = options.sourceDir || path.join(env.localImportFolder, 'audio');

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
      console.log(`Source audio directory does not exist: ${audioDir}. Skipping local scan.`);
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
        googleDriveService.getLibraryRootFolder(env.driveRootFolderId, env.driveRootFolder)
      );
      rootFolderId = rootFolder.id;
      console.log(`Root Library Folder: "${rootFolder.name}" (ID: ${rootFolderId})\n`);
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
                durationMs: data.durationSeconds ? Math.round(data.durationSeconds * 1000) : 0,
                language: data.language,
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
                driveArtistFolderId: existing.driveArtistFolderId || '',
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
            driveArtistFolderId: existing.driveArtistFolderId,
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

        // 4. Live import: Create or reuse dedicated canonical artist & song folders on Google Drive
        const { artistFolder, songFolder } = await this.retryOperation(() =>
          this.findOrCreateArtistAndSongFolders(data.title, data.artist, rootFolderId)
        );
        const trackFolder = songFolder;

        // 5. Upload original audio bytes (with existing-file check, explicit parentFolderId, and MD5 verification)
        console.log(`  Uploading/verifying audio file in Drive...`);
        const audioUpload = await this.retryOperation(() =>
          googleDriveService.uploadFile({
            filePath,
            fileName: data.originalFileName,
            mimeType: data.mimeType,
            parentFolderId: trackFolder.id,
          })
        );

        // 6. Upload Artwork (if available) - naming: artwork.jpg / artwork.png directly via buffer stream
        let artworkFileId: string | undefined;
        if (data.embeddedArtwork) {
          const ext = data.embeddedArtwork.format.includes('png') ? '.png' : '.jpg';
          const artUpload = await this.retryOperation(() =>
            googleDriveService.uploadBuffer({
              buffer: data.embeddedArtwork!.data,
              fileName: `artwork${ext}`,
              mimeType: data.embeddedArtwork!.format,
              parentFolderId: trackFolder.id,
            })
          );
          artworkFileId = artUpload.id;
        } else if (data.externalArtworkPath) {
          const ext = path.extname(data.externalArtworkPath);
          const artUpload = await this.retryOperation(() =>
            googleDriveService.uploadFile({
              filePath: data.externalArtworkPath!,
              fileName: `artwork${ext}`,
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
        const metadataJson = metadataService.generateMetadataJson(data, {
          artistFolderId: artistFolder.id,
          songFolderId: trackFolder.id,
          audioFileId: audioUpload.id,
          artworkFileId,
          lyricsFileId,
        });
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

        // Discover any pre-existing assets in folder if not set in this upload pass
        if (!artworkFileId && trackFolder.id) {
          const existingArt =
            (await googleDriveService.findFileInFolder('artwork.jpg', trackFolder.id)) ||
            (await googleDriveService.findFileInFolder('artwork.png', trackFolder.id)) ||
            (await googleDriveService.findFileInFolder('cover.jpg', trackFolder.id)) ||
            (await googleDriveService.findFileInFolder('cover.png', trackFolder.id));
          if (existingArt) artworkFileId = existingArt.id;
        }
        if (!lyricsFileId && trackFolder.id) {
          const existingLyrics = await googleDriveService.findFileInFolder('lyrics.txt', trackFolder.id);
          if (existingLyrics) lyricsFileId = existingLyrics.id;
        }

        // 10. Persist manifest immediately so partial failure does not re-upload Drive files
        const entry: ManifestEntry = {
          fileHash: data.fileHash,
          fileName: data.originalFileName,
          title: data.title,
          artist: data.artist,
          driveArtistFolderId: artistFolder.id,
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
              durationMs: data.durationSeconds ? Math.round(data.durationSeconds * 1000) : 0,
              language: data.language,
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
              driveArtistFolderId: artistFolder.id,
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

        // Clean up local source audio if explicitly requested (e.g. temporary staging directory)
        if (options.cleanupLocalSourceAfterUpload && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            if (data.externalArtworkPath && fs.existsSync(data.externalArtworkPath)) {
              fs.unlinkSync(data.externalArtworkPath);
            }
            if (data.lyricsPath && fs.existsSync(data.lyricsPath)) {
              fs.unlinkSync(data.lyricsPath);
            }
            const rawBase = path.basename(filePath, path.extname(filePath));
            const metaFile = path.join(path.dirname(filePath), `${rawBase}.meta.json`);
            if (fs.existsSync(metaFile)) {
              fs.unlinkSync(metaFile);
            }
          } catch (cleanErr: any) {
            console.warn(`  ⚠️ Could not clean up local staged file ${fileName}: ${cleanErr.message}`);
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
          driveArtistFolderId: artistFolder.id,
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
   * Imports a song directly to Google Drive without permanent local disk storage.
   * Can accept a Buffer, Readable stream, remote URL, or an outside temporary file.
   * If a temporary file is used (in os.tmpdir()), it is automatically removed in a finally block.
   * Architecture enforced: Dhun Music Library / Artist Name / Song Title / original_audio.ext
   */
  async importDirectTrack(options: {
    fileName: string;
    audioBuffer?: Buffer;
    audioStream?: Readable;
    audioUrl?: string;
    temporaryFilePath?: string;
    mimeType?: string;
    customMetadata?: {
      title?: string;
      artist?: string;
      album?: string;
      year?: number;
      genre?: string[];
      language?: string;
    };
    lyricsText?: string;
    artworkBuffer?: Buffer;
    artworkFormat?: string;
    confirmAccount?: boolean;
    expectedAccountEmail?: string;
  }): Promise<ImportReportItem> {
    if (options.confirmAccount !== true) {
      throw new Error(`[Account Confirmation Required] Explicit confirmation required before live upload to Google account.`);
    }

    const accountInfo = await googleDriveService.getAccountInfo();
    if (options.expectedAccountEmail && options.expectedAccountEmail.toLowerCase() !== accountInfo.emailAddress?.toLowerCase()) {
      throw new Error(`[Google Account Mismatch] Connected account (${accountInfo.emailAddress}) does not match expected account (${options.expectedAccountEmail}).`);
    }

    const rootFolder = await this.retryOperation(() =>
      googleDriveService.getLibraryRootFolder(env.driveRootFolderId, env.driveRootFolder)
    );

    let ephemeralTempFile: string | null = null;
    try {
      let data: ExtractedTrackData;

      if (options.audioBuffer) {
        data = await metadataService.extractMetadataFromBuffer(options.audioBuffer, options.fileName, options.mimeType);
      } else if (options.temporaryFilePath) {
        const resolved = path.resolve(options.temporaryFilePath);
        const projectRoot = path.resolve(process.cwd());
        if (resolved.startsWith(projectRoot)) {
          throw new Error(`[Security Violation] Temporary files must be created outside the project directory in os.tmpdir(), not in ${resolved}`);
        }
        data = await metadataService.extractMetadata(resolved);
      } else if (options.audioUrl) {
        ephemeralTempFile = path.join(os.tmpdir(), `dhun_temp_${Date.now()}_${options.fileName}`);
        const res = await fetch(options.audioUrl, {
          headers: { 'User-Agent': 'Dhun-Music-Platform/1.0' },
          signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch audio from ${options.audioUrl}: HTTP ${res.status}`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(ephemeralTempFile, buf);
        data = await metadataService.extractMetadata(ephemeralTempFile);
      } else {
        throw new Error(`Either audioBuffer, audioStream, audioUrl, or temporaryFilePath must be provided.`);
      }

      // Apply custom metadata overrides
      if (options.customMetadata) {
        if (options.customMetadata.title) data.title = options.customMetadata.title;
        if (options.customMetadata.artist) data.artist = options.customMetadata.artist;
        if (options.customMetadata.album) data.album = options.customMetadata.album;
        if (options.customMetadata.year) data.year = options.customMetadata.year;
        if (options.customMetadata.genre) data.genre = options.customMetadata.genre;
        if (options.customMetadata.language) data.language = options.customMetadata.language;
      }
      if (options.lyricsText && metadataService.isValidLyrics(options.lyricsText)) {
        data.lyricsText = options.lyricsText;
      }

      // Deduplication check
      const manifest = this.loadManifest();
      if (manifest.has(data.fileHash)) {
        const existing = manifest.get(data.fileHash)!;
        return {
          fileName: options.fileName,
          title: data.title,
          artist: data.artist,
          status: 'skipped_duplicate',
          codec: data.codec,
          lossless: data.lossless,
          driveArtistFolderId: existing.driveArtistFolderId,
          driveFolderId: existing.driveFolderId,
          driveAudioFileId: existing.driveAudioFileId,
        };
      }

      // Resolve canonical folders
      const { artistFolder, songFolder } = await this.retryOperation(() =>
        this.findOrCreateArtistAndSongFolders(data.title, data.artist, rootFolder.id)
      );

      // Upload audio
      let audioUpload: DriveFileInfo;
      if (options.audioBuffer) {
        audioUpload = await this.retryOperation(() =>
          googleDriveService.uploadBuffer({
            buffer: options.audioBuffer!,
            fileName: data.originalFileName,
            mimeType: data.mimeType,
            parentFolderId: songFolder.id,
          })
        );
      } else if (options.audioStream) {
        audioUpload = await this.retryOperation(() =>
          googleDriveService.uploadStream({
            stream: options.audioStream!,
            fileName: data.originalFileName,
            mimeType: data.mimeType,
            parentFolderId: songFolder.id,
          })
        );
      } else {
        const filePath = options.temporaryFilePath || ephemeralTempFile!;
        audioUpload = await this.retryOperation(() =>
          googleDriveService.uploadFile({
            filePath,
            fileName: data.originalFileName,
            mimeType: data.mimeType,
            parentFolderId: songFolder.id,
          })
        );
      }

      // Upload artwork via buffer stream (zero local disk files)
      let artworkFileId: string | undefined;
      if (options.artworkBuffer) {
        const ext = options.artworkFormat?.includes('png') ? '.png' : '.jpg';
        const artUpload = await this.retryOperation(() =>
          googleDriveService.uploadBuffer({
            buffer: options.artworkBuffer!,
            fileName: `artwork${ext}`,
            mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
            parentFolderId: songFolder.id,
          })
        );
        artworkFileId = artUpload.id;
      } else if (data.embeddedArtwork) {
        const ext = data.embeddedArtwork.format.includes('png') ? '.png' : '.jpg';
        const artUpload = await this.retryOperation(() =>
          googleDriveService.uploadBuffer({
            buffer: data.embeddedArtwork!.data,
            fileName: `artwork${ext}`,
            mimeType: data.embeddedArtwork!.format,
            parentFolderId: songFolder.id,
          })
        );
        artworkFileId = artUpload.id;
      }

      // Upload lyrics
      let lyricsFileId: string | undefined;
      if (data.lyricsText && metadataService.isValidLyrics(data.lyricsText)) {
        const lyricsUpload = await this.retryOperation(() =>
          googleDriveService.uploadBuffer({
            buffer: Buffer.from(data.lyricsText!, 'utf8'),
            fileName: 'lyrics.txt',
            mimeType: 'text/plain',
            parentFolderId: songFolder.id,
          })
        );
        lyricsFileId = lyricsUpload.id;
      }

      // Upload metadata.json
      const metadataJson = metadataService.generateMetadataJson(data, {
        artistFolderId: artistFolder.id,
        songFolderId: songFolder.id,
        audioFileId: audioUpload.id,
        artworkFileId,
        lyricsFileId,
      });

      const metaUpload = await this.retryOperation(() =>
        googleDriveService.uploadJson({
          data: metadataJson,
          fileName: 'metadata.json',
          parentFolderId: songFolder.id,
        })
      );

      // Verify assets
      await this.retryOperation(() => googleDriveService.verifyFile(audioUpload.id));
      if (artworkFileId) await this.retryOperation(() => googleDriveService.verifyFile(artworkFileId!));
      if (lyricsFileId) await this.retryOperation(() => googleDriveService.verifyFile(lyricsFileId!));
      await this.retryOperation(() => googleDriveService.verifyFile(metaUpload.id));

      // Save manifest
      const entry: ManifestEntry = {
        fileHash: data.fileHash,
        fileName: data.originalFileName,
        title: data.title,
        artist: data.artist,
        driveArtistFolderId: artistFolder.id,
        driveFolderId: songFolder.id,
        driveAudioFileId: audioUpload.id,
        importedAt: new Date().toISOString(),
      };
      manifest.set(data.fileHash, entry);
      this.saveManifest(manifest);

      // Record in MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const trackDoc = await Track.findOneAndUpdate(
            { fileHash: data.fileHash },
            {
              $set: {
                title: data.title,
                artist: data.artist,
                album: data.album,
                year: data.year,
                genre: data.genre,
                durationSeconds: data.durationSeconds,
                durationMs: data.durationSeconds * 1000,
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
                driveArtistFolderId: artistFolder.id,
                driveFolderId: songFolder.id,
                driveAudioFileId: audioUpload.id,
                driveArtworkFileId: artworkFileId,
                driveLyricsFileId: lyricsFileId,
                driveMetadataFileId: metaUpload.id,
                hasArtwork: Boolean(artworkFileId),
                hasLyrics: Boolean(lyricsFileId),
                lyrics: data.lyricsText || null,
                importedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
          if (trackDoc) {
            await catalogService.linkTrackToCatalog(trackDoc);
          }
        } catch (mongoErr: any) {
          console.warn(`MongoDB write warning for ${options.fileName}: ${mongoErr.message}`);
        }
      }

      return {
        fileName: options.fileName,
        title: data.title,
        artist: data.artist,
        status: 'imported',
        codec: data.codec,
        lossless: data.lossless,
        driveArtistFolderId: artistFolder.id,
        driveFolderId: songFolder.id,
        driveAudioFileId: audioUpload.id,
      };
    } finally {
      // Ephemeral temp files outside the project are GUARANTEED to be unlinked
      if (ephemeralTempFile && fs.existsSync(ephemeralTempFile)) {
        try { fs.unlinkSync(ephemeralTempFile); } catch {}
      }
      if (options.temporaryFilePath && fs.existsSync(options.temporaryFilePath)) {
        try { fs.unlinkSync(options.temporaryFilePath); } catch {}
      }
    }
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
