import mongoose from 'mongoose';
import { Track } from '../models/track.model.js';
import { connectDatabase } from '../config/database.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';

export interface ProposedFolderAction {
  trackId: string;
  title: string;
  artist: string;
  currentFolderId?: string;
  currentFolderName?: string;
  targetFolderName: string;
  action: 'rename_folder' | 'reuse_folder' | 'create_folder';
  audioFile: {
    id: string;
    name: string;
    currentParentId?: string;
    needsMove: boolean;
  };
  metadataFile?: {
    id: string;
    name: string;
    currentParentId?: string;
    needsMove: boolean;
  };
  lyricsFile?: {
    id: string;
    name: string;
    currentParentId?: string;
    needsMove: boolean;
  };
  artworkFile?: {
    id: string;
    name: string;
    targetName: string;
    currentParentId?: string;
    needsRename: boolean;
    needsMove: boolean;
  };
}

export async function runDriveReorganization(dryRun = true) {
  console.log(`\n================================================================`);
  console.log(`📁 DHUN GOOGLE DRIVE FOLDER REORGANIZATION ${dryRun ? '[DRY RUN]' : '[LIVE EXECUTION]'}`);
  console.log(`================================================================`);

  await connectDatabase();
  const drive = await googleDriveService.getClient();
  const root = await googleDriveService.findOrCreateFolder(env.driveRootFolder);

  console.log(`Google Drive Root: "${root.name}" (${root.id})`);

  // 1. Fetch all items in Google Drive
  let pageToken: string | undefined = undefined;
  const allItems: any[] = [];
  do {
    const res: any = await drive.files.list({
      q: 'trashed = false',
      fields: 'nextPageToken, files(id, name, mimeType, parents, size, md5Checksum)',
      pageSize: 1000,
      pageToken,
    });
    if (res.data.files) {
      allItems.push(...res.data.files);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  console.log(`Total active items in Google Drive account: ${allItems.length}`);

  const foldersInRoot = allItems.filter(
    (item) => item.parents && item.parents.includes(root.id) && item.mimeType === 'application/vnd.google-apps.folder'
  );
  const filesInRoot = allItems.filter(
    (item) => item.parents && item.parents.includes(root.id) && item.mimeType !== 'application/vnd.google-apps.folder'
  );

  console.log(`Subfolders in root: ${foldersInRoot.length}`);
  console.log(`Files directly in root: ${filesInRoot.length}`);

  const itemsByParent = new Map<string, any[]>();
  for (const item of allItems) {
    if (item.parents) {
      for (const p of item.parents) {
        if (!itemsByParent.has(p)) itemsByParent.set(p, []);
        itemsByParent.get(p)!.push(item);
      }
    }
  }

  // 2. Fetch tracks from MongoDB
  const tracks = await Track.find({}).lean();
  console.log(`Tracks in MongoDB: ${tracks.length}\n`);

  const proposedActions: ProposedFolderAction[] = [];
  const matchedFolderIds = new Set<string>();
  const matchedFileIds = new Set<string>();

  for (const t of tracks) {
    const cleanTitle = t.title.trim();
    const cleanArtist = t.artist.trim();
    const targetFolderName = `${cleanTitle} - ${cleanArtist}`;

    // Find the folder corresponding to this track
    let folder = foldersInRoot.find((f) => f.id === t.driveFolderId);
    if (!folder) {
      // Try finding by audio file inside it
      folder = foldersInRoot.find((f) => {
        const children = itemsByParent.get(f.id) || [];
        return children.some((c) => c.id === t.driveAudioFileId);
      });
    }
    if (!folder) {
      // Try finding by name: target or legacy
      folder = foldersInRoot.find((f) => f.name === targetFolderName || f.name === `${cleanArtist} - ${cleanTitle}`);
    }

    if (!folder) {
      console.warn(`⚠️ Could not locate folder for track: "${t.title}" by "${t.artist}"`);
      continue;
    }

    matchedFolderIds.add(folder.id);

    const folderAction: 'rename_folder' | 'reuse_folder' = folder.name === targetFolderName ? 'reuse_folder' : 'rename_folder';

    const children = itemsByParent.get(folder.id) || [];
    const audio = children.find((c) => c.id === t.driveAudioFileId) || children.find((c) => c.mimeType?.startsWith('audio/'));
    const meta = children.find((c) => c.name === 'metadata.json');
    const lyrics = children.find((c) => c.name === 'lyrics.txt');
    const artwork = children.find((c) => c.name.startsWith('artwork') || c.name.startsWith('cover'));

    if (audio) matchedFileIds.add(audio.id);
    if (meta) matchedFileIds.add(meta.id);
    if (lyrics) matchedFileIds.add(lyrics.id);
    if (artwork) matchedFileIds.add(artwork.id);

    const artworkExt = artwork ? (artwork.name.includes('.png') ? '.png' : '.jpg') : '.jpg';
    const artworkTargetName = `artwork${artworkExt}`;

    const prop: ProposedFolderAction = {
      trackId: String(t._id),
      title: cleanTitle,
      artist: cleanArtist,
      currentFolderId: folder.id,
      currentFolderName: folder.name,
      targetFolderName,
      action: folderAction,
      audioFile: {
        id: audio ? audio.id : t.driveAudioFileId,
        name: audio ? audio.name : t.originalFileName,
        currentParentId: audio?.parents?.[0],
        needsMove: audio ? !audio.parents?.includes(folder.id) : false,
      },
      metadataFile: meta
        ? {
            id: meta.id,
            name: meta.name,
            currentParentId: meta.parents?.[0],
            needsMove: !meta.parents?.includes(folder.id),
          }
        : undefined,
      lyricsFile: lyrics
        ? {
            id: lyrics.id,
            name: lyrics.name,
            currentParentId: lyrics.parents?.[0],
            needsMove: !lyrics.parents?.includes(folder.id),
          }
        : undefined,
      artworkFile: artwork
        ? {
            id: artwork.id,
            name: artwork.name,
            targetName: artworkTargetName,
            currentParentId: artwork.parents?.[0],
            needsRename: artwork.name !== artworkTargetName,
            needsMove: !artwork.parents?.includes(folder.id),
          }
        : undefined,
    };

    proposedActions.push(prop);
  }

  // 3. Display Proposed Operations for Review
  console.log(`================================================================`);
  console.log(`PROPOSED FOLDER ACTIONS (${proposedActions.length} tracks):`);
  console.log(`================================================================`);

  let renameFolderCount = 0;
  let renameArtworkCount = 0;
  let moveFileCount = 0;

  for (let i = 0; i < proposedActions.length; i++) {
    const p = proposedActions[i];
    const isRename = p.action === 'rename_folder';
    if (isRename) renameFolderCount++;
    if (p.artworkFile?.needsRename) renameArtworkCount++;
    if (p.audioFile.needsMove || p.metadataFile?.needsMove || p.lyricsFile?.needsMove || p.artworkFile?.needsMove) moveFileCount++;

    console.log(`\n[${i + 1}/${proposedActions.length}] 🎵 "${p.title}" - "${p.artist}"`);
    console.log(`   📁 Song Folder (ID: ${p.currentFolderId}):`);
    if (isRename) {
      console.log(`      ACTION: Rename folder from "${p.currentFolderName}" -> "${p.targetFolderName}"`);
    } else {
      console.log(`      ACTION: Reuse existing folder "${p.targetFolderName}"`);
    }

    console.log(`   🎧 Audio File: "${p.audioFile.name}" (ID: ${p.audioFile.id}) -> Parent: ${p.audioFile.needsMove ? 'MOVE TO ' + p.currentFolderId : 'Verified in folder'}`);

    if (p.metadataFile) {
      console.log(`   📄 Metadata: "${p.metadataFile.name}" (ID: ${p.metadataFile.id}) -> Parent: ${p.metadataFile.needsMove ? 'MOVE TO ' + p.currentFolderId : 'Verified in folder'}`);
    } else {
      console.log(`   📄 Metadata: None found in folder (will be generated if needed)`);
    }

    if (p.lyricsFile) {
      console.log(`   📝 Lyrics: "${p.lyricsFile.name}" (ID: ${p.lyricsFile.id}) -> Parent: ${p.lyricsFile.needsMove ? 'MOVE TO ' + p.currentFolderId : 'Verified in folder'}`);
    } else {
      console.log(`   📝 Lyrics: None (track has no lyrics file)`);
    }

    if (p.artworkFile) {
      const artAction = p.artworkFile.needsRename ? `Rename "${p.artworkFile.name}" -> "${p.artworkFile.targetName}"` : 'Keep name';
      console.log(`   🖼️ Artwork: (ID: ${p.artworkFile.id}) -> ${artAction} | Parent: ${p.artworkFile.needsMove ? 'MOVE TO ' + p.currentFolderId : 'Verified in folder'}`);
    } else {
      console.log(`   🖼️ Artwork: None`);
    }
  }

  // 4. Identify Ambiguous or Unmatched Folders / Files for Manual Review
  const unlinkedFolders = foldersInRoot.filter((f) => !matchedFolderIds.has(f.id));
  const unlinkedFilesInRoot = filesInRoot.filter((f) => !matchedFileIds.has(f.id));

  console.log(`\n================================================================`);
  console.log(`AMBIGUOUS / UNMATCHED ITEMS FOR MANUAL REVIEW:`);
  console.log(`================================================================`);
  if (unlinkedFolders.length === 0 && unlinkedFilesInRoot.length === 0) {
    console.log('✅ None. All items in Google Drive root are confidently matched.');
  } else {
    for (const f of unlinkedFolders) {
      const children = itemsByParent.get(f.id) || [];
      console.log(`\n⚠️ Ambiguous Unlinked Folder: "${f.name}" (ID: ${f.id})`);
      console.log(`   Contains ${children.length} file(s):`);
      for (const c of children) {
        console.log(`     - ${c.name} (${c.mimeType}, ID: ${c.id})`);
      }
      console.log(`   Recommendation: Leave untouched until manual review or distinct track ingestion.`);
    }

    for (const f of unlinkedFilesInRoot) {
      console.log(`\n⚠️ Ambiguous Root File: "${f.name}" (ID: ${f.id}, mime: ${f.mimeType})`);
      console.log(`   Recommendation: Leave untouched in root folder for manual review.`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`DRY-RUN SUMMARY:`);
  console.log(`================================================================`);
  console.log(`Total Tracks Processed:       ${proposedActions.length}`);
  console.log(`Folders to Rename:            ${renameFolderCount}`);
  console.log(`Folders Already Canonical:    ${proposedActions.length - renameFolderCount}`);
  console.log(`Artwork Files to Rename:      ${renameArtworkCount}`);
  console.log(`Files Requiring Moves:        ${moveFileCount}`);
  console.log(`Ambiguous Items Flagged:      ${unlinkedFolders.length + unlinkedFilesInRoot.length}`);
  console.log(`Dry-Run Mode:                 ${dryRun ? 'ACTIVE (Zero modifications made)' : 'LIVE'}`);
  console.log(`================================================================\n`);

  if (!dryRun) {
    console.log(`Applying live changes to Google Drive and MongoDB Atlas...\n`);

    let foldersRenamedLive = 0;
    let artworkRenamedLive = 0;
    let tracksUpdatedInMongo = 0;

    for (let i = 0; i < proposedActions.length; i++) {
      const p = proposedActions[i];
      console.log(`[${i + 1}/${proposedActions.length}] Reorganizing: "${p.title}" - "${p.artist}"...`);

      // 1. Rename folder if needed
      if (p.action === 'rename_folder' && p.currentFolderId) {
        console.log(`   📁 Renaming folder to "${p.targetFolderName}"...`);
        await googleDriveService.renameItem(p.currentFolderId, p.targetFolderName);
        foldersRenamedLive++;
      }

      // 2. Rename artwork if needed
      if (p.artworkFile?.needsRename && p.artworkFile.id) {
        console.log(`   🖼️ Renaming artwork to "${p.artworkFile.targetName}"...`);
        await googleDriveService.renameItem(p.artworkFile.id, p.artworkFile.targetName);
        artworkRenamedLive++;
      }

      // 3. Move files if needed
      if (p.audioFile.needsMove && p.currentFolderId) {
        console.log(`   🎧 Moving audio file to folder ${p.currentFolderId}...`);
        await googleDriveService.moveItem(p.audioFile.id, p.currentFolderId, p.audioFile.currentParentId);
      }
      if (p.metadataFile?.needsMove && p.currentFolderId) {
        console.log(`   📄 Moving metadata file to folder ${p.currentFolderId}...`);
        await googleDriveService.moveItem(p.metadataFile.id, p.currentFolderId, p.metadataFile.currentParentId);
      }
      if (p.lyricsFile?.needsMove && p.currentFolderId) {
        console.log(`   📝 Moving lyrics file to folder ${p.currentFolderId}...`);
        await googleDriveService.moveItem(p.lyricsFile.id, p.currentFolderId, p.lyricsFile.currentParentId);
      }
      if (p.artworkFile?.needsMove && p.currentFolderId) {
        console.log(`   🖼️ Moving artwork file to folder ${p.currentFolderId}...`);
        await googleDriveService.moveItem(p.artworkFile.id, p.currentFolderId, p.artworkFile.currentParentId);
      }

      // 4. Update MongoDB record with verified folder ID and asset file IDs
      const updateDoc: any = {
        driveFolderId: p.currentFolderId,
        driveAudioFileId: p.audioFile.id,
      };
      if (p.metadataFile?.id) updateDoc.driveMetadataFileId = p.metadataFile.id;
      if (p.lyricsFile?.id) {
        updateDoc.driveLyricsFileId = p.lyricsFile.id;
        updateDoc.hasLyrics = true;
      }
      if (p.artworkFile?.id) {
        updateDoc.driveArtworkFileId = p.artworkFile.id;
        updateDoc.hasArtwork = true;
      }

      await Track.findByIdAndUpdate(p.trackId, { $set: updateDoc });
      tracksUpdatedInMongo++;
    }

    console.log(`\n================================================================`);
    console.log(`POST-MIGRATION VERIFICATION VIA GOOGLE DRIVE API:`);
    console.log(`================================================================`);

    let verifiedFolders = 0;
    let verifiedFilesWithCorrectParent = 0;

    for (const p of proposedActions) {
      if (!p.currentFolderId) continue;

      // Verify folder parent is root
      const folderCheck: any = await drive.files.get({
        fileId: p.currentFolderId,
        fields: 'id, name, parents, trashed',
      });
      const folderParentOk = folderCheck.data.parents?.includes(root.id);

      // Verify audio parent is folder
      const audioCheck: any = await drive.files.get({
        fileId: p.audioFile.id,
        fields: 'id, name, parents, trashed',
      });
      const audioParentOk = audioCheck.data.parents?.includes(p.currentFolderId);

      // Verify metadata parent
      let metaParentOk = true;
      if (p.metadataFile?.id) {
        const metaCheck: any = await drive.files.get({
          fileId: p.metadataFile.id,
          fields: 'id, name, parents, trashed',
        });
        metaParentOk = metaCheck.data.parents?.includes(p.currentFolderId);
      }

      // Verify lyrics parent
      let lyricsParentOk = true;
      if (p.lyricsFile?.id) {
        const lyricsCheck: any = await drive.files.get({
          fileId: p.lyricsFile.id,
          fields: 'id, name, parents, trashed',
        });
        lyricsParentOk = lyricsCheck.data.parents?.includes(p.currentFolderId);
      }

      // Verify artwork parent
      let artworkParentOk = true;
      if (p.artworkFile?.id) {
        const artCheck: any = await drive.files.get({
          fileId: p.artworkFile.id,
          fields: 'id, name, parents, trashed',
        });
        artworkParentOk = artCheck.data.parents?.includes(p.currentFolderId);
      }

      const allOk = folderParentOk && audioParentOk && metaParentOk && lyricsParentOk && artworkParentOk;
      if (allOk) {
        verifiedFolders++;
        verifiedFilesWithCorrectParent +=
          1 + (p.metadataFile ? 1 : 0) + (p.lyricsFile ? 1 : 0) + (p.artworkFile ? 1 : 0);
        console.log(`✅ VERIFIED: Folder "${folderCheck.data.name}" (ID: ${p.currentFolderId}) [All assets parented correctly]`);
      } else {
        console.error(`❌ VERIFICATION MISMATCH on "${p.title}":`, {
          folderParentOk,
          audioParentOk,
          metaParentOk,
          lyricsParentOk,
          artworkParentOk,
        });
      }
    }

    console.log(`\n================================================================`);
    console.log(`LIVE REORGANIZATION COMPLETED SUCCESSFULLY:`);
    console.log(`================================================================`);
    console.log(`Folders Renamed to Canonical: ${foldersRenamedLive}`);
    console.log(`Artwork Renamed to artwork.*: ${artworkRenamedLive}`);
    console.log(`Tracks Updated in MongoDB:    ${tracksUpdatedInMongo}`);
    console.log(`Verified Folders in Drive:    ${verifiedFolders} / ${proposedActions.length}`);
    console.log(`Total Verified Child Files:   ${verifiedFilesWithCorrectParent}`);
    console.log(`================================================================\n`);
  }

  await mongoose.disconnect();
}

const isLive = process.argv.includes('--live');
runDriveReorganization(!isLive).catch(console.error);
