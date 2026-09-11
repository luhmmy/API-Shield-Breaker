/* Launch one isolated Aegis target per team, each with its own FLAG_SALT.
   Usage:  node launch-targets.js  [path/to/aegis-target/server.js]
   Requires teams.json in the current directory (see make-teams.js).       */
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const teams = JSON.parse(fs.readFileSync('teams.json', 'utf8'));
const targetPath = process.argv[2] || path.join(__dirname, '..', 'aegis-target', 'server.js');
if (!fs.existsSync(targetPath)) { console.error('Cannot find target server at', targetPath); process.exit(1); }

console.log('\nLaunching', teams.length, 'isolated target instances:\n');
const kids = [];
for (const t of teams) {
  const child = fork(targetPath, [], {
    env: { ...process.env, PORT: String(t.port), FLAG_SALT: t.salt, INSTANCE_NAME: t.name },
    stdio: 'inherit'
  });
  kids.push(child);
  console.log(`  ${t.name.padEnd(20)} -> http://<host>:${t.port}/   (salt ${t.salt})`);
}
console.log('\nAll targets up. One per team. Front them with a reverse proxy for clean URLs (see MULTI-TEAM.md).');
console.log('Press Ctrl+C to stop all of them.\n');

function shutdown() { console.log('\nStopping all targets...'); kids.forEach(k => { try { k.kill(); } catch (e) {} }); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
