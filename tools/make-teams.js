/* Generate teams.json for multi-team (isolated) mode.
   Usage:
     node make-teams.js "Team Alausa" "Team Ikeja" "Team Mayfair" "Team Hex" "Team Shield"
   or with no args it uses 5 default names.
   Writes ./teams.json — copy it next to BOTH the console (apishield-live/)
   and use it with the launcher (launch-targets.js).                        */
const fs = require('fs');
const crypto = require('crypto');

let names = process.argv.slice(2);
if (names.length === 0) names = ['Team Alpha','Team Bravo','Team Charlie','Team Delta','Team Echo'];

const BASE_PORT = parseInt(process.env.BASE_PORT || '4001', 10);
const teams = names.map((name, i) => ({
  name,
  salt: crypto.randomBytes(3).toString('hex'),                 // unique per team
  code: String(Math.floor(1000 + Math.random() * 9000)),      // 4-digit join code
  port: BASE_PORT + i
}));

fs.writeFileSync('teams.json', JSON.stringify(teams, null, 2));

console.log('\nWrote teams.json with', teams.length, 'teams:\n');
console.log('  TEAM                 PORT   SALT      JOIN CODE');
console.log('  ' + '-'.repeat(48));
for (const t of teams) {
  console.log('  ' + t.name.padEnd(20) + t.port.toString().padEnd(7) + t.salt.padEnd(10) + t.code);
}
console.log('\nNext:');
console.log('  1. Copy teams.json next to apishield-live/server.js  (locks the console to these teams)');
console.log('  2. Run the launcher:  node launch-targets.js         (starts one target per team)');
console.log('  3. Give each team their own target URL + their join code.\n');
