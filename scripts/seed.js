// Optional helper for local development: creates default accounts in the store
// if none exist. Production uses INITIAL_BESTUUR_* env vars on first boot.
//
// Usage:  node scripts/seed.js

const bcrypt = require('bcryptjs');
const store = require('../lib/store');

(async () => {
  await store.init({ 'users.json': [], 'agenda.json': [], 'announcements.json': [] });

  const users = store.readJson('users.json', []);
  if (users.length > 0) {
    console.log('Er bestaan al gebruikers; seed overgeslagen.');
    process.exit(0);
  }

  const seeded = [
    {
      username: 'bestuur',
      name: 'Bestuurslid',
      email: '',
      role: 'BESTUUR',
      passwordHash: bcrypt.hashSync('bestuur123', 10),
      createdAt: new Date().toISOString(),
    },
    {
      username: 'lid',
      name: 'Demo Lid',
      email: '',
      role: 'LEDEN',
      passwordHash: bcrypt.hashSync('lid123', 10),
      createdAt: new Date().toISOString(),
    },
  ];
  await store.writeJson('users.json', seeded);
  console.log('+ Standaard accounts aangemaakt:');
  console.log('  bestuur / bestuur123   (BESTUUR)');
  console.log('  lid     / lid123       (LEDEN)');
  console.log('\nWijzig de wachtwoorden via Mijn account na inloggen.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
