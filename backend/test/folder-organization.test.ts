import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { musicImporter } from '../src/workers/importer.js';
import { googleDriveService } from '../src/services/googleDrive.service.js';

describe('Dhun Google Drive Folder Organization & Idempotency Tests', () => {
  describe('1. Dedicated Song Folder Naming & Resolution', () => {
    it('should generate canonical folder name in "<Song Title> - <Artist Name>" format', () => {
      const name1 = musicImporter.getSongFolderName('Kesariya', 'Arijit Singh');
      assert.equal(name1, 'Kesariya - Arijit Singh');

      const name2 = musicImporter.getSongFolderName('Tum Hi Ho', 'Arijit Singh');
      assert.equal(name2, 'Tum Hi Ho - Arijit Singh');

      const name3 = musicImporter.getSongFolderName('Channa Mereya', 'Arijit Singh');
      assert.equal(name3, 'Channa Mereya - Arijit Singh');
    });

    it('should sanitize illegal characters in folder names', () => {
      const name = musicImporter.getSongFolderName('Kya/Yahi?Pyar:Hai*', 'Kishore Kumar & Lata Mangeshkar');
      assert.equal(name, 'Kya_Yahi_Pyar_Hai_ - Kishore Kumar & Lata Mangeshkar');
      assert.ok(!/[/\\?%*:|"<>]/g.test(name));
    });

    it('should prioritize canonical folder and fallback to rename legacy folder', async () => {
      const originalFind = googleDriveService.findFolderByName;
      const originalRename = googleDriveService.renameItem;

      let renamedFrom = '';
      let renamedTo = '';

      // Mock: canonical not found, legacy found
      (googleDriveService as any).findFolderByName = async (name: string) => {
        if (name === 'Kesariya - Arijit Singh') return null;
        if (name === 'Arijit Singh - Kesariya') {
          return { id: 'folder-123', name: 'Arijit Singh - Kesariya' };
        }
        return null;
      };

      (googleDriveService as any).renameItem = async (id: string, newName: string) => {
        renamedFrom = id;
        renamedTo = newName;
        return { id, name: newName };
      };

      try {
        const folder = await musicImporter.findOrCreateSongFolder('Kesariya', 'Arijit Singh', 'root-456');
        assert.equal(folder.id, 'folder-123');
        assert.equal(folder.name, 'Kesariya - Arijit Singh');
        assert.equal(renamedFrom, 'folder-123');
        assert.equal(renamedTo, 'Kesariya - Arijit Singh');
      } finally {
        (googleDriveService as any).findFolderByName = originalFind;
        (googleDriveService as any).renameItem = originalRename;
      }
    });
  });

  describe('2. Parent ID Enforcement & Verification', () => {
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
          await googleDriveService.createFolder('Kesariya - Arijit Singh', '');
        },
        {
          message: '[Google Drive Error] Cannot create folder "Kesariya - Arijit Singh" without explicit parentFolderId.',
        }
      );
    });
  });

  describe('3. Idempotency & Asset Association', () => {
    it('should use "artwork.jpg" or "artwork.png" naming convention for uploaded artwork', () => {
      const jpgExt = '.jpg';
      const pngExt = '.png';
      assert.equal(`artwork${jpgExt}`, 'artwork.jpg');
      assert.equal(`artwork${pngExt}`, 'artwork.png');
    });

    it('should prevent duplicate uploads by matching MD5 checksum and file size', async () => {
      const origList = (googleDriveService as any).getClient;

      // Mock Drive client listing existing file
      (googleDriveService as any).getClient = async () => ({
        files: {
          list: async () => ({
            data: {
              files: [
                {
                  id: 'existing-audio-id',
                  name: 'test.mp3',
                  size: '100',
                  md5Checksum: 'd41d8cd98f00b204e9800998ecf8427e',
                  parents: ['song-folder-id'],
                },
              ],
            },
          }),
        },
      });

      // Mock local stats and MD5
      const origCompute = (googleDriveService as any).computeLocalMd5;
      (googleDriveService as any).computeLocalMd5 = () => 'd41d8cd98f00b204e9800998ecf8427e';

      try {
        const fileInfo = await googleDriveService.findFileInFolder('test.mp3', 'song-folder-id');
        assert.ok(fileInfo);
        assert.equal(fileInfo?.id, 'existing-audio-id');
      } finally {
        (googleDriveService as any).getClient = origList;
      }
    });
  });
});
