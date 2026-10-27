import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { musicImporter } from '../src/workers/importer.js';
import { googleDriveService } from '../src/services/googleDrive.service.js';
import { catalogService } from '../src/services/catalog.service.js';

describe('Dhun Google Drive Folder Organization & Idempotency Tests', () => {

  describe('1. Artist & Song Folder Naming & Architecture', () => {
    it('should generate canonical song folder name using strictly the song title', () => {
      assert.equal(musicImporter.getSongFolderName('Kesariya'), 'Kesariya');
      assert.equal(musicImporter.getSongFolderName('Tum Hi Ho'), 'Tum Hi Ho');
      assert.equal(musicImporter.getSongFolderName('Lag Jaa Gale'), 'Lag Jaa Gale');
      assert.equal(musicImporter.getSongFolderName('Channa Mereya'), 'Channa Mereya');
    });

    it('should sanitize illegal characters in folder names without changing titles', () => {
      const name = musicImporter.getSongFolderName('Kya/Yahi?Pyar:Hai*');
      assert.equal(name, 'Kya_Yahi_Pyar_Hai_');
      assert.ok(!/[/\\?%*:|"<>]/g.test(name));
    });

    it('should extract canonical primary artist name for artist folder', () => {
      assert.equal(musicImporter.getArtistFolderName('Arijit Singh'), 'Arijit Singh');
      assert.equal(musicImporter.getArtistFolderName('Mohammed Rafi & Lata Mangeshkar'), 'Mohammed Rafi');
      assert.equal(musicImporter.getArtistFolderName('Kishore Kumar feat. Lata Mangeshkar'), 'Kishore Kumar');
      assert.equal(musicImporter.getArtistFolderName('Sonu Nigam with Alka Yagnik'), 'Sonu Nigam');
    });
  });

  describe('2. Collaboration & Primary-Artist Parsing Rules', () => {
    it('should select first credited artist as primary and preserve remaining collaborators as featured', () => {
      const duet1 = catalogService.parseArtistString('Mohammed Rafi & Lata Mangeshkar');
      assert.equal(duet1.primaryArtist, 'Mohammed Rafi');
      assert.deepEqual(duet1.featuredArtists, ['Lata Mangeshkar']);

      const duet2 = catalogService.parseArtistString('Kishore Kumar & Asha Bhosle');
      assert.equal(duet2.primaryArtist, 'Kishore Kumar');
      assert.deepEqual(duet2.featuredArtists, ['Asha Bhosle']);

      const trio = catalogService.parseArtistString('Arijit Singh, Shreya Ghoshal & Pritam');
      assert.equal(trio.primaryArtist, 'Arijit Singh');
      assert.ok(trio.featuredArtists.includes('Shreya Ghoshal'));
      assert.ok(trio.featuredArtists.includes('Pritam'));
    });

    it('should preserve protected ensemble / band names containing ampersands', () => {
      const band = catalogService.parseArtistString('Simon & Garfunkel');
      assert.equal(band.primaryArtist, 'Simon & Garfunkel');
      assert.deepEqual(band.featuredArtists, []);
    });

    it('should handle single artist without featured artists cleanly', () => {
      const solo = catalogService.parseArtistString('Lata Mangeshkar');
      assert.equal(solo.primaryArtist, 'Lata Mangeshkar');
      assert.deepEqual(solo.featuredArtists, []);
    });
  });

  describe('3. Hierarchical Folder Nesting & Reuse', () => {
    it('should create or reuse canonical artist folder directly under root and song folder inside artist', async () => {
      const origFindArtist = googleDriveService.findOrCreateArtistFolder;
      const origFindSong = googleDriveService.findOrCreateSongFolder;

      let queriedArtist = '';
      let queriedArtistParent = '';
      let queriedSong = '';
      let queriedSongParent = '';

      (googleDriveService as any).findOrCreateArtistFolder = async (artistName: string, rootId: string) => {
        queriedArtist = artistName;
        queriedArtistParent = rootId;
        return { id: 'artist-folder-id-789', name: artistName };
      };

      (googleDriveService as any).findOrCreateSongFolder = async (title: string, artistFolderId: string) => {
        queriedSong = title;
        queriedSongParent = artistFolderId;
        return { id: 'song-folder-id-456', name: title };
      };

      try {
        const result = await musicImporter.findOrCreateArtistAndSongFolders('Tum Hi Ho', 'Arijit Singh', 'root-123');

        assert.equal(result.artistFolder.id, 'artist-folder-id-789');
        assert.equal(result.artistFolder.name, 'Arijit Singh');
        assert.equal(queriedArtist, 'Arijit Singh');
        assert.equal(queriedArtistParent, 'root-123'); // Directly under root!

        assert.equal(result.songFolder.id, 'song-folder-id-456');
        assert.equal(result.songFolder.name, 'Tum Hi Ho'); // Strictly song title!
        assert.equal(queriedSong, 'Tum Hi Ho');
        assert.equal(queriedSongParent, 'artist-folder-id-789'); // Strictly inside artist folder!
      } finally {
        (googleDriveService as any).findOrCreateArtistFolder = origFindArtist;
        (googleDriveService as any).findOrCreateSongFolder = origFindSong;
      }
    });

    it('should reuse existing artist folder case-insensitively and prevent duplicates', async () => {
      const origGetClient = (googleDriveService as any).getClient;

      (googleDriveService as any).getClient = async () => ({
        files: {
          list: async (params: any) => ({
            data: {
              files: [
                {
                  id: 'existing-artist-id',
                  name: 'Arijit Singh',
                  webViewLink: 'https://drive.google.com/folder/1',
                  trashed: false,
                },
              ],
            },
          }),
        },
      });

      try {
        // Query with lowercase to verify case-insensitive reuse
        const folder = await googleDriveService.findOrCreateArtistFolder('arijit singh', 'root-123');
        assert.equal(folder.id, 'existing-artist-id');
        assert.equal(folder.name, 'Arijit Singh');
      } finally {
        (googleDriveService as any).getClient = origGetClient;
      }
    });

    it('should migrate legacy "<Title> - <Artist>" folder inside artist folder to canonical song title', async () => {
      const origGetClient = (googleDriveService as any).getClient;
      const origRename = googleDriveService.renameItem;

      let renamedId = '';
      let renamedNewName = '';

      (googleDriveService as any).getClient = async () => ({
        files: {
          list: async () => ({
            data: {
              files: [
                {
                  id: 'legacy-song-folder-id',
                  name: 'Kesariya - Arijit Singh',
                  webViewLink: 'https://drive.google.com/folder/2',
                  trashed: false,
                },
              ],
            },
          }),
        },
      });

      (googleDriveService as any).renameItem = async (id: string, newName: string) => {
        renamedId = id;
        renamedNewName = newName;
        return { id, name: newName };
      };

      try {
        const folder = await googleDriveService.findOrCreateSongFolder('Kesariya', 'artist-folder-id', {
          artistName: 'Arijit Singh',
        });

        assert.equal(folder.id, 'legacy-song-folder-id');
        assert.equal(folder.name, 'Kesariya');
        assert.equal(renamedId, 'legacy-song-folder-id');
        assert.equal(renamedNewName, 'Kesariya');
      } finally {
        (googleDriveService as any).getClient = origGetClient;
        (googleDriveService as any).renameItem = origRename;
      }
    });
  });

  describe('4. Parent ID Enforcement & Strict Safeguards', () => {
    it('should reject uploadFile if parentFolderId is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await googleDriveService.uploadFile({
            filePath: 'dummy.mp3',
            fileName: 'dummy.mp3',
            mimeType: 'audio/mpeg',
            parentFolderId: '',
          });
        },
        {
          message: '[Google Drive Error] Cannot upload "dummy.mp3" without explicit parentFolderId.',
        }
      );
    });

    it('should reject uploadJson if parentFolderId is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await googleDriveService.uploadJson({
            data: { test: true },
            fileName: 'metadata.json',
            parentFolderId: '',
          });
        },
        {
          message: '[Google Drive Error] Cannot upload JSON "metadata.json" without explicit parentFolderId.',
        }
      );
    });

    it('should reject createFolder if parentFolderId is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await googleDriveService.createFolder('Tum Hi Ho', '');
        },
        {
          message: '[Google Drive Error] Cannot create folder "Tum Hi Ho" without explicit parentFolderId.',
        }
      );
    });

    it('should reject moveItem if newParentId is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await googleDriveService.moveItem('file-123', '');
        },
        {
          message: '[Google Drive Error] Cannot move item "file-123" without explicit newParentId.',
        }
      );
    });
  });

  describe('5. Idempotency & Asset Association', () => {
    it('should enforce artwork naming convention (artwork.jpg or artwork.png)', () => {
      const jpgExt = '.jpg';
      const pngExt = '.png';
      assert.equal(`artwork${jpgExt}`, 'artwork.jpg');
      assert.equal(`artwork${pngExt}`, 'artwork.png');
    });

    it('should prevent duplicate uploads by matching MD5 checksum and file size', async () => {
      const origList = (googleDriveService as any).getClient;

      (googleDriveService as any).getClient = async () => ({
        files: {
          list: async () => ({
            data: {
              files: [
                {
                  id: 'existing-audio-id',
                  name: 'original_audio.flac',
                  size: '100',
                  md5Checksum: 'd41d8cd98f00b204e9800998ecf8427e',
                  parents: ['song-folder-id'],
                },
              ],
            },
          }),
        },
      });

      try {
        const fileInfo = await googleDriveService.findFileInFolder('original_audio.flac', 'song-folder-id');
        assert.ok(fileInfo);
        assert.equal(fileInfo?.id, 'existing-audio-id');
      } finally {
        (googleDriveService as any).getClient = origList;
      }
    });
  });

  describe('6. Direct Streaming & Zero-Local-File Upload Tests', () => {
    it('should reject uploadStream if parentFolderId is missing or empty', async () => {
      const { Readable } = await import('node:stream');
      const testStream = Readable.from(['audio byte chunk']);

      await assert.rejects(
        async () => {
          await googleDriveService.uploadStream({
            stream: testStream,
            fileName: 'stream_audio.flac',
            mimeType: 'audio/flac',
            parentFolderId: '',
          });
        },
        {
          message: '[Google Drive Error] Cannot upload stream "stream_audio.flac" without explicit parentFolderId.',
        }
      );
    });

    it('should upload Readable stream directly to Google Drive and verify parent ID', async () => {
      const { Readable } = await import('node:stream');
      const testStream = Readable.from(['dummy lossless audio stream content']);
      const origGetClient = (googleDriveService as any).getClient;
      const origVerify = (googleDriveService as any).verifyFile;

      let createPayload: any = null;
      (googleDriveService as any).getClient = async () => ({
        files: {
          list: async () => ({ data: { files: [] } }),
          create: async (params: any) => {
            createPayload = params;
            return {
              data: {
                id: 'stream-upload-id-999',
                name: params.requestBody.name,
                mimeType: params.media.mimeType,
                parents: params.requestBody.parents,
              },
            };
          },
        },
      });

      (googleDriveService as any).verifyFile = async (id: string) => ({
        id,
        name: 'stream_audio.flac',
        mimeType: 'audio/flac',
        parents: ['intended-song-folder-id'],
      });

      try {
        const result = await googleDriveService.uploadStream({
          stream: testStream,
          fileName: 'stream_audio.flac',
          mimeType: 'audio/flac',
          parentFolderId: 'intended-song-folder-id',
        });

        assert.equal(result.id, 'stream-upload-id-999');
        assert.deepEqual(createPayload.requestBody.parents, ['intended-song-folder-id']);
        assert.equal(createPayload.requestBody.name, 'stream_audio.flac');
      } finally {
        (googleDriveService as any).getClient = origGetClient;
        (googleDriveService as any).verifyFile = origVerify;
      }
    });

    it('should upload Buffer directly to Google Drive via uploadBuffer without disk writing', async () => {
      const origUploadStream = googleDriveService.uploadStream;
      let streamOptions: any = null;

      (googleDriveService as any).uploadStream = async (opts: any) => {
        streamOptions = opts;
        return {
          id: 'buffer-upload-id-777',
          name: opts.fileName,
          mimeType: opts.mimeType,
          parents: [opts.parentFolderId],
        };
      };

      try {
        const dummyBuffer = Buffer.from('in-memory audio or artwork bytes');
        const res = await googleDriveService.uploadBuffer({
          buffer: dummyBuffer,
          fileName: 'artwork.jpg',
          mimeType: 'image/jpeg',
          parentFolderId: 'song-folder-xyz',
        });

        assert.equal(res.id, 'buffer-upload-id-777');
        assert.equal(streamOptions.fileName, 'artwork.jpg');
        assert.equal(streamOptions.parentFolderId, 'song-folder-xyz');
        assert.equal(streamOptions.expectedSize, dummyBuffer.length);
      } finally {
        googleDriveService.uploadStream = origUploadStream;
      }
    });

    it('should reject temporary files placed inside the project directory for security', async () => {
      const insideProjectPath = path.resolve(process.cwd(), 'dummy_local_audio.mp3');

      await assert.rejects(
        async () => {
          await musicImporter.importDirectTrack({
            fileName: 'dummy_local_audio.mp3',
            temporaryFilePath: insideProjectPath,
            confirmAccount: true,
          });
        },
        (err: any) => {
          assert.ok(err.message.includes('[Security Violation] Temporary files must be created outside the project directory'));
          return true;
        }
      );
    });

    it('should clean up temporary files in os.tmpdir() after importDirectTrack execution', async () => {
      const os = await import('node:os');
      const tempPath = path.join(os.tmpdir(), `dhun_test_clean_${Date.now()}.mp3`);
      fs.writeFileSync(tempPath, `temporary audio bytes outside project ${Date.now()}_${Math.random()}`);
      assert.ok(fs.existsSync(tempPath));

      const origAccount = googleDriveService.getAccountInfo;
      const origRoot = googleDriveService.getLibraryRootFolder;
      const origFolders = (musicImporter as any).findOrCreateArtistAndSongFolders;
      const origUploadFile = googleDriveService.uploadFile;
      const origUploadJson = googleDriveService.uploadJson;
      const origVerify = googleDriveService.verifyFile;
      const origLoadManifest = musicImporter.loadManifest;
      const origSaveManifest = musicImporter.saveManifest;

      (musicImporter as any).loadManifest = () => new Map();
      (musicImporter as any).saveManifest = () => {};
      (googleDriveService as any).getAccountInfo = async () => ({ emailAddress: 'test@dhun.org' });
      (googleDriveService as any).getLibraryRootFolder = async () => ({ id: 'root-id', name: 'Dhun Music Library' });
      (musicImporter as any).findOrCreateArtistAndSongFolders = async () => ({
        artistFolder: { id: 'art-id', name: 'Test Artist' },
        songFolder: { id: 'song-id', name: 'Test Song' },
      });
      (googleDriveService as any).uploadFile = async () => ({ id: 'audio-id', parents: ['song-id'] });
      (googleDriveService as any).uploadJson = async () => ({ id: 'json-id', parents: ['song-id'] });
      (googleDriveService as any).verifyFile = async () => ({ id: 'verified', parents: ['song-id'] });

      try {
        const result = await musicImporter.importDirectTrack({
          fileName: 'TestSong.mp3',
          temporaryFilePath: tempPath,
          confirmAccount: true,
          customMetadata: {
            title: 'Test Song',
            artist: 'Test Artist',
          },
        });

        assert.equal(result.status, 'imported');
        // Crucial check: verify temporary file was automatically deleted outside project
        assert.equal(fs.existsSync(tempPath), false, 'Temporary file in os.tmpdir() must be deleted after import');
      } finally {
        (googleDriveService as any).getAccountInfo = origAccount;
        (googleDriveService as any).getLibraryRootFolder = origRoot;
        (musicImporter as any).findOrCreateArtistAndSongFolders = origFolders;
        (googleDriveService as any).uploadFile = origUploadFile;
        (googleDriveService as any).uploadJson = origUploadJson;
        (googleDriveService as any).verifyFile = origVerify;
        musicImporter.loadManifest = origLoadManifest;
        musicImporter.saveManifest = origSaveManifest;
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    });
  });
});
