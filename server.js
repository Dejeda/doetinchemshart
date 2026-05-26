const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const drive = require('./lib/drive');
const store = require('./lib/store');
const { authRouter, requireAuth, requireRole, configureCookies } = require('./middleware/auth');
const filesRouter = require('./routes/files');
const agendaRouter = require('./routes/agenda');
const announcementsRouter = require('./routes/announcements');
const membersRouter = require('./routes/members');

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
if (isProd) app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/files', requireAuth, filesRouter);
app.use('/api/agenda', requireAuth, agendaRouter);
app.use('/api/announcements', requireAuth, announcementsRouter);
app.use('/api/members', requireAuth, requireRole('BESTUUR'), membersRouter);

app.get('/healthz', (req, res) => res.json({ ok: true, drive: drive.getStatus().ready }));

const clientBuild = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('<h1>Doetinchems Hart</h1><p>Client niet gebouwd. Voer <code>npm run build</code> uit.</p>');
  });
}

async function maybeSeedInitialUser() {
  const users = store.readJson('users.json', []);
  if (users.length > 0) return;

  const username = process.env.INITIAL_BESTUUR_USERNAME;
  const password = process.env.INITIAL_BESTUUR_PASSWORD;
  if (!username || !password) {
    console.warn(
      '[seed] Geen gebruikers gevonden en INITIAL_BESTUUR_USERNAME / INITIAL_BESTUUR_PASSWORD zijn niet gezet.\n' +
      '       Stel deze env vars in, herstart, of run scripts/seed.js lokaal en upload data/*.json handmatig.'
    );
    return;
  }
  if (password.length < 8) {
    console.error('[seed] INITIAL_BESTUUR_PASSWORD moet minimaal 8 tekens zijn. Account NIET aangemaakt.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    username: String(username),
    name: process.env.INITIAL_BESTUUR_NAME || String(username),
    email: process.env.INITIAL_BESTUUR_EMAIL || '',
    role: 'BESTUUR',
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await store.writeJson('users.json', [user]);
  console.log(`[seed] Initieel BESTUUR-account "${username}" aangemaakt.`);
}

function logEnvDiagnostic() {
  const expected = [
    'NODE_ENV',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APP_CONFIG_JSON',
    'DRIVE_ROOT_FOLDER_ID',
    'INITIAL_BESTUUR_USERNAME',
    'INITIAL_BESTUUR_PASSWORD',
  ];
  const present = expected.filter((k) => process.env[k] && String(process.env[k]).trim());
  const missing = expected.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  console.log(`[env] aanwezig: ${present.join(', ') || '(geen)'}`);
  if (missing.length) console.log(`[env] ontbrekend/leeg: ${missing.join(', ')}`);
}

(async () => {
  logEnvDiagnostic();
  configureCookies({ secure: isProd });

  try {
    await store.init({ 'users.json': [], 'agenda.json': [], 'announcements.json': [] });
  } catch (e) {
    console.error(`[fatal] Store init mislukt: ${e.message}`);
    process.exit(1);
  }

  const ok = await drive.init();
  if (!ok) {
    console.warn('[!] Google Drive niet beschikbaar; /api/files endpoints zullen falen tot dit is opgelost.');
  }

  await maybeSeedInitialUser();

  app.listen(PORT, () => {
    console.log(`Doetinchems Hart server draait op http://localhost:${PORT}`);
  });
})();
