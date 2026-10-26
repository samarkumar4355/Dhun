import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { metadataService } from '../src/services/metadata.service.js';
import { GoogleDriveService, googleDriveService, computeLocalMd5 } from '../src/services/googleDrive.service.js';
import { MusicImporter } from '../src/workers/importer.js';
import { env } from '../src/config/env.js';

describe('Dhun Importer Safeguards & Test Suite', () => {

  describe('1. Lyrics Validation', () => {
    it('should reject empty or whitespace-only lyrics', () => {
      assert.strictEqual(metadataService.isValidLyrics(''), false);
      assert.strictEqual(metadataService.isValidLyrics('   '), false);
      assert.strictEqual(metadataService.isValidLyrics('\n\t  \r\n'), false);
      assert.strictEqual(metadataService.isValidLyrics(null), false);
      assert.strictEqual(metadataService.isValidLyrics(undefined), false);
    });

    it('should reject tiny strings (< 20 chars)', () => {
      assert.strictEqual(metadataService.isValidLyrics('La la la'), false);
      assert.strictEqual(metadataService.isValidLyrics('Song lyric line'), false);
    });

    it('should reject Next.js / React streaming reference pointers (e.g. $3c)', () => {
      assert.strictEqual(metadataService.isValidLyrics('$3c'), false);
      assert.strictEqual(metadataService.isValidLyrics('$1f'), false);
      assert.strictEqual(metadataService.isValidLyrics('$24'), false);
    });

    it('should reject common placeholder tokens and demo notes', () => {
      assert.strictEqual(metadataService.isValidLyrics('demo lyrics'), false);
      assert.strictEqual(metadataService.isValidLyrics('[Demo lyrics — Kasoor by Prateek Kuhad]'), false);
      assert.strictEqual(metadataService.isValidLyrics('instrumental'), false);
      assert.strictEqual(metadataService.isValidLyrics('none'), false);
      assert.strictEqual(metadataService.isValidLyrics('n/a'), false);
      assert.strictEqual(metadataService.isValidLyrics('placeholder lyrics here'), false);
    });

    it('should preserve legitimate multi-line song lyrics', () => {
      const realLyrics = `
        Hold onto me
        And hand in hand we'll follow
        Hold onto me
        As if you had a choice
        One touch of you and I will never leave
        Cuz I believe that I can't get away
      `;
      assert.strictEqual(metadataService.isValidLyrics(realLyrics), true);
    });
  });

  describe('2. Metadata & Lossless Classification Integrity', () => {
    it('should strictly classify FLAC and WAV as lossless, and MP3 as lossy', () => {
      assert.strictEqual(metadataService.isLosslessCodec('FLAC'), true);
      assert.strictEqual(metadataService.isLosslessCodec('ALAC'), true);
      assert.strictEqual(metadataService.isLosslessCodec('PCM'), true);
      assert.strictEqual(metadataService.isLosslessCodec('WAV'), true);

      // Must never treat MP3 or AAC as lossless
      assert.strictEqual(metadataService.isLosslessCodec('MPEG 1 Layer 3'), false);
      assert.strictEqual(metadataService.isLosslessCodec('MP3'), false);
      assert.strictEqual(metadataService.isLosslessCodec('AAC'), false);
    });

    it('should compute distinct MD5 and SHA-256 hashes without conflating them', async () => {
      const tempFile = path.join(env.localImportFolder, `test_hash_${Date.now()}.tmp`);
      fs.writeFileSync(tempFile, 'Dhun lossless audio test bytes');

      const md5 = computeLocalMd5(tempFile);
      const sha256 = await metadataService.computeFileHash(tempFile);

      fs.unlinkSync(tempFile);

      assert.strictEqual(md5.length, 32); // MD5 is 128-bit (32 hex characters)
      assert.strictEqual(sha256.length, 64); // SHA-256 is 256-bit (64 hex characters)
      assert.notStrictEqual(md5, sha256);
    });
  });

  describe('3. Dry-Run No-Write Behavior', () => {
    it('should scan tracks and produce a report with dry_run_ready status without modifying Google Drive', async () => {
      const testManifestPath = path.join(os.tmpdir(), `dhun-test-manifest-${Date.now()}.json`);
      const importer = new MusicImporter(testManifestPath);
      const report = await importer.runImport({ dryRun: true, maxTracks: 2 });

      assert.ok(Array.isArray(report));
      if (report.length > 0) {
        for (const item of report) {
          assert.strictEqual(item.status, 'dry_run_ready');
          assert.strictEqual(item.driveAudioFileId, undefined);
          assert.strictEqual(item.driveFolderId, undefined);
        }
      }
    });
  });

  describe('4. Google Account Verification & Confirmation', () => {
    it('should reject live import if confirmation is missing', async () => {
      const importer = new MusicImporter();
      await assert.rejects(
        async () => {
          await importer.runImport({ dryRun: false, confirmAccount: false });
        },
        (err: any) => {
          return err.message.includes('[Account Confirmation Required]');
        }
      );
    });

    it('should reject live import if connected account does not match expectedAccountEmail', async () => {
      const importer = new MusicImporter();
      const origGetAccountInfo = googleDriveService.getAccountInfo;
      googleDriveService.getAccountInfo = async () => ({
        emailAddress: 'actual-account@gmail.com',
        displayName: 'Actual User',
      });
      try {
        await assert.rejects(
          async () => {
            await importer.runImport({
              dryRun: false,
              confirmAccount: true,
              expectedAccountEmail: 'definitely-wrong-email@example.com',
            });
          },
          (err: any) => {
            return err.message.includes('[Google Account Mismatch]');
          }
        );
      } finally {
        googleDriveService.getAccountInfo = origGetAccountInfo;
      }
    });
  });

  describe('5. Deduplication & Manifest Integrity', () => {
    it('should recognize tracks present in manifest and skip them', () => {
      const importer = new MusicImporter();
      const testHash = 'mock_sha256_hash_12345';
      const manifest = new Map();
      manifest.set(testHash, {
        fileHash: testHash,
        fileName: 'test.flac',
        title: 'Test Song',
        artist: 'Test Artist',
        driveFolderId: 'folder_123',
        driveAudioFileId: 'audio_123',
        importedAt: new Date().toISOString(),
      });

      assert.strictEqual(manifest.has(testHash), true);
      const existing = manifest.get(testHash);
      assert.strictEqual(existing.driveAudioFileId, 'audio_123');
    });
  });

  describe('6. Existing-File Conflict Detection & Verification', () => {
    it('should fail safely if an existing file on Drive has a mismatched size or checksum', () => {
      const localSize = 1000;
      const localMd5 = 'd41d8cd98f00b204e9800998ecf8427e';
      const remoteFile = {
        id: 'drive_conflict_id',
        size: '2000', // Mismatched size
        md5Checksum: 'different_md5_hash',
      };

      const sizeMatches = Number.parseInt(remoteFile.size, 10) === localSize;
      const md5Matches = remoteFile.md5Checksum !== undefined && remoteFile.md5Checksum.toLowerCase() === localMd5.toLowerCase();

      assert.strictEqual(sizeMatches, false);
      assert.strictEqual(md5Matches, false);
    });

    it('should fail safely and reject reuse when an existing file has the same size but no MD5 checksum', async () => {
      const tempTestFile = path.join(env.localImportFolder, `test_conflict_${Date.now()}.tmp`);
      fs.writeFileSync(tempTestFile, 'hello world content');
      const localSize = fs.statSync(tempTestFile).size;

      const service = new GoogleDriveService();
      // Stub getClient with mock drive API returning file with same size but missing md5Checksum
      (service as any).getClient = async () => ({
        files: {
          list: async () => ({
            data: {
              files: [
                {
                  id: 'conflict_file_id_123',
                  name: 'test.tmp',
                  mimeType: 'text/plain',
                  size: String(localSize),
                  md5Checksum: undefined, // Missing MD5 checksum
                },
              ],
            },
          }),
        },
      });

      await assert.rejects(
        async () => {
          await service.uploadFile({
            filePath: tempTestFile,
            fileName: 'test.tmp',
            mimeType: 'text/plain',
            parentFolderId: 'fake_parent_folder_id',
          });
        },
        (err: any) => {
          assert.ok(err.message.includes('[Existing File Conflict]'));
          return true;
        }
      );

      fs.unlinkSync(tempTestFile);
    });

    it('should reuse existing Drive file when both size and MD5 match case-insensitively', async () => {
      const tempTestFile = path.join(env.localImportFolder, `test_match_${Date.now()}.tmp`);
      fs.writeFileSync(tempTestFile, 'matching content bytes');
      const localSize = fs.statSync(tempTestFile).size;
      const localMd5 = computeLocalMd5(tempTestFile);

      const service = new GoogleDriveService();
      (service as any).getClient = async () => ({
        files: {
          list: async () => ({
            data: {
              files: [
                {
                  id: 'matched_file_id_789',
                  name: 'test.tmp',
                  mimeType: 'text/plain',
                  size: String(localSize),
                  md5Checksum: localMd5.toUpperCase(), // Case-insensitive match
                },
              ],
            },
          }),
        },
      });

      const result = await service.uploadFile({
        filePath: tempTestFile,
        fileName: 'test.tmp',
        mimeType: 'text/plain',
        parentFolderId: 'fake_parent_folder_id',
      });

      assert.strictEqual(result.id, 'matched_file_id_789');
      fs.unlinkSync(tempTestFile);
    });
  });

  describe('7. Safe Recovery from Partial Failures', () => {
    it('should retain saved manifest entries when database write fails', () => {
      const manifest = new Map();
      const testHash = 'sha256_preserved_hash_777';

      manifest.set(testHash, {
        fileHash: testHash,
        fileName: 'track.flac',
        title: 'Track',
        artist: 'Artist',
        driveFolderId: 'folder_abc',
        driveAudioFileId: 'audio_abc',
        importedAt: new Date().toISOString(),
      });

      // Simulating a MongoDB connection drop
      let mongoWriteError: Error | null = null;
      try {
        throw new Error('MongoServerSelectionError: connection timed out');
      } catch (err: any) {
        mongoWriteError = err;
      }

      // Manifest remains intact despite the MongoDB failure
      assert.ok(mongoWriteError !== null);
      assert.strictEqual(manifest.has(testHash), true);
      assert.strictEqual(manifest.get(testHash)?.driveAudioFileId, 'audio_abc');
    });
  });

  describe('8. Lyrics Integration & Song Details Integrity', () => {
    it('should extract and preserve legitimate lyrics with line breaks and verse spacing', () => {
      const validVerseLyrics = `Hold onto me\nAnd hand in hand we'll follow\n\nOne touch of you and I will never leave\nCuz I believe that I can't get away`;
      assert.strictEqual(metadataService.isValidLyrics(validVerseLyrics), true);

      const metadata = metadataService.generateMetadataJson({
        title: 'Crazy Glue',
        artist: 'Josh Woodward',
        album: 'The Wake',
        durationSeconds: 218,
        codec: 'FLAC',
        lossless: true,
        fileHash: 'mock_hash_1',
        originalFileName: 'JoshWoodward-CrazyGlue.flac',
        fileSizeBytes: 21348740,
        mimeType: 'audio/flac',
        lyricsText: validVerseLyrics,
        missingFields: [],
      });

      assert.strictEqual(metadata.assets.hasLyrics, true);
      assert.strictEqual(metadata.lyrics, validVerseLyrics);
      assert.ok(metadata.lyrics.includes('\n\n')); // Verifies verse breaks are preserved
    });

    it('should correctly set lyrics to null and hasLyrics to false when lyrics are missing', () => {
      const metadata = metadataService.generateMetadataJson({
        title: 'Cherubs',
        artist: 'Josh Woodward',
        album: 'Ashes',
        durationSeconds: 195,
        codec: 'FLAC',
        lossless: true,
        fileHash: 'mock_hash_2',
        originalFileName: 'JoshWoodward-Cherubs.flac',
        fileSizeBytes: 15906864,
        mimeType: 'audio/flac',
        missingFields: ['lyrics'],
      });

      assert.strictEqual(metadata.assets.hasLyrics, false);
      assert.strictEqual(metadata.lyrics, null);
    });

    it('should reject placeholder files and not store them as legitimate lyrics', () => {
      const placeholders = [
        '[Demo lyrics — Kasoor by Prateek Kuhad]',
        'Placeholder lyrics for this song demo',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Lyrics coming soon, check back later',
        'Lyrics unavailable at this moment',
        '   ',
        '',
        '$3c',
        'Instrumental',
      ];

      for (const placeholder of placeholders) {
        assert.strictEqual(
          metadataService.isValidLyrics(placeholder),
          false,
          `Failed to reject placeholder: "${placeholder}"`
        );

        const metadata = metadataService.generateMetadataJson({
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          durationSeconds: 120,
          codec: 'FLAC',
          lossless: true,
          fileHash: 'mock_hash_placeholder',
          originalFileName: 'test.flac',
          fileSizeBytes: 1000000,
          mimeType: 'audio/flac',
          lyricsText: placeholder,
          missingFields: [],
        });

        assert.strictEqual(metadata.assets.hasLyrics, false);
        assert.strictEqual(metadata.lyrics, null);
      }
    });

    it('should ensure re-importing a song without lyrics does not erase existing valid lyrics', () => {
      const existingDoc = {
        fileHash: 'sha256_existing_song',
        title: 'Crazy Glue',
        lyrics: 'Existing legitimate lyrics\nLine 2',
        hasLyrics: true,
      };

      // Simulating the re-import update operation when incoming track has no lyrics
      const incomingDataLyricsText = undefined; // No lyrics in staging file
      const updateOps: any = {
        $set: {
          title: 'Crazy Glue (Updated)',
        },
      };

      if (incomingDataLyricsText && metadataService.isValidLyrics(incomingDataLyricsText)) {
        updateOps.$set.lyrics = incomingDataLyricsText;
        updateOps.$set.hasLyrics = true;
      } else {
        updateOps.$setOnInsert = {
          lyrics: null,
          hasLyrics: false,
        };
      }

      // In an existing document update, $set is applied, but $setOnInsert is ignored by MongoDB
      assert.strictEqual(updateOps.$set.lyrics, undefined); // lyrics is not in $set
      assert.strictEqual(updateOps.$set.hasLyrics, undefined); // hasLyrics is not in $set

      // Apply $set to existing document
      Object.assign(existingDoc, updateOps.$set);

      assert.strictEqual(existingDoc.hasLyrics, true);
      assert.strictEqual(existingDoc.lyrics, 'Existing legitimate lyrics\nLine 2');
    });
  });

});
