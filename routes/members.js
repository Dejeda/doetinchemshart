const express = require('express');
const bcrypt = require('bcryptjs');
const { readJson, writeJson } = require('../lib/store');

const router = express.Router();
const FILE = 'users.json';

function publicView(u) {
  return { username: u.username, name: u.name || u.username, role: u.role, email: u.email || '' };
}

router.get('/', (req, res) => {
  const users = readJson(FILE, []);
  res.json(users.map(publicView));
});

router.post('/', async (req, res) => {
  const { username, name, password, role, email } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord verplicht' });
  if (!['BESTUUR', 'LEDEN'].includes(role)) return res.status(400).json({ error: 'Rol moet BESTUUR of LEDEN zijn' });
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord min 6 tekens' });

  const users = readJson(FILE, []);
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
  }
  const user = {
    username: String(username),
    name: name ? String(name) : String(username),
    email: email ? String(email) : '',
    role,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeJson(FILE, users);
  res.status(201).json(publicView(user));
});

router.put('/:username', async (req, res) => {
  const users = readJson(FILE, []);
  const idx = users.findIndex((u) => u.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  const { name, email, role, password } = req.body || {};
  if (role !== undefined && !['BESTUUR', 'LEDEN'].includes(role)) {
    return res.status(400).json({ error: 'Rol moet BESTUUR of LEDEN zijn' });
  }
  if (password !== undefined && password.length < 6) {
    return res.status(400).json({ error: 'Wachtwoord min 6 tekens' });
  }
  if (name !== undefined) users[idx].name = String(name);
  if (email !== undefined) users[idx].email = String(email);
  if (role !== undefined) users[idx].role = role;
  if (password !== undefined) users[idx].passwordHash = await bcrypt.hash(password, 10);
  await writeJson(FILE, users);
  res.json(publicView(users[idx]));
});

router.delete('/:username', async (req, res) => {
  if (req.params.username === req.user.username) {
    return res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
  }
  const users = readJson(FILE, []);
  const next = users.filter((u) => u.username !== req.params.username);
  if (next.length === users.length) return res.status(404).json({ error: 'Niet gevonden' });
  await writeJson(FILE, next);
  res.json({ ok: true });
});

module.exports = router;
