const express = require('express');
const drive = require('../lib/drive');

const router = express.Router();

function sectionForRequest(req, sectionKey) {
  const def = drive.sectionDef(sectionKey);
  if (!def) return null;
  if (!(def.roles || []).includes(req.user.role)) return null;
  return def;
}

router.get('/status', (req, res) => {
  res.json(drive.getStatus());
});

router.get('/sections', (req, res) => {
  res.json(drive.sectionsForRole(req.user.role));
});

router.get('/list/:section', async (req, res) => {
  const def = sectionForRequest(req, req.params.section);
  if (!def) return res.status(404).json({ error: 'Sectie onbekend of geen toegang' });
  try {
    const entries = await drive.listFiles(req.params.section);
    res.json({ entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/download/:section/:fileId', async (req, res) => {
  const def = sectionForRequest(req, req.params.section);
  if (!def) return res.status(404).json({ error: 'Sectie onbekend of geen toegang' });
  try {
    const meta = await drive.getFileMeta(req.params.fileId);
    if (meta.trashed) return res.status(404).json({ error: 'Bestand verwijderd' });
    const belongs = await drive.fileBelongsToSection(req.params.fileId, req.params.section);
    if (!belongs) return res.status(404).json({ error: 'Bestand niet in deze sectie' });

    const filename = meta.name || req.params.fileId;
    const mimeType = meta.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    const stream = await drive.downloadStream(req.params.fileId);
    stream.on('error', (err) => {
      console.error('[drive] download stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
