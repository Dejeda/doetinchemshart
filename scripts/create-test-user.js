// Maakt (of werkt bij) een password-flow test-account in de Turso DB.
// Bedoeld om te draaien in Render Shell of lokaal met dezelfde env-vars.
//
// Gebruik:
//   node scripts/create-test-user.js                                  # defaults
//   node scripts/create-test-user.js testaccount Test1234! LEDEN      # met args
//   node scripts/create-test-user.js testbestuur Test1234! BESTUUR    # voor BESTUUR-test
//
// Args (alle optioneel):
//   1. username  (default: testaccount)
//   2. password  (default: Test1234!)
//   3. role      (default: LEDEN; ook BESTUUR mag)
//   4. name      (default: "Test Account")
//
// Bestaat het account al? Dan wordt wachtwoord/rol/naam bijgewerkt en
// eventueel ingestelde 2FA gewist (zodat je de setup-flow opnieuw kunt testen).

const bcrypt = require('bcryptjs');
const store = require('../lib/store');

async function main() {
  const username = process.argv[2] || 'testaccount';
  const password = process.argv[3] || 'Test1234!';
  const role = process.argv[4] || 'LEDEN';
  const name = process.argv[5] || 'Test Account';

  if (!['BESTUUR', 'LEDEN'].includes(role)) {
    console.error(`Rol moet BESTUUR of LEDEN zijn, niet "${role}"`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Wachtwoord moet minimaal 6 tekens zijn');
    process.exit(1);
  }

  await store.init({ 'users.json': [] });
  const users = store.readJson('users.json', []);
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  const passwordHash = await bcrypt.hash(password, 10);

  if (idx === -1) {
    users.push({
      username,
      name,
      email: '',
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
      authProvider: 'password',
    });
    console.log(`Nieuw account aangemaakt: ${username}`);
  } else {
    delete users[idx].totpSecret;
    delete users[idx].totpEnabledAt;
    delete users[idx].backupCodes;
    users[idx].passwordHash = passwordHash;
    users[idx].role = role;
    users[idx].name = name;
    users[idx].authProvider = 'password';
    console.log(`Bestaand account "${username}" bijgewerkt (wachtwoord en rol vervangen, 2FA gereset).`);
  }

  await store.writeJson('users.json', users);

  console.log('');
  console.log('--------------------------------------------------');
  console.log('  Username : ' + username);
  console.log('  Password : ' + password);
  console.log('  Role     : ' + role);
  console.log('--------------------------------------------------');
  console.log('');
  console.log('Login: site → "Inloggen met wachtwoord (noodingang)" → bovenstaande credentials.');
  console.log('Eerste login triggert de 2FA setup-flow.');

  process.exit(0);
}

main().catch((e) => {
  console.error('Fout:', e.message);
  process.exit(1);
});
