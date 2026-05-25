// Quick diagnostic: lists the immediate children (folders + files) of the configured
// root Drive folder, then recurses one level into each child folder.
// Usage: node scripts/list-drive.js

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'google.json'), 'utf8'));
const keyFile = path.isAbsolute(cfg.keyFile) ? cfg.keyFile : path.join(__dirname, '..', cfg.keyFile);
const FOLDER_MIME = 'application/vnd.google-apps.folder';

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  // Resolve root
  let rootId = cfg.rootFolderId;
  if (!rootId) {
    const safe = (cfg.rootFolderName || 'Doetinchemshart').replace(/'/g, "\\'");
    const r = await drive.files.list({
      q: `name = '${safe}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id, name)',
    });
    if (!r.data.files.length) {
      console.error(`Map "${cfg.rootFolderName}" niet zichtbaar voor service account.`);
      process.exit(1);
    }
    rootId = r.data.files[0].id;
  }

  async function list(parentId, prefix) {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      orderBy: 'folder,name',
      pageSize: 200,
    });
    return res.data.files || [];
  }

  console.log(`Root: ${cfg.rootFolderName || 'Doetinchemshart'} (id ${rootId})`);
  const lvl1 = await list(rootId);
  for (const f of lvl1) {
    const tag = f.mimeType === FOLDER_MIME ? '[dir] ' : '      ';
    console.log(`  ${tag}${f.name}`);
    if (f.mimeType === FOLDER_MIME) {
      const lvl2 = await list(f.id);
      for (const g of lvl2) {
        const tag2 = g.mimeType === FOLDER_MIME ? '[dir] ' : '      ';
        console.log(`    ${tag2}${g.name}`);
      }
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
