const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

const { readJson, writeJson } = require('../lib/store');

const SESSION_COOKIE = 'dh_session';
const STATE_COOKIE = 'dh_oauth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const STATE_TTL_MS = 1000 * 60 * 10;        // 10 minutes

// In-memory session store. For a small local app this is fine; restart = logout.
const sessions = new Map();
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
  // Sliding expiry
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

const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord vereist' });

  const users = readJson('users.json', []);
  const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Ongeldige inlog' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Ongeldige inlog' });

  const token = newToken();
  sessions.set(token, {
    username: user.username,
    role: user.role,
    name: user.name || user.username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  setSessionCookie(res, token);
  res.json({ username: user.username, role: user.role, name: user.name || user.username });
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
  res.json({ username: session.username, role: session.role, name: session.name });
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

    const user = users[idx];
    const token = newToken();
    sessions.set(token, {
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    setSessionCookie(res, token);
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
  const ok = await bcrypt.compare(currentPassword, users[idx].passwordHash);
  if (!ok) return res.status(401).json({ error: 'Huidig wachtwoord klopt niet' });
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  await writeJson('users.json', users);
  res.json({ ok: true });
});

module.exports = { authRouter, requireAuth, requireRole, configureCookies };
