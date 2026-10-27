import fs from 'node:fs';
import path from 'node:path';
import { googleDriveService } from '../services/googleDrive.service.js';

const ROOT_FOLDER_ID = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';

async function verifyLiveStructure() {
  console.log(`\n================================================================`);
  console.log(`🔍 PHASE E: FINAL VERIFICATION AUDIT`);
  console.log(`================================================================`);
  console.log(`Checking Root Folder: ${ROOT_FOLDER_ID}\n`);

  const drive = await googleDriveService.getClient();

  // 1. Check direct children of Root
  const rootChildrenRes = await drive.files.list({
    q: `'${ROOT_FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, parents)',
    pageSize: 100,
    spaces: 'drive',
  });

  const rootChildren = rootChildrenRes.data.files || [];
  console.log(`Total items directly in Root (${ROOT_FOLDER_ID}): ${rootChildren.length}`);

  const looseFiles = rootChildren.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');
  const artistFolders = rootChildren.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');

  console.log(`- Folders directly in root: ${artistFolders.length}`);
  console.log(`- Files directly in root: ${looseFiles.length}`);

  if (looseFiles.length > 0) {
    console.error(`❌ VIOLATION: Found loose files directly in root:`);
    looseFiles.forEach((f) => console.error(`   - ${f.name} (${f.id})`));
  } else {
    console.log(`✅ Zero files directly in root.`);
  }

  // 2. Inspect each artist folder
  const artistHierarchy: any[] = [];
  let totalSongs = 0;
  let totalAudio = 0;
  let totalLyrics = 0;
  let totalMetadata = 0;
  let totalArtwork = 0;
  let totalOthers = 0;
  let hierarchyViolations = 0;

  for (const artist of artistFolders) {
    console.log(`\n📂 Artist: "${artist.name}" [ID: ${artist.id}]`);
    const artistChildrenRes = await drive.files.list({
      q: `'${artist.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, parents)',
      pageSize: 100,
      spaces: 'drive',
    });

    const artistChildren = artistChildrenRes.data.files || [];
    const songFolders = artistChildren.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    const strayArtistFiles = artistChildren.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

    if (strayArtistFiles.length > 0) {
      console.error(`   ❌ VIOLATION: Stray files directly in artist folder "${artist.name}":`);
      strayArtistFiles.forEach((f) => console.error(`      - ${f.name} (${f.id})`));
      hierarchyViolations += strayArtistFiles.length;
    }

    console.log(`   Found ${songFolders.length} song folders:`);

    const songsDetail: any[] = [];
    for (const song of songFolders) {
      totalSongs++;
      // Check assets inside song folder
      const assetsRes = await drive.files.list({
        q: `'${song.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, md5Checksum, parents)',
        pageSize: 50,
        spaces: 'drive',
      });
      const assets = assetsRes.data.files || [];

      let hasAudio = false;
      let hasLyrics = false;
      let hasMetadata = false;
      let hasArtwork = false;

      for (const asset of assets) {
        // verify parent is exactly song.id
        if (!asset.parents || !asset.parents.includes(song.id!)) {
          console.error(`   ❌ VIOLATION: Asset "${asset.name}" parent mismatch! Expected ${song.id}, got ${asset.parents}`);
          hierarchyViolations++;
        }

        const nameLower = (asset.name || '').toLowerCase();
        if (asset.mimeType?.startsWith('audio/') || nameLower.endsWith('.mp3') || nameLower.endsWith('.flac') || nameLower.endsWith('.m4a')) {
          hasAudio = true;
          totalAudio++;
        } else if (nameLower === 'lyrics.txt') {
          hasLyrics = true;
          totalLyrics++;
        } else if (nameLower === 'metadata.json') {
          hasMetadata = true;
          totalMetadata++;
        } else if (nameLower.startsWith('artwork.') || nameLower === 'cover.png' || nameLower === 'cover.jpg') {
          hasArtwork = true;
          totalArtwork++;
        } else {
          totalOthers++;
        }
      }

      console.log(`     🎵 "${song.name}" [ID: ${song.id}] -> Assets: ${assets.length} (Audio: ${hasAudio ? '✅' : '❌'}, Lyrics: ${hasLyrics ? '✅' : '❌'}, Metadata: ${hasMetadata ? '✅' : '❌'}, Artwork: ${hasArtwork ? '✅' : '❌'})`);
      songsDetail.push({
        id: song.id,
        name: song.name,
        assetCount: assets.length,
        hasAudio,
        hasLyrics,
        hasMetadata,
        hasArtwork,
      });
    }

    artistHierarchy.push({
      artistId: artist.id,
      artistName: artist.name,
      songCount: songFolders.length,
      songs: songsDetail,
    });
  }

  console.log(`\n================================================================`);
  console.log(`📋 AUDIT SUMMARY RESULTS`);
  console.log(`================================================================`);
  console.log(`Canonical Artists: ${artistFolders.length}`);
  console.log(`Total Song Folders: ${totalSongs}`);
  console.log(`Total Audio Files: ${totalAudio}`);
  console.log(`Total Lyrics Files: ${totalLyrics}`);
  console.log(`Total Metadata Files: ${totalMetadata}`);
  console.log(`Total Artwork Files: ${totalArtwork}`);
  console.log(`Hierarchy Violations: ${hierarchyViolations}`);

  const report = {
    verifiedAt: new Date().toISOString(),
    rootFolderId: ROOT_FOLDER_ID,
    artistCount: artistFolders.length,
    songCount: totalSongs,
    audioCount: totalAudio,
    lyricsCount: totalLyrics,
    metadataCount: totalMetadata,
    artworkCount: totalArtwork,
    hierarchyViolations,
    artists: artistHierarchy,
  };

  const reportPath = path.resolve(process.cwd(), '../DhunMusicImport/final-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFinal verification report written to: ${reportPath}`);
}

verifyLiveStructure().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
