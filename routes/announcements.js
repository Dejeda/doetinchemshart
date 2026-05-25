const express = require('express');
const { readJson, writeJson, nextId } = require('../lib/store');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const FILE = 'announcements.json';

router.get('/', (req, res) => {
  const items = readJson(FILE, []);
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(items);
});

router.post('/', requireRole('BESTUUR'), async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'Titel en bericht verplicht' });
  const items = readJson(FILE, []);
  const item = {
    id: nextId(items),
    title: String(title),
    body: String(body),
    createdAt: new Date().toISOString(),
    createdBy: req.user.username,
  };
  items.push(item);
  await writeJson(FILE, items);
  res.status(201).json(item);
});

router.delete('/:id', requireRole('BESTUUR'), async (req, res) => {
  const id = Number(req.params.id);
  const items = readJson(FILE, []);
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) return res.status(404).json({ error: 'Niet gevonden' });
  await writeJson(FILE, next);
  res.json({ ok: true });
});

module.exports = router;
