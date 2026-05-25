const express = require('express');
const { readJson, writeJson, nextId } = require('../lib/store');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const FILE = 'agenda.json';

// Anyone logged in can read agenda items
router.get('/', (req, res) => {
  const items = readJson(FILE, []);
  // Members only see public items
  const visible = req.user.role === 'BESTUUR' ? items : items.filter((i) => i.visibility !== 'BESTUUR');
  visible.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  res.json(visible);
});

// Only bestuur can write
router.post('/', requireRole('BESTUUR'), async (req, res) => {
  const { title, date, time, location, description, visibility } = req.body || {};
  if (!title || !date) return res.status(400).json({ error: 'Titel en datum verplicht' });
  const items = readJson(FILE, []);
  const item = {
    id: nextId(items),
    title: String(title),
    date: String(date),
    time: time ? String(time) : '',
    location: location ? String(location) : '',
    description: description ? String(description) : '',
    visibility: visibility === 'BESTUUR' ? 'BESTUUR' : 'ALL',
    createdAt: new Date().toISOString(),
    createdBy: req.user.username,
  };
  items.push(item);
  await writeJson(FILE, items);
  res.status(201).json(item);
});

router.put('/:id', requireRole('BESTUUR'), async (req, res) => {
  const id = Number(req.params.id);
  const items = readJson(FILE, []);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  const { title, date, time, location, description, visibility } = req.body || {};
  items[idx] = {
    ...items[idx],
    ...(title !== undefined && { title: String(title) }),
    ...(date !== undefined && { date: String(date) }),
    ...(time !== undefined && { time: String(time) }),
    ...(location !== undefined && { location: String(location) }),
    ...(description !== undefined && { description: String(description) }),
    ...(visibility !== undefined && { visibility: visibility === 'BESTUUR' ? 'BESTUUR' : 'ALL' }),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(FILE, items);
  res.json(items[idx]);
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
