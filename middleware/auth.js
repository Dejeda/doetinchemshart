const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const { readJson, writeJson } = require('../lib/store');

const SESSION_COOKIE = 'dh_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

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
