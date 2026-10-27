import fs from 'node:fs';
import path from 'node:path';
import { googleDriveService } from '../services/googleDrive.service.js';
import { catalogService } from '../services/catalog.service.js';
import { connectDatabase } from '../config/database.js';
import { Track } from '../models/track.model.js';
import { Artist } from '../models/artist.model.js';
import mongoose from 'mongoose';

const ROOT_FOLDER_ID = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';

export interface DryRunPlanItem {
  index: number;
  currentFolderId: string;
  currentFolderName: string;
  isFlagged: boolean;
  flagReason?: string;
  songTitle: string;
  primaryArtist: string;
  allCreditedArtists: string[];
  proposedArtistFolderName: string;
  proposedSongFolderName: string;
  folderAction: 'move_and_rename' | 'keep_flagged_for_review';
  assets: {
    audio: { id: string; name: string; currentParentId: string; targetParentId: string };
    artwork?: { id: string; name: string; targetName: string; needsRename: boolean };
    lyrics?: { id: string; name: string };
    metadata?: { id: string; name: string };
  };
  dbStatus: 'linked' | 'needs_update' | 'needs_insert';
  dbTrackId?: string;
}

export async function generateDryRunPlan() {
  console.log(`\n================================================================`);
  console.log(`📋 DHUN GOOGLE DRIVE REORGANIZATION DRY RUN`);
  console.log(`================================================================`);
  console.log(`Root Library: "Dhun Music Library" [ID: ${ROOT_FOLDER_ID}]`);

  await connectDatabase();
  const drive = await googleDriveService.getClient();

  // Load audit data from Phase A
  const auditPath = path.resolve(process.cwd(), '../DhunMusicImport/drive-audit-phaseA.json');
  if (!fs.existsSync(auditPath)) {
    throw new Error(`Audit file not found at ${auditPath}. Run auditPhaseA.ts first.`);
  }
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

  // Load local manifests
  const importedManifestPath = path.resolve(process.cwd(), '../DhunMusicImport/imported-tracks-manifest.json');
  const importedManifest: any[] = fs.existsSync(importedManifestPath)
    ? JSON.parse(fs.readFileSync(importedManifestPath, 'utf8'))
    : [];

  const dbTracks = mongoose.connection.readyState === 1 ? await Track.find({}).lean() : [];
  console.log(`Loaded ${audit.subfolders.length} Drive subfolders and ${dbTracks.length} MongoDB tracks.`);

  // Identify unique artists across all subfolders
  const artistFolderMap = new Map<string, { proposedName: string; songCount: number }>();
  const dryRunItems: DryRunPlanItem[] = [];

  for (let i = 0; i < audit.subfolders.length; i++) {
    const sf = audit.subfolders[i];
    const isFolder36 = sf.id === '10VUi9-fBJFfehlPLyg52aNn7cUzYt_CI';
    const isFolder37 = sf.id === '1QThDdiX-hK9T2Lj3nQqBHxJIxQdTAZX9';

    // Find audio file
    const audioFile = sf.files.find((f: any) =>
      f.mimeType?.startsWith('audio/') ||
      /\.(mp3|flac|m4a|alac|wav)$/i.test(f.name)
    );
    const metaFile = sf.files.find((f: any) => f.name === 'metadata.json');
    const lyricsFile = sf.files.find((f: any) => f.name === 'lyrics.txt');
    const artworkFile = sf.files.find((f: any) =>
      f.name.startsWith('artwork') || f.name.startsWith('cover')
    );

    // Read metadata if available
    let metaContent: any = null;
    if (metaFile) {
      try {
        const raw = await googleDriveService.readFileText(metaFile.id);
        metaContent = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    // Determine title and artist: prioritize curated manifest and DB records, falling back to Drive metadata.json
    const manifestMatch = importedManifest.find(
      (m) => m.driveFolderId === sf.id || (audioFile && m.driveAudioFileId === audioFile.id)
    );

    const dbTrack = dbTracks.find(
      (t: any) => t.driveFolderId === sf.id || (audioFile && t.driveAudioFileId === audioFile.id)
    );

    let title = manifestMatch?.title || dbTrack?.title || metaContent?.title;
    let artist = manifestMatch?.artist || dbTrack?.artist || metaContent?.artist;

    // Clean known anomalies from raw audio tag exports
    if (title && /^03\s+Tera nam liya/i.test(title)) {
      title = 'Tera nam liya';
      artist = 'Mohammed Rafi & Asha Bhosle';
    }
    if (title && /JoshWoodward-TheBox/i.test(title)) {
      title = 'The Box';
      artist = 'Josh Woodward';
    }

    if (!title || !artist) {
      // Fallback from folder name
      if (sf.name.includes(' - ')) {
        const parts = sf.name.split(' - ').map((s: string) => s.trim());
        title = parts[0];
        artist = parts.slice(1).join(' - ');
      } else {
        title = sf.name;
        artist = 'Unknown Artist';
      }
    }

    // Special case for folder 37 (duplicate of Uden jab jab zulfen teri)
    if (isFolder37) {
      title = 'Uden jab jab zulfen teri';
      artist = 'Mohammed Rafi & Asha Bhosle';
    }

    // Parse primary artist using canonical rule
    const { primary, featured } = catalogService.parseArtistNames(artist);
    const primaryArtist = primary || 'Unknown Artist';
    const allCredited = [primary, ...featured];

    if (!artistFolderMap.has(primaryArtist)) {
      artistFolderMap.set(primaryArtist, { proposedName: primaryArtist, songCount: 0 });
    }
    artistFolderMap.get(primaryArtist)!.songCount++;

    // Artwork target name
    let artworkTarget: any = undefined;
    if (artworkFile) {
      const ext = artworkFile.name.includes('.png') ? '.png' : '.jpg';
      const targetName = `artwork${ext}`;
      artworkTarget = {
        id: artworkFile.id,
        name: artworkFile.name,
        targetName,
        needsRename: artworkFile.name !== targetName,
      };
    }


    const isFlagged = isFolder36 || isFolder37;
    const flagReason = isFolder36
      ? 'Previously flagged Kishore Kumar & Lata Mangeshkar folder with cover.png naming'
      : isFolder37
      ? 'Duplicate audio folder of Uden jab jab zulfen teri without metadata/lyrics'
      : undefined;

    const folderAction: 'move_and_rename' | 'keep_flagged_for_review' = isFolder37
      ? 'keep_flagged_for_review'
      : 'move_and_rename';

    dryRunItems.push({
      index: i + 1,
      currentFolderId: sf.id,
      currentFolderName: sf.name,
      isFlagged,
      flagReason,
      songTitle: title,
      primaryArtist,
      allCreditedArtists: allCredited,
      proposedArtistFolderName: primaryArtist,
      proposedSongFolderName: title,
      folderAction,
      assets: {
        audio: {
          id: audioFile?.id || 'MISSING',
          name: audioFile?.name || 'MISSING',
          currentParentId: sf.id,
          targetParentId: sf.id, // Remains inside the song folder!
        },
        artwork: artworkTarget,
        lyrics: lyricsFile ? { id: lyricsFile.id, name: lyricsFile.name } : undefined,
        metadata: metaFile ? { id: metaFile.id, name: metaFile.name } : undefined,
      },
      dbStatus: dbTrack ? 'linked' : 'needs_insert',
      dbTrackId: dbTrack ? String(dbTrack._id) : undefined,
    });
  }

  // Summary of Artist Folders to create
  console.log(`\n------------------------------------------------------`);
  console.log(`📁 1. PROPOSED CANONICAL ARTIST FOLDERS (under Dhun Music Library)`);
  console.log(`------------------------------------------------------`);
  for (const [artistName, info] of artistFolderMap.entries()) {
    console.log(` • [ARTIST FOLDER] "${artistName}" -> Contains ${info.songCount} song(s)`);
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`🎵 2. PROPOSED SONG FOLDER MOVES & RENAMES`);
  console.log(`------------------------------------------------------`);
  for (const item of dryRunItems) {
    const flagTag = item.isFlagged ? ` ⚠️ [FLAGGED: ${item.flagReason}]` : '';
    console.log(`\n#${item.index}. Current: "${item.currentFolderName}" [ID: ${item.currentFolderId}]${flagTag}`);
    console.log(`   Proposed Path: Dhun Music Library / ${item.proposedArtistFolderName} / ${item.proposedSongFolderName} /`);
    console.log(`   Action: ${item.folderAction === 'move_and_rename' ? `Move under "${item.proposedArtistFolderName}" and rename to "${item.proposedSongFolderName}"` : 'Preserve untouched pending review'}`);
    console.log(`   Audio: "${item.assets.audio.name}" [ID: ${item.assets.audio.id}] (Preserved bytes & ID)`);
    if (item.assets.artwork) {
      console.log(`   Artwork: "${item.assets.artwork.name}" [ID: ${item.assets.artwork.id}]${item.assets.artwork.needsRename ? ` -> Rename to "${item.assets.artwork.targetName}"` : ' (Correct name)'}`);
    } else {
      console.log(`   Artwork: None`);
    }
    console.log(`   Lyrics: ${item.assets.lyrics ? `✅ lyrics.txt [ID: ${item.assets.lyrics.id}]` : 'None'}`);
    console.log(`   Metadata: ${item.assets.metadata ? `✅ metadata.json [ID: ${item.assets.metadata.id}]` : 'None'}`);
    console.log(`   Database Status: ${item.dbStatus}${item.dbTrackId ? ` (Track ID: ${item.dbTrackId})` : ''}`);
  }

  // Write dry run report to disk
  const reportPath = path.resolve(process.cwd(), '../DhunMusicImport/reorganization-dry-run-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        rootFolderId: ROOT_FOLDER_ID,
        totalDriveSubfolders: audit.subfolders.length,
        totalProposedArtistFolders: artistFolderMap.size,
        proposedArtistFolders: Array.from(artistFolderMap.entries()).map(([k, v]) => ({
          artistName: k,
          songCount: v.songCount,
        })),
        items: dryRunItems,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n======================================================`);
  console.log(`✅ Dry-run manifest successfully written to:`);
  console.log(`   ${reportPath}`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
}

generateDryRunPlan().catch((err) => {
  console.error('Dry run failed:', err);
  process.exit(1);
});
