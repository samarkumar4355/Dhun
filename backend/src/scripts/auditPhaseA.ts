import fs from 'node:fs';
import path from 'node:path';
import { googleDriveService } from '../services/googleDrive.service.js';

const ROOT_FOLDER_ID = '1NyaiCuxcNcwrWFHNIs_QdnD62Qa12PIM';

async function runAudit() {
  console.log(`Starting Google Drive Audit for Root: ${ROOT_FOLDER_ID}...`);
  const drive = await googleDriveService.getClient();

  // 1. Verify root folder
  const root = await drive.files.get({
    fileId: ROOT_FOLDER_ID,
    fields: 'id, name, mimeType, trashed, webViewLink, parents',
  });
  console.log(`Verified Root Folder: "${root.data.name}" [ID: ${root.data.id}]`);

  // 2. Fetch all active (non-trashed) files in Drive account accessible to token
  let pageToken: string | undefined = undefined;
  const allDriveItems: any[] = [];
  do {
    const res: any = await drive.files.list({
      q: 'trashed = false',
      fields: 'nextPageToken, files(id, name, mimeType, parents, size, md5Checksum, createdTime, modifiedTime)',
      pageSize: 1000,
      pageToken,
    });
    if (res.data.files) {
      allDriveItems.push(...res.data.files);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  console.log(`Total accessible items across Drive: ${allDriveItems.length}`);

  // Build parent-child relationships
  const itemsByParent = new Map<string, any[]>();
  const itemById = new Map<string, any>();

  for (const item of allDriveItems) {
    itemById.set(item.id, item);
    if (item.parents && item.parents.length > 0) {
      for (const p of item.parents) {
        if (!itemsByParent.has(p)) itemsByParent.set(p, []);
        itemsByParent.get(p)!.push(item);
      }
    } else {
      if (!itemsByParent.has('__NO_PARENT__')) itemsByParent.set('__NO_PARENT__', []);
      itemsByParent.get('__NO_PARENT__')!.push(item);
    }
  }

  // Find all direct children of root
  const directRootChildren = itemsByParent.get(ROOT_FOLDER_ID) || [];
  console.log(`Direct items inside Dhun Music Library root: ${directRootChildren.length}`);

  const foldersInRoot = directRootChildren.filter((i) => i.mimeType === 'application/vnd.google-apps.folder');
  const filesInRoot = directRootChildren.filter((i) => i.mimeType !== 'application/vnd.google-apps.folder');

  console.log(`Direct subfolders in root: ${foldersInRoot.length}`);
  console.log(`Direct files in root (should be 0): ${filesInRoot.length}`);

  // Analyze each subfolder in root
  const subfoldersAnalysis: any[] = [];
  for (const folder of foldersInRoot) {
    const children = itemsByParent.get(folder.id) || [];
    const subfolders = children.filter((i) => i.mimeType === 'application/vnd.google-apps.folder');
    const files = children.filter((i) => i.mimeType !== 'application/vnd.google-apps.folder');

    // Recursively get grandchild files if there are subfolders
    const nestedFoldersAnalysis: any[] = [];
    for (const sf of subfolders) {
      const sfChildren = itemsByParent.get(sf.id) || [];
      nestedFoldersAnalysis.push({
        id: sf.id,
        name: sf.name,
        parents: sf.parents,
        childrenCount: sfChildren.length,
        children: sfChildren.map((c) => ({
          id: c.id,
          name: c.name,
          mimeType: c.mimeType,
          size: c.size,
          md5Checksum: c.md5Checksum,
          parents: c.parents,
        })),
      });
    }

    subfoldersAnalysis.push({
      id: folder.id,
      name: folder.name,
      parents: folder.parents,
      subfoldersCount: subfolders.length,
      filesCount: files.length,
      nestedFolders: nestedFoldersAnalysis,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        md5Checksum: f.md5Checksum,
        parents: f.parents,
      })),
    });
  }

  // Also check if there are any orphaned audio/metadata/artwork files outside root
  const allSubfolderIds = new Set<string>();
  for (const f of foldersInRoot) {
    allSubfolderIds.add(f.id);
    const children = itemsByParent.get(f.id) || [];
    for (const c of children) {
      if (c.mimeType === 'application/vnd.google-apps.folder') {
        allSubfolderIds.add(c.id);
      }
    }
  }

  const itemsOutsideKnown = allDriveItems.filter((i) => {
    if (i.id === ROOT_FOLDER_ID) return false;
    if (!i.parents || i.parents.length === 0) return true;
    return !i.parents.some((p: string) => p === ROOT_FOLDER_ID || allSubfolderIds.has(p));
  });

  const report = {
    auditTimestamp: new Date().toISOString(),
    rootFolder: {
      id: root.data.id,
      name: root.data.name,
      webViewLink: root.data.webViewLink,
    },
    totalDriveItems: allDriveItems.length,
    directRootSubfoldersCount: foldersInRoot.length,
    directRootFilesCount: filesInRoot.length,
    filesInRoot: filesInRoot.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      parents: f.parents,
    })),
    subfolders: subfoldersAnalysis,
    itemsOutsideLibrary: itemsOutsideKnown.map((i) => ({
      id: i.id,
      name: i.name,
      mimeType: i.mimeType,
      parents: i.parents,
    })),
  };

  const outputPath = path.resolve(process.cwd(), '../DhunMusicImport/drive-audit-phaseA.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Audit report written to: ${outputPath}`);
  console.log(`Summary:\n - Direct subfolders in root: ${foldersInRoot.length}`);
  console.log(` - Direct files in root: ${filesInRoot.length}`);
  console.log(` - Items outside library: ${itemsOutsideKnown.length}`);
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
