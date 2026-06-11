const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const { readJson, writeJson } = require('../lib/store');

const SESSION_COOKIE = 'dh_session';
const STATE_COOKIE = 'dh_oauth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const STATE_TTL_MS = 1000 * 60 * 10;
const PENDING_LOGIN_TTL_MS = 1000 * 60 * 10;
const TOTP_ISSUER = 'Doetinchems Hart';

authenticator.options = { window: 1 };

const sessions = new Map();
const pendingLogins = new Map();
const cookieOpts = { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL_MS, secure: false };

function configureCookies({ secure }) {
  cookieOpts.secure = !!secure;
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOpts);
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Niet ingelogd' });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.user = { username: session.username, role: session.role, name: session.name };
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Onvoldoende rechten' });
    }
    next();
  };
}

// ---- TOTP secret encryption ----

function getEncryptionKey() {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY ontbreekt of is geen 64-tekens hex-string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

function decryptSecret(blob) {
  const [ivHex, tagHex, ctHex] = String(blob).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
  return pt.toString('utf8');
}

function generateBackupCodes(count = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < count; i++) {
    let s = '';
    for (let j = 0; j < 10; j++) s += alphabet[crypto.randomInt(alphabet.length)];
    codes.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return codes;
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((c) => bcrypt.hash(c.toUpperCase(), 10)));
}

function normalizeCode(input) {
  return String(input || '').replace(/[\s-]/g, '').toUpperCase();
}

// ---- Pending login store ----

function createPendingLogin(data) {
  const token = newToken();
  pendingLogins.set(token, { ...data, expiresAt: Date.now() + PENDING_LOGIN_TTL_MS });
  return token;
}

function getPendingLogin(token) {
  if (!token) return null;
  const entry = pendingLogins.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingLogins.delete(token);
    return null;
  }
  return entry;
}

function consumePendingLogin(token) {
  const entry = getPendingLogin(token);
  if (entry) pendingLogins.delete(token);
  return entry;
}

function userHasTotpEnabled(user) {
  return !!(user && user.totpSecret && user.totpEnabledAt);
}

function userHasPassword(user) {
  return !!(user && user.passwordHash);
}

function startSession(res, user) {
  const token = newToken();
  sessions.set(token, {
    username: user.username,
    role: user.role,
    name: user.name || user.username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  setSessionCookie(res, token);
}

function publicUser(user) {
  return { username: user.username, role: user.role, name: user.name || user.username };
}

// ---- Routes ----

const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord vereist' });

  const users = readJson('users.json', []);
  const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Ongeldige inlog' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Ongeldige inlog' });

  if (userHasTotpEnabled(user)) {
    const pendingToken = createPendingLogin({ stage: 'verify', username: user.username });
    return res.json({ requires2FA: true, pendingToken });
  }
  const pendingToken = createPendingLogin({ stage: 'setup', username: user.username });
  return res.json({ requires2FASetup: true, pendingToken });
});

authRouter.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE, { sameSite: cookieOpts.sameSite, secure: cookieOpts.secure });
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) return res.status(401).json({ error: 'Niet ingelogd' });
  const users = readJson('users.json', []);
  const user = users.find((u) => u.username === session.username);
  res.json({
    username: session.username,
    role: session.role,
    name: session.name,
    has2FA: userHasTotpEnabled(user),
    hasPassword: userHasPassword(user),
  });
});

// ---- TOTP setup (within login flow) ----

authRouter.post('/2fa/setup-start', async (req, res) => {
  try {
    const { pendingToken } = req.body || {};
    const pending = getPendingLogin(pendingToken);
    if (!pending || pending.stage !== 'setup') {
      return res.status(401).json({ error: 'Setup-token ongeldig of verlopen' });
    }
    const secret = authenticator.generateSecret();
    pending.secret = secret;
    const otpauthUrl = authenticator.keyuri(pending.username, TOTP_ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({ secret, otpauthUrl, qrDataUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

authRouter.post('/2fa/setup-verify', async (req, res) => {
  try {
    const { pendingToken, code } = req.body || {};
    const pending = getPendingLogin(pendingToken);
    if (!pending || pending.stage !== 'setup' || !pending.secret) {
      return res.status(401).json({ error: 'Setup-token ongeldig of verlopen' });
    }
    const valid = authenticator.check(normalizeCode(code), pending.secret);
    if (!valid) return res.status(401).json({ error: 'Verificatiecode klopt niet' });

    const backupCodes = generateBackupCodes(8);
    const hashedBackup = await hashBackupCodes(backupCodes);
    const encryptedSecret = encryptSecret(pending.secret);

    const users = readJson('users.json', []);
    const idx = users.findIndex((u) => u.username === pending.username);
    if (idx === -1) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    users[idx].totpSecret = encryptedSecret;
    users[idx].totpEnabledAt = new Date().toISOString();
    users[idx].backupCodes = hashedBackup;
    await writeJson('users.json', users);

    consumePendingLogin(pendingToken);
    startSession(res, users[idx]);
    res.json({ ...publicUser(users[idx]), backupCodes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- TOTP login verification ----

authRouter.post('/2fa/login-verify', async (req, res) => {
  try {
    const { pendingToken, code } = req.body || {};
    const pending = getPendingLogin(pendingToken);
    if (!pending || pending.stage !== 'verify') {
      return res.status(401).json({ error: 'Verificatie-token ongeldig of verlopen' });
    }
    const users = readJson('users.json', []);
    const idx = users.findIndex((u) => u.username === pending.username);
    const user = idx === -1 ? null : users[idx];
    if (!user || !userHasTotpEnabled(user)) {
      return res.status(401).json({ error: 'Geen 2FA geconfigureerd' });
    }
    const submitted = normalizeCode(code);

    let valid = false;
    let usedBackupIndex = -1;

    if (/^\d{6}$/.test(submitted)) {
      const secret = decryptSecret(user.totpSecret);
      valid = authenticator.check(submitted, secret);
    } else if (Array.isArray(user.backupCodes)) {
      for (let i = 0; i < user.backupCodes.length; i++) {
        if (await bcrypt.compare(submitted, user.backupCodes[i])) {
          valid = true;
          usedBackupIndex = i;
          break;
        }
      }
    }
    if (!valid) return res.status(401).json({ error: 'Code klopt niet' });

    if (usedBackupIndex !== -1) {
      user.backupCodes.splice(usedBackupIndex, 1);
      await writeJson('users.json', users);
    }

    consumePendingLogin(pendingToken);
    startSession(res, user);
    res.json(publicUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- TOTP self-service (authenticated) ----

authRouter.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    const users = readJson('users.json', []);
    const idx = users.findIndex((u) => u.username === req.user.username);
    if (idx === -1) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const user = users[idx];
    if (!userHasTotpEnabled(user)) return res.status(400).json({ error: '2FA staat niet aan' });

    const secret = decryptSecret(user.totpSecret);
    if (!authenticator.check(normalizeCode(code), secret)) {
      return res.status(401).json({ error: 'Code klopt niet' });
    }
    delete users[idx].totpSecret;
    delete users[idx].totpEnabledAt;
    delete users[idx].backupCodes;
    await writeJson('users.json', users);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

authRouter.post('/2fa/regenerate-backup', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    const users = readJson('users.json', []);
    const idx = users.findIndex((u) => u.username === req.user.username);
    if (idx === -1) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const user = users[idx];
    if (!userHasTotpEnabled(user)) return res.status(400).json({ error: '2FA staat niet aan' });

    const secret = decryptSecret(user.totpSecret);
    if (!authenticator.check(normalizeCode(code), secret)) {
      return res.status(401).json({ error: 'Code klopt niet' });
    }
    const backupCodes = generateBackupCodes(8);
    users[idx].backupCodes = await hashBackupCodes(backupCodes);
    await writeJson('users.json', users);
    res.json({ backupCodes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Google OAuth ----

function parseEmailList(envValue) {
  return String(envValue || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function roleForEmail(email) {
  const lc = String(email || '').toLowerCase();
  if (!lc) return null;
  if (parseEmailList(process.env.BESTUUR_EMAILS).includes(lc)) return 'BESTUUR';
  if (parseEmailList(process.env.LEDEN_EMAILS).includes(lc)) return 'LEDEN';
  return null;
}

function buildOAuthClient(req) {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  return new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri,
  });
}

function loginRedirect(res, error) {
  const qs = error ? `?login_error=${encodeURIComponent(error)}` : '';
  res.redirect('/login' + qs);
}

authRouter.get('/google/start', (req, res) => {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return loginRedirect(res, 'Google OAuth is niet geconfigureerd op de server.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieOpts.secure,
    maxAge: STATE_TTL_MS,
  });
  const client = buildOAuthClient(req);
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error: googleError } = req.query;
    if (googleError) return loginRedirect(res, 'Google login afgebroken');
    if (!code || !state) return loginRedirect(res, 'Ongeldige callback');

    const cookieState = req.cookies && req.cookies[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);
    if (!cookieState || cookieState !== state) {
      return loginRedirect(res, 'State mismatch (mogelijk verlopen, probeer opnieuw)');
    }

    const client = buildOAuthClient(req);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return loginRedirect(res, 'Geen id_token ontvangen van Google');

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const payload = ticket.getPayload() || {};
    const email = payload.email;
    if (!email || !payload.email_verified) {
      return loginRedirect(res, 'E-mailadres niet geverifieerd door Google');
    }

    const role = roleForEmail(email);
    if (!role) return loginRedirect(res, `Geen toegang voor ${email}`);

    const name = payload.name || email;
    const lc = email.toLowerCase();
    const users = readJson('users.json', []);
    let idx = users.findIndex((u) => String(u.email || '').toLowerCase() === lc);
    if (idx === -1) {
      users.push({
        username: lc,
        name,
        email: lc,
        role,
        createdAt: new Date().toISOString(),
        authProvider: 'google',
      });
      idx = users.length - 1;
    } else {
      users[idx].role = role;
      if (name) users[idx].name = name;
      users[idx].authProvider = users[idx].authProvider || 'google';
    }
    await writeJson('users.json', users);

    startSession(res, users[idx]);
    res.redirect('/');
  } catch (e) {
    console.error('[oauth] callback error:', e.message);
    loginRedirect(res, 'Inloggen mislukt: ' + e.message);
  }
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Nieuw wachtwoord is te kort (min 6 tekens)' });
  }
  const users = readJson('users.json', []);
  const idx = users.findIndex((u) => u.username === req.user.username);
  if (idx === -1) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  if (!users[idx].passwordHash) return res.status(400).json({ error: 'Dit account heeft geen wachtwoord' });
  const ok = await bcrypt.compare(currentPassword, users[idx].passwordHash);
  if (!ok) return res.status(401).json({ error: 'Huidig wachtwoord klopt niet' });
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  await writeJson('users.json', users);
  res.json({ ok: true });
});

module.exports = { authRouter, requireAuth, requireRole, configureCookies };
