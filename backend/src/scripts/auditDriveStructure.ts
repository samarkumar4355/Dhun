import { googleDriveService } from '../services/googleDrive.service.js';
import { env } from '../config/env.js';

async function auditDrive() {
  console.log('Auditing Google Drive folder structure...');
  const drive = await googleDriveService.getClient();

  const rootFolder = await googleDriveService.findOrCreateFolder(env.driveRootFolder);
  console.log(`Root Folder: "${rootFolder.name}" (ID: ${rootFolder.id})`);

  // List all files and folders in Drive
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

  console.log(`Total active items in Google Drive: ${allItems.length}`);

  // Find all items with parent = rootFolder.id
  const directChildren = allItems.filter((item) => item.parents && item.parents.includes(rootFolder.id));
  console.log(`Direct children inside root "${rootFolder.name}": ${directChildren.length}`);

  const foldersInRoot = directChildren.filter((i) => i.mimeType === 'application/vnd.google-apps.folder');
  const filesInRoot = directChildren.filter((i) => i.mimeType !== 'application/vnd.google-apps.folder');

  console.log(` - Subfolders in root: ${foldersInRoot.length}`);
  console.log(` - Files placed DIRECTLY in root: ${filesInRoot.length}`);

  if (filesInRoot.length > 0) {
    console.log('\n⚠️ FILES PLACED DIRECTLY IN ROOT:');
    for (const f of filesInRoot) {
      console.log(`   - ${f.name} (ID: ${f.id}, mime: ${f.mimeType}, size: ${f.size})`);
    }
  }

  console.log('\nSubfolders and their contents:');
  const itemsByParent = new Map<string, any[]>();
  for (const item of allItems) {
    if (item.parents) {
      for (const p of item.parents) {
        if (!itemsByParent.has(p)) itemsByParent.set(p, []);
        itemsByParent.get(p)!.push(item);
      }
    }
  }

  for (const folder of foldersInRoot) {
    const children = itemsByParent.get(folder.id) || [];
    console.log(`\n📁 Folder: "${folder.name}" (ID: ${folder.id}) -> ${children.length} items`);
    for (const c of children) {
      console.log(`   - [${c.mimeType === 'application/vnd.google-apps.folder' ? 'DIR' : 'FILE'}] ${c.name} (ID: ${c.id})`);
    }
  }

  // Check any items whose parent is not root and not in any known subfolder
  const knownFolderIds = new Set([rootFolder.id, ...foldersInRoot.map((f) => f.id)]);
  const orphanItems = allItems.filter(
    (item) => item.id !== rootFolder.id && (!item.parents || !item.parents.some((p: string) => knownFolderIds.has(p)))
  );
  if (orphanItems.length > 0) {
    console.log(`\nItems outside of Dhun root & known subfolders: ${orphanItems.length}`);
    for (const item of orphanItems.slice(0, 20)) {
      console.log(` - ${item.name} (ID: ${item.id}, parents: ${item.parents?.join(', ') || 'none'})`);
    }
  }
}

auditDrive().catch(console.error);
