const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let drive = null;
let config = null;
let rootFolderId = null;
const folderIdCache = new Map();
let initError = null;

function configPath() {
  return path.join(__dirname, '..', 'config', 'google.json');
}

function loadConfig() {
  // Allow config from env (full JSON) for cloud deployments
  if (process.env.GOOGLE_APP_CONFIG_JSON) {
    return JSON.parse(process.env.GOOGLE_APP_CONFIG_JSON);
  }
  const p = configPath();
  if (!fs.existsSync(p)) throw new Error('config/google.json ontbreekt — kopieer config/google.example.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadCredentials() {
  // Prefer env var (Render-style secret), fall back to local key file
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is geen geldige JSON');
    }
  }
  const keyFileRel = (config && config.keyFile) || 'config/service-account.json';
  const keyFileAbs = path.isAbsolute(keyFileRel) ? keyFileRel : path.join(__dirname, '..', keyFileRel);
  if (!fs.existsSync(keyFileAbs)) {
    throw new Error(`Service-account sleutelbestand niet gevonden: ${keyFileAbs}`);
  }
  return JSON.parse(fs.readFileSync(keyFileAbs, 'utf8'));
}

async function init() {
  initError = null;
  try {
    config = loadConfig();
    const creds = loadCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: SCOPES,
    });
    drive = google.drive({ version: 'v3', auth: await auth.getClient() });

    // Resolve root folder
    const envRootId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (envRootId && envRootId.trim()) {
      rootFolderId = envRootId.trim();
    } else if (config.rootFolderId && config.rootFolderId.trim()) {
      rootFolderId = config.rootFolderId.trim();
    } else {
      rootFolderId = await findFolderByName(config.rootFolderName || 'Doetinchemshart', null);
      if (!rootFolderId) {
        throw new Error(
          `Map "${config.rootFolderName}" niet zichtbaar voor service account. ` +
          `Heb je de map gedeeld met het service-account e-mailadres?`
        );
      }
    }

    // Pre-resolve known content section folders (best effort)
    folderIdCache.clear();
    for (const [key, def] of Object.entries(config.folders || {})) {
      try {
        const id = await resolvePath(def.path, rootFolderId);
        if (id) folderIdCache.set(key, id);
      } catch (e) {
        console.warn(`[drive] Kan sectie "${key}" niet vinden: ${e.message}`);
      }
    }

    console.log(`[drive] Verbonden. Root map id: ${rootFolderId}`);
    return true;
  } catch (e) {
    initError = e.message;
    drive = null;
    console.error(`[drive] Init mislukt: ${e.message}`);
    return false;
  }
}

async function findFolderByName(name, parentId) {
  const safeName = String(name).replace(/'/g, "\\'");
  const qParts = [
    `name = '${safeName}'`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const res = await drive.files.list({
    q: qParts.join(' and '),
    fields: 'files(id, name)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files || [];
  return files.length ? files[0].id : null;
}

async function resolvePath(segments, startId) {
  let current = startId;
  for (const seg of segments) {
    const next = await findFolderByName(seg, current);
    if (!next) throw new Error(`Submap niet gevonden: "${seg}"`);
    current = next;
  }
  return current;
}

function isReady() { return !!drive; }
function getStatus() { return { ready: isReady(), error: initError, rootFolderId }; }
function sectionDef(sectionKey) { return config ? (config.folders || {})[sectionKey] || null : null; }

function sectionsForRole(role) {
  if (!config) return [];
  return Object.entries(config.folders || {})
    .filter(([, def]) => (def.roles || []).includes(role))
    .map(([key, def]) => ({ key, label: def.label || key, path: def.path }));
}

async function ensureSectionFolder(sectionKey) {
  if (folderIdCache.has(sectionKey)) return folderIdCache.get(sectionKey);
  const def = sectionDef(sectionKey);
  if (!def) throw new Error(`Onbekende sectie: ${sectionKey}`);
  const id = await resolvePath(def.path, rootFolderId);
  folderIdCache.set(sectionKey, id);
  return id;
}

async function listFiles(sectionKey) {
  if (!isReady()) throw new Error('Google Drive is niet geconfigureerd');
  const folderId = await ensureSectionFolder(sectionKey);
  const all = [];
  let pageToken = undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
      pageSize: 200,
      pageToken,
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    (res.data.files || []).forEach((f) => all.push(f));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return all.map((f) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size || 0),
    modified: f.modifiedTime,
    mimeType: f.mimeType,
    ext: path.extname(f.name || '').toLowerCase(),
  }));
}

async function getFileMeta(fileId) {
  if (!isReady()) throw new Error('Google Drive is niet geconfigureerd');
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, parents, trashed',
    supportsAllDrives: true,
  });
  return res.data;
}

async function fileBelongsToSection(fileId, sectionKey) {
  const folderId = await ensureSectionFolder(sectionKey);
  const meta = await getFileMeta(fileId);
  if (meta.trashed) return false;
  return (meta.parents || []).includes(folderId);
}

async function downloadStream(fileId) {
  if (!isReady()) throw new Error('Google Drive is niet geconfigureerd');
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return res.data;
}

module.exports = {
  init,
  isReady,
  getStatus,
  sectionsForRole,
  sectionDef,
  listFiles,
  getFileMeta,
  fileBelongsToSection,
  downloadStream,
};
