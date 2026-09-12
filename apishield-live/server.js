/* =====================================================================
   APIShield Breaker — Live CTF Server
   API Shield Summit 1.0 · APIsec University Nigeria × CybariK
   ---------------------------------------------------------------------
   Zero dependencies. Run:  node server.js
   Teams:  http://<your-laptop-ip>:3000/
   Admin:  http://<your-laptop-ip>:3000/admin?key=<ADMIN_KEY>
   ===================================================================== */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || ('shield-' + crypto.randomBytes(2).toString('hex'));
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'ctf-state.json');

/* ---------- FLAG CONFIG (edit here if the spec changes) ----------
   `body` is the text inside APISHIELD{...}. Per-team instances append a
   salt (APISHIELD{body__salt}); the console validates each submission
   against the submitting team's own salt. */
const FLAGS = [
  {id:'F1', num:1, name:'Programme Leak',         rail:'Aegis ID',      owasp:'API8 · Security Misconfiguration',  diff:'easy', points:75,  body:'sw4gger_left_the_door_open'},
  {id:'F2', num:2, name:'Read Any CDR',           rail:'Aegis Connect', owasp:'API1 · BOLA',                       diff:'easy', points:150, body:'cdr_b0la_no_owner_check'},
  {id:'F3', num:3, name:'OTP-Reuse Takeover',     rail:'Aegis Pay',     owasp:'API2 · Broken Authentication',      diff:'med',  points:200, body:'otp_reuse_full_ato'},
  {id:'F4', num:4, name:'Print Your Own Badge',   rail:'Aegis Pay',     owasp:'API3 · BOPLA',                      diff:'med',  points:200, body:'mass_assign_kyc_tier3'},
  {id:'F5', num:5, name:'Coupon Stacking',        rail:'Aegis Mall',    owasp:'API6 · Sensitive Business Flows',   diff:'med',  points:175, body:'coupon_stack_to_zero'},
  {id:'F6', num:6, name:'Drop the Shield (GRAND)',rail:'Aegis Group',   owasp:'API2+API5 · Auth + Function-Level', diff:'hard', points:400, body:'shield_is_down_settlement_drained'},
];
const FB_BONUS = 0.10, FB_BONUS_GRAND = 0.25, GRAND_ID = 'F6';

const norm = s => (s||'').trim().toLowerCase().replace(/\s+/g,'');
const flagStr = (f, salt) => 'APISHIELD{'+f.body+(salt?'__'+salt:'')+'}';
const flagById = id => FLAGS.find(f => f.id === id);
// validate a submitted string against a given team's salt (empty salt in open mode)
const flagForTeam = (raw, salt) => FLAGS.find(f => norm(flagStr(f, salt)) === norm(raw));

/* ---------- TEAMS CONFIG (optional) ----------
   Drop a teams.json next to this file to run locked multi-team mode:
   [ {"name":"Team Alausa","salt":"a1b2","code":"1234"}, ... ]
   - salt  : must match the FLAG_SALT of that team's target instance
   - code  : optional join code so teams can't pick each other's name
   No file => open mode: anyone types a team name, flags carry no salt. */
let TEAMS_CFG = [];
try{ const t = JSON.parse(fs.readFileSync(path.join(__dirname,'teams.json'),'utf8')); if(Array.isArray(t)) TEAMS_CFG = t; }catch(e){}
const LOCKED = TEAMS_CFG.length > 0;

/* ---------- STATE ---------- */
let state = loadState();
function blankState(){ return { event:{durationSec:1800, status:'idle', startEpoch:null, accMs:0}, teams:{}, captures:[] }; }
function loadState(){
  try{ const s = JSON.parse(fs.readFileSync(STATE_FILE,'utf8')); if(s && s.event) return s; }catch(e){}
  return blankState();
}
let saveTimer=null;
function saveState(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{ try{ const dir=path.dirname(STATE_FILE); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(STATE_FILE, JSON.stringify(state)); }catch(e){} }, 120); }

// In locked mode, ensure every configured team exists with its salt/code.
if(LOCKED){
  for(const t of TEAMS_CFG){
    let team=Object.values(state.teams).find(x=>x.name.toLowerCase()===String(t.name).toLowerCase());
    if(!team){ const id='t'+crypto.randomBytes(4).toString('hex'); team={id, name:t.name, joinedAt:Date.now()}; state.teams[id]=team; }
    team.salt=t.salt||''; team.code=t.code?String(t.code):'';   // refresh from config
  }
  saveState();
}

/* ---------- TIMER MATHS ---------- */
function elapsedMs(){
  const e=state.event;
  if(e.status==='running' && e.startEpoch) return e.accMs + (Date.now()-e.startEpoch);
  return e.accMs;
}
function remainingSec(){ return Math.max(0, state.event.durationSec - elapsedMs()/1000); }
function checkEnd(){
  if(state.event.status==='running' && remainingSec()<=0){
    state.event.accMs=state.event.durationSec*1000; state.event.startEpoch=null; state.event.status='ended';
    saveState(); return true;
  }
  return false;
}

/* ---------- SCORING ---------- */
function teamCaptures(id){ return state.captures.filter(c=>c.teamId===id).sort((a,b)=>a.elapsedMs-b.elapsedMs); }
function teamPoints(id){
  let p=0;
  for(const c of teamCaptures(id)){ const f=flagById(c.flagId); if(!f) continue; p+=f.points; if(c.firstBlood) p+=Math.round(f.points*(f.id===GRAND_ID?FB_BONUS_GRAND:FB_BONUS)); }
  return p;
}
function teamElapsed(id){ const c=teamCaptures(id); return c.length? Math.max(...c.map(x=>x.elapsedMs)) : 0; }

/* ---------- PUBLIC SNAPSHOT (never includes flag strings) ---------- */
function snapshot(){
  const teams=Object.values(state.teams);
  const standings=teams.map(t=>({
      teamId:t.id, name:t.name, points:teamPoints(t.id),
      flags:teamCaptures(t.id).length, elapsed:teamElapsed(t.id),
      captured:teamCaptures(t.id).map(c=>({flagId:c.flagId, num:flagById(c.flagId).num, at:c.at, elapsedMs:c.elapsedMs, firstBlood:c.firstBlood}))
    }))
    .sort((a,b)=> b.points-a.points || a.elapsed-b.elapsed || a.name.localeCompare(b.name));
  const feed=[...state.captures].sort((a,b)=>b.at-a.at).slice(0,40).map(c=>{
    const f=flagById(c.flagId), t=state.teams[c.teamId];
    return {team:t?t.name:'?', flagId:c.flagId, num:f.num, at:c.at, elapsedMs:c.elapsedMs, firstBlood:c.firstBlood};
  });
  return {
    serverNow:Date.now(),
    event:{durationSec:state.event.durationSec, status:state.event.status, startEpoch:state.event.startEpoch, accMs:state.event.accMs},
    flags:FLAGS.map(f=>({id:f.id, num:f.num, name:f.name, rail:f.rail, diff:f.diff, points:f.points})),
    teams:teams.map(t=>({id:t.id, name:t.name})),
    standings, feed,
    totalFlags:FLAGS.length,
    locked:LOCKED
  };
}

/* ---------- SSE ---------- */
const clients=new Set();
function broadcast(){ const data='data: '+JSON.stringify(snapshot())+'\n\n'; for(const res of clients){ try{ res.write(data); }catch(e){} } }
setInterval(()=>{ if(checkEnd()) broadcast(); }, 1000);
// heartbeat: SSE comment every 20s so reverse proxies don't close an idle stream
setInterval(()=>{ for(const res of clients){ try{ res.write(': ping\n\n'); }catch(e){} } }, 20000);

/* ---------- HELPERS ---------- */
function send(res, code, body, type='application/json'){ res.writeHead(code, {'Content-Type':type, 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*'}); res.end(typeof body==='string'?body:JSON.stringify(body)); }
function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch(e){ r({}); } }); }); }
function isAdmin(url){ return (url.searchParams.get('key')===ADMIN_KEY); }

/* ---------- SERVER ---------- */
const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url, `http://${req.headers.host}`);
  const p=url.pathname;

  // pages
  if(p==='/' && req.method==='GET') return send(res,200,PLAYER_HTML,'text/html');
  if(p==='/admin' && req.method==='GET') return send(res,200,ADMIN_HTML,'text/html');

  // live stream
  if(p==='/events' && req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*','X-Accel-Buffering':'no'});
    res.write('retry: 3000\n\n'); res.write('data: '+JSON.stringify(snapshot())+'\n\n');
    clients.add(res); req.on('close',()=>clients.delete(res)); return;
  }

  // initial state
  if(p==='/api/state' && req.method==='GET') return send(res,200,snapshot());

  // team join
  if(p==='/api/join' && req.method==='POST'){
    const b=await readBody(req); const name=(b.name||'').trim();
    if(!name) return send(res,400,{ok:false,error:'Enter a team name.'});
    let team=Object.values(state.teams).find(t=>t.name.toLowerCase()===name.toLowerCase());
    if(LOCKED){
      if(!team) return send(res,400,{ok:false,error:'Pick your assigned team from the list.'});
      if(team.code && String(b.code||'')!==team.code) return send(res,403,{ok:false,error:'Wrong team code.'});
      return send(res,200,{ok:true, teamId:team.id, name:team.name});
    }
    if(!team){ const id='t'+crypto.randomBytes(4).toString('hex'); team={id, name, joinedAt:Date.now()}; state.teams[id]=team; saveState(); broadcast(); }
    return send(res,200,{ok:true, teamId:team.id, name:team.name});
  }

  // flag submit
  if(p==='/api/submit' && req.method==='POST'){
    const b=await readBody(req); const teamId=b.teamId, raw=b.flag||'';
    const team=state.teams[teamId];
    if(!team) return send(res,400,{ok:false, error:'Join with a team name first.'});
    checkEnd();
    if(state.event.status==='idle') return send(res,200,{ok:false, error:'The round hasn\'t started yet.'});
    if(state.event.status==='ended') return send(res,200,{ok:false, error:'Time\'s up — the round has ended.'});
    if(state.event.status==='paused') return send(res,200,{ok:false, error:'The round is paused.'});
    if(!raw.trim()) return send(res,200,{ok:false, error:'Paste a flag to submit.'});
    const flag=flagForTeam(raw, team.salt||'');
    if(!flag){
      // if it's a valid flag but for someone else's instance, say so plainly
      const other = FLAGS.find(f => norm(raw).startsWith(norm('APISHIELD{'+f.body)));
      return send(res,200,{ok:false, error: other ? 'That flag isn\'t from your team\'s range.' : 'That\'s not a valid flag. Check for typos.'});
    }
    if(state.captures.some(c=>c.teamId===teamId && c.flagId===flag.id))
      return send(res,200,{ok:false, error:`Your team already captured Flag ${flag.num}.`});
    const firstBlood=!state.captures.some(c=>c.flagId===flag.id);
    const cap={teamId, flagId:flag.id, at:Date.now(), elapsedMs:elapsedMs(), firstBlood};
    state.captures.push(cap); saveState(); broadcast();
    return send(res,200,{ok:true, num:flag.num, name:flag.name, points:flag.points, firstBlood,
      elapsedMs:cap.elapsedMs, at:cap.at, teamTotalMs:teamElapsed(teamId)});
  }

  // admin controls (require key)
  if(p.startsWith('/api/admin/')){
    if(!isAdmin(url)) return send(res,403,{ok:false, error:'Bad admin key.'});
    const action=p.split('/').pop();
    const b=(req.method==='POST')?await readBody(req):{};
    const e=state.event;
    if(action==='start'){ if(e.status!=='running' && e.status!=='ended'){ e.startEpoch=Date.now(); e.status='running'; } }
    else if(action==='pause'){ if(e.status==='running'){ e.accMs+=Date.now()-e.startEpoch; e.startEpoch=null; e.status='paused'; } }
    else if(action==='reset'){ e.status='idle'; e.startEpoch=null; e.accMs=0; }
    else if(action==='duration'){ const m=parseInt(b.minutes,10); if(m>0 && e.status!=='running') e.durationSec=m*60; }
    else if(action==='clear'){ state.captures=[]; e.status='idle'; e.startEpoch=null; e.accMs=0; }
    else if(action==='wipe'){ const d=e.durationSec; state=blankState(); state.event.durationSec=d; }
    else return send(res,404,{ok:false,error:'Unknown action.'});
    saveState(); broadcast(); return send(res,200,{ok:true, snapshot:snapshot()});
  }

  // answer key + export (require key)
  if(p==='/api/answers' && req.method==='GET'){
    if(!isAdmin(url)) return send(res,403,{ok:false,error:'Bad admin key.'});
    const teamsOut = LOCKED
      ? Object.values(state.teams).map(t=>({team:t.name, salt:t.salt||'', code:t.code||'', flags:FLAGS.map(f=>({num:f.num, name:f.name, flag:flagStr(f, t.salt||'')}))}))
      : null;
    return send(res,200,{ok:true, locked:LOCKED,
      flags:FLAGS.map(f=>({id:f.id,num:f.num,name:f.name,rail:f.rail,owasp:f.owasp,points:f.points,flag:flagStr(f,'')})),
      teams:teamsOut});
  }
  if(p==='/api/export' && req.method==='GET'){
    if(!isAdmin(url)) return send(res,403,{ok:false,error:'Bad admin key.'});
    if(url.searchParams.get('fmt')==='csv'){
      let csv='Team,Flag,Name,OWASP,Points,FirstBlood,TimeSubmitted,TimeToReveal\n';
      for(const c of state.captures){ const f=flagById(c.flagId), t=state.teams[c.teamId];
        csv+=`"${t?t.name:'?'}",${f.id},"${f.name}","${f.owasp}",${f.points},${c.firstBlood?'yes':'no'},${new Date(c.at).toISOString()},${fmtT(c.elapsedMs)}\n`; }
      res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="apishield_results.csv"'}); return res.end(csv);
    }
    return send(res,200,{standings:snapshot().standings, captures:state.captures.map(c=>{const f=flagById(c.flagId),t=state.teams[c.teamId];return{team:t?t.name:'?',flag:f.id,name:f.name,firstBlood:c.firstBlood,timeSubmitted:new Date(c.at).toISOString(),timeToReveal:fmtT(c.elapsedMs)};})});
  }

  send(res,404,{ok:false,error:'Not found'});
});
function fmtT(ms){ let s=Math.floor(ms/1000); const h=Math.floor(s/3600); s%=3600; const m=Math.floor(s/60); s%=60; const mm=String(m).padStart(2,'0'), ss=String(s).padStart(2,'0'); return h>0?`${h}:${mm}:${ss}`:`${mm}:${ss}`; }

server.listen(PORT, ()=>{
  const nets=require('os').networkInterfaces(); let ip='localhost';
  for(const name of Object.keys(nets)) for(const n of nets[name]) if(n.family==='IPv4' && !n.internal){ ip=n.address; break; }
  console.log('\n  ┌───────────────────────────────────────────────────────┐');
  console.log('  │   APISHIELD BREAKER — Live CTF Server is running       │');
  console.log('  └───────────────────────────────────────────────────────┘');
  console.log(`\n   Players  →  http://${ip}:${PORT}/`);
  console.log(`   Admin    →  http://${ip}:${PORT}/admin?key=${ADMIN_KEY}`);
  console.log(`\n   ADMIN KEY: ${ADMIN_KEY}`);
  console.log(`   (share the Players URL on the venue Wi-Fi; keep the Admin URL to yourself)\n`);
});

/* =====================================================================
   CLIENT PAGES
   ===================================================================== */
const SHARED_CSS = `
:root{--berry:#A83A67;--teal:#2C7488;--deep-teal:#1D6070;--plum:#6E2B58;--ink:#1a1220;--paper:#faf6f8;--card:#fff;--line:#ecdfe6;--muted:#7a6b74;--good:#1B7A4B;--bad:#B3261E;--gold:#C9922B;--display:'Anton',Impact,sans-serif;--body:'Montserrat',system-ui,sans-serif}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:var(--body);color:var(--ink);min-height:100vh;background:
 radial-gradient(circle at 12% 8%,rgba(168,58,103,.06),transparent 40%),
 radial-gradient(circle at 88% 92%,rgba(44,116,136,.07),transparent 42%),
 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='96' viewBox='0 0 56 96'%3E%3Cg fill='none' stroke='%236e2b58' stroke-opacity='0.05' stroke-width='1.5'%3E%3Cpath d='M28 1 55 16v32L28 63 1 48V16z'/%3E%3Cpath d='M28 49 55 64v32L28 111 1 96V64z'/%3E%3C/g%3E%3C/svg%3E"),var(--paper)}
header.top{background:linear-gradient(100deg,var(--plum),var(--berry) 55%,var(--teal));color:#fff;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 2px 18px rgba(110,43,88,.25)}
.brand{display:flex;align-items:center;gap:14px}
.shield{width:36px;height:42px;background:#fff;color:var(--berry);clip-path:polygon(50% 0,100% 22%,100% 62%,50% 100%,0 62%,0 22%);display:grid;place-items:center;font-family:var(--display);font-size:20px}
.brand h1{font-family:var(--display);font-weight:400;font-size:24px;letter-spacing:.5px;margin:0;line-height:1}
.brand p{margin:2px 0 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.85}
.pill{font-family:var(--display);font-size:14px;letter-spacing:1px;padding:7px 15px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);text-transform:uppercase}
.pill.running{background:var(--good);border-color:var(--good)}.pill.paused{background:var(--gold);border-color:var(--gold)}.pill.ended{background:var(--bad);border-color:var(--bad)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:18px;box-shadow:0 4px 20px rgba(110,43,88,.05)}
.eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--teal);font-weight:700;margin-bottom:6px}
h2{font-family:var(--display);font-weight:400;font-size:20px;letter-spacing:.5px;margin:0 0 12px;color:var(--plum)}
label.fld{display:block;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
input.txt{font-family:var(--body);font-size:16px;padding:13px 15px;border:1.5px solid var(--line);border-radius:10px;width:100%;background:#fff;color:var(--ink)}
input.txt:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(44,116,136,.12)}
button.btn{font-family:var(--body);font-weight:700;font-size:15px;letter-spacing:.4px;border:none;border-radius:10px;padding:13px 22px;cursor:pointer;transition:.15s;color:#fff;background:var(--berry)}
button.btn:hover{filter:brightness(1.06)}button.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.start{background:var(--good)}.btn.pause{background:var(--gold)}.btn.reset{background:var(--deep-teal)}.btn.danger{background:var(--bad)}.btn.ghost{background:transparent;color:var(--plum);border:1.5px solid var(--line)}
.clock{font-family:var(--display);font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:2px;color:var(--ink)}
.clock.low{color:var(--bad);animation:pulse 1s infinite}@keyframes pulse{50%{opacity:.5}}
.fb{display:inline-block;background:var(--gold);color:#fff;font-weight:800;font-size:10px;letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border-radius:999px}
.muted{color:var(--muted)}
`;

const PLAYER_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APIShield Breaker — Submit</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${SHARED_CSS}
main{max-width:560px;margin:0 auto;padding:20px 16px 50px}
.clock{font-size:42px;text-align:center}
.flagrow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed var(--line);font-size:14px}
.flagrow:last-child{border-bottom:none}
.fnum{font-family:var(--display);color:var(--berry);min-width:64px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--line)}.dot.done{background:var(--good)}
.result{margin-top:14px;border-radius:12px;padding:14px 16px;border:1.5px solid;display:none;font-size:14px}
.result.show{display:block}.result.ok{background:#eafaf1;border-color:var(--good);color:var(--good)}.result.err{background:#fdeeed;border-color:var(--bad);color:var(--bad)}
.feeditem{font-size:13px;padding:8px 0;border-bottom:1px solid var(--line)}.feeditem:last-child{border:none}
.feeditem b{color:var(--plum)}
</style></head><body>
<header class="top"><div class="brand"><div class="shield">AB</div><div><h1>APIShield Breaker</h1><p>Break the shield</p></div></div><div class="pill" id="pill">—</div></header>
<main>
 <div class="card" style="text-align:center"><div class="eyebrow">Time remaining</div><div class="clock" id="clock">--:--</div></div>

 <div class="card" id="joinCard">
  <div class="eyebrow">Step 1</div><h2 id="joinTitle">Join with your team name</h2>
  <div id="joinFields">
   <label class="fld" for="tname">Team name</label>
   <input class="txt" id="tname" placeholder="e.g. Team Alausa" onkeydown="if(event.key==='Enter')join()">
  </div>
  <div style="margin-top:12px"><button class="btn" style="width:100%" onclick="join()">Join round</button></div>
 </div>

 <div class="card" id="playCard" style="display:none">
  <div class="eyebrow">Submitting as</div><h2 id="teamLabel"></h2>
  <label class="fld" for="flag">Flag</label>
  <input class="txt" id="flag" placeholder="APISHIELD{...}" onkeydown="if(event.key==='Enter')submit()">
  <div style="margin-top:12px"><button class="btn" style="width:100%" onclick="submit()">Submit flag</button></div>
  <div class="result" id="result"></div>
  <div style="margin-top:20px"><div class="eyebrow">Your captures</div><div id="myflags"></div></div>
 </div>

 <div class="card"><div class="eyebrow">Live</div><h2>Latest captures</h2><div id="feed"><p class="muted" style="font-size:13px">Waiting for the first capture…</p></div></div>
</main>
<script>
let me_id=localStorage.getItem('ab_team_id')||null, me_name=localStorage.getItem('ab_team_name')||null, snap=null, offset=0;
if(me_id){ document.getElementById('joinCard').style.display='none'; document.getElementById('playCard').style.display='block'; document.getElementById('teamLabel').textContent=me_name; }
let joinBuilt=false;
function buildJoinUI(){
  if(joinBuilt||!snap) return; joinBuilt=true;
  if(snap.locked){
    document.getElementById('joinTitle').textContent='Select your assigned team';
    const opts=snap.teams.map(t=>'<option value="'+esc(t.name)+'">'+esc(t.name)+'</option>').join('');
    document.getElementById('joinFields').innerHTML=
      '<label class="fld" for="tsel">Team</label><select class="txt" id="tsel">'+opts+'</select>'+
      '<label class="fld" for="tcode" style="margin-top:12px">Team code (if given)</label>'+
      '<input class="txt" id="tcode" placeholder="leave blank if none" onkeydown="if(event.key===\\'Enter\\')join()">';
  }
}
async function join(){
  const locked=snap&&snap.locked;
  const name=locked?document.getElementById('tsel').value:(document.getElementById('tname').value.trim());
  const code=locked?document.getElementById('tcode').value.trim():'';
  if(!name)return;
  const r=await fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code})});
  const d=await r.json(); if(!d.ok){alert(d.error);return;}
  me_id=d.teamId; me_name=d.name; localStorage.setItem('ab_team_id',me_id); localStorage.setItem('ab_team_name',me_name);
  document.getElementById('joinCard').style.display='none'; document.getElementById('playCard').style.display='block'; document.getElementById('teamLabel').textContent=me_name;
}
async function submit(){
  const flag=document.getElementById('flag').value; const res=document.getElementById('result');
  const r=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId:me_id,flag})});
  const d=await r.json();
  res.className='result show '+(d.ok?'ok':'err');
  if(d.ok){ res.innerHTML='✓ <b>Flag '+d.num+' captured</b> — '+fmt(d.elapsedMs)+' in'+(d.firstBlood?' &nbsp;<span class="fb">First blood</span>':''); document.getElementById('flag').value=''; }
  else{ res.textContent='✕ '+d.error; }
}
function fmt(ms){let s=Math.floor(ms/1000);const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=n=>String(n).padStart(2,'0');return h>0?h+':'+p(m)+':'+p(s):p(m)+':'+p(s);}
function remaining(){ if(!snap)return 0; const e=snap.event; let el; const now=Date.now()+offset; if(e.status==='running'&&e.startEpoch)el=e.accMs+(now-e.startEpoch);else el=e.accMs; return Math.max(0,e.durationSec-el/1000); }
function render(){
  if(!snap)return; const e=snap.event;
  const pill=document.getElementById('pill'); const L={idle:'Not started',running:'Live',paused:'Paused',ended:'Ended'};
  pill.textContent=L[e.status]; pill.className='pill '+(e.status==='running'?'running':e.status==='paused'?'paused':e.status==='ended'?'ended':'');
  const me=snap.standings.find(s=>s.teamId===me_id);
  const done=new Set(me?me.captured.map(c=>c.num):[]);
  document.getElementById('myflags').innerHTML=snap.flags.map(f=>{
    const c=me&&me.captured.find(x=>x.num===f.num);
    return '<div class="flagrow"><span class="dot '+(done.has(f.num)?'done':'')+'"></span><span class="fnum">Flag '+f.num+'</span><span style="flex:1">'+(done.has(f.num)?'Captured'+(c.firstBlood?' <span class="fb">FB</span>':''):'<span class="muted">not yet</span>')+'</span><span class="muted">'+(c?fmt(c.elapsedMs):'')+'</span></div>';
  }).join('');
  document.getElementById('feed').innerHTML = snap.feed.length? snap.feed.map(f=>'<div class="feeditem"><b>'+esc(f.team)+'</b> captured <b>Flag '+f.num+'</b> · '+fmt(f.elapsedMs)+(f.firstBlood?' <span class="fb">FB</span>':'')+'</div>').join('') : '<p class="muted" style="font-size:13px">Waiting for the first capture…</p>';
}
function esc(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
const es=new EventSource('/events');
es.onmessage=ev=>{ snap=JSON.parse(ev.data); offset=snap.serverNow-Date.now(); buildJoinUI(); render(); };
setInterval(()=>{ const c=document.getElementById('clock'); const r=remaining(); c.textContent=fmt(r*1000); c.classList.toggle('low', r<=60 && snap&&snap.event.status==='running'); },500);
</script></body></html>`;

const ADMIN_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APIShield Breaker — Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${SHARED_CSS}
main{max-width:1200px;margin:0 auto;padding:22px 20px 60px}
.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:20px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.clock{font-size:clamp(56px,11vw,104px);text-align:center;line-height:.9}
.controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px}
.controls .btn{padding:11px 18px;font-size:14px}
.feedbox{max-height:420px;overflow:auto}
.feeditem{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;margin-bottom:8px;background:#faf2f6;border-left:4px solid var(--teal);animation:pop .3s}
.feeditem.fb{border-left-color:var(--gold);background:#fdf7ea}
@keyframes pop{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.feeditem .ft{font-family:var(--display);color:var(--plum);font-size:15px;min-width:52px}
.feeditem .fteam{font-weight:700;flex:1}
.feeditem .fwhen{color:var(--muted);font-size:12px;text-align:right;font-variant-numeric:tabular-nums}
table.board{width:100%;border-collapse:collapse;font-size:14px}
table.board th{font-size:11px;letter-spacing:1px;text-transform:uppercase;text-align:left;color:#fff;background:var(--deep-teal);padding:10px 12px}
table.board th:last-child{text-align:right}
table.board td{padding:10px 12px;border-bottom:1px solid var(--line)}
tr.trow{cursor:pointer}tr.trow:hover{background:#faf2f6}
.rank{font-family:var(--display);font-size:20px;color:var(--berry);width:40px}.rank.r1{color:var(--gold)}
.pts{font-family:var(--display);font-size:19px;text-align:right}
.detail td{background:#fbf6f8;padding:0}.detin{padding:4px 12px 12px 52px}
.fline{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px;flex-wrap:wrap}.fline:last-child{border:none}
.fline .n{font-family:var(--display);color:var(--plum);min-width:52px}
.keyprompt{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.answers code{display:block;background:var(--ink);color:#7CFFB2;padding:8px 11px;border-radius:6px;font-size:12px;word-break:break-all;font-family:ui-monospace,monospace;margin-top:4px}
.answers .arow{margin-bottom:12px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%) translateY(30px);background:var(--ink);color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;opacity:0;transition:.25s;z-index:60}.toast.show{opacity:1;transform:translateX(-50%)}
</style></head><body>
<header class="top"><div class="brand"><div class="shield">AB</div><div><h1>APIShield Breaker</h1><p>Admin dashboard</p></div></div><div class="pill" id="pill">—</div></header>
<main>
 <div class="card"><div class="clock" id="clock">--:--</div>
  <div class="controls">
   <button class="btn start" id="bStart">Start</button>
   <button class="btn pause" id="bPause">Pause</button>
   <button class="btn reset" id="bReset">Reset timer</button>
   <span style="display:inline-flex;gap:6px;align-items:center;margin-left:8px">
     <input class="txt" id="dur" type="number" min="1" value="30" style="width:80px;padding:9px 10px"><button class="btn ghost" id="bDur">Set min</button>
   </span>
   <button class="btn danger" id="bClear">Clear captures</button>
  </div>
 </div>

 <div class="grid">
  <div class="card"><div class="eyebrow">Live feed</div><h2>Captures as they happen</h2><div class="feedbox" id="feed"></div></div>
  <div class="card"><div class="eyebrow">Standings</div><h2>Scoreboard</h2><div id="board"></div></div>
 </div>

 <div class="card answers"><div class="eyebrow">Organisers only</div><h2>Answer key & export</h2>
  <div class="keyprompt">
   <div><label class="fld" for="akey">Admin key</label><input type="password" class="txt" id="akey" placeholder="paste admin key" style="width:220px"></div>
   <button class="btn ghost" onclick="loadKeys()">Show flags</button>
   <button class="btn ghost" onclick="dl('json')">Export JSON</button>
   <button class="btn ghost" onclick="dl('csv')">Export CSV</button>
  </div>
  <div id="answers" style="margin-top:16px"></div>
 </div>
</main>
<div class="toast" id="toast"></div>
<script>
let snap=null, offset=0, open=new Set();
const KEY=new URLSearchParams(location.search).get('key')||'';
if(KEY) document.getElementById('akey').value=KEY;
function fmt(ms){let s=Math.floor(ms/1000);const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=n=>String(n).padStart(2,'0');return h>0?h+':'+p(m)+':'+p(s):p(m)+':'+p(s);}
function clk(at){const d=new Date(at);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function esc(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function remaining(){ if(!snap)return 0; const e=snap.event; const now=Date.now()+offset; let el=(e.status==='running'&&e.startEpoch)?e.accMs+(now-e.startEpoch):e.accMs; return Math.max(0,e.durationSec-el/1000); }
async function ctl(action,body){ const r=await fetch('/api/admin/'+action+'?key='+encodeURIComponent(document.getElementById('akey').value),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}); const d=await r.json(); if(!d.ok)toast(d.error||'Failed'); }
document.getElementById('bStart').onclick=()=>ctl('start');
document.getElementById('bPause').onclick=()=>ctl('pause');
document.getElementById('bReset').onclick=()=>{ if(confirm('Reset the countdown to full? Captures are kept.'))ctl('reset'); };
document.getElementById('bDur').onclick=()=>ctl('duration',{minutes:parseInt(document.getElementById('dur').value,10)});
document.getElementById('bClear').onclick=()=>{ if(confirm('Clear ALL captures and reset the timer? Teams are kept.'))ctl('clear'); };
function render(){
  if(!snap)return; const e=snap.event;
  const pill=document.getElementById('pill'); const L={idle:'Idle',running:'Live',paused:'Paused',ended:'Ended'};
  pill.textContent=L[e.status]; pill.className='pill '+(e.status==='running'?'running':e.status==='paused'?'paused':e.status==='ended'?'ended':'');
  document.getElementById('bStart').disabled=(e.status==='running'||e.status==='ended');
  document.getElementById('bPause').disabled=(e.status!=='running');
  // feed
  document.getElementById('feed').innerHTML = snap.feed.length? snap.feed.map(f=>
    '<div class="feeditem '+(f.firstBlood?'fb':'')+'"><span class="ft">Flag '+f.num+'</span><span class="fteam">'+esc(f.team)+(f.firstBlood?' <span class="fb">First blood</span>':'')+'</span><span class="fwhen">'+clk(f.at)+'<br>'+fmt(f.elapsedMs)+' in</span></div>'
  ).join('') : '<p class="muted" style="font-size:13px">No captures yet. Feed updates the moment a team submits a correct flag.</p>';
  // board
  if(!snap.standings.length){ document.getElementById('board').innerHTML='<p class="muted" style="font-size:13px">No teams have joined yet.</p>'; }
  else{
    let h='<table class="board"><thead><tr><th>#</th><th>Team</th><th>Flags</th><th>Time</th><th>Points</th></tr></thead><tbody>';
    snap.standings.forEach((s,i)=>{
      h+='<tr class="trow" onclick="tog(\\''+s.teamId+'\\')"><td class="rank '+(i===0&&s.points>0?'r1':'')+'">'+(i+1)+'</td><td><b>'+esc(s.name)+'</b> ▾</td><td class="muted">'+s.flags+' / '+snap.totalFlags+'</td><td class="muted" style="font-variant-numeric:tabular-nums">'+(s.flags?fmt(s.elapsed):'—')+'</td><td class="pts">'+s.points+'</td></tr>';
      h+='<tr class="detail" '+(open.has(s.teamId)?'':'style="display:none"')+'><td colspan="5"><div class="detin">';
      if(!s.captured.length)h+='<span class="muted" style="font-size:13px">No flags yet.</span>';
      else{ let prev=0; s.captured.slice().sort((a,b)=>a.elapsedMs-b.elapsedMs).forEach(c=>{ const d=c.elapsedMs-prev; prev=c.elapsedMs; h+='<div class="fline"><span class="n">Flag '+c.num+'</span><span style="flex:1">'+(c.firstBlood?'<span class="fb">FB</span>':'')+'</span><span class="muted">reveal '+fmt(c.elapsedMs)+'</span><span class="muted">· '+clk(c.at)+'</span><span class="muted">· +'+fmt(d)+'</span></div>'; }); }
      h+='</div></td></tr>';
    });
    h+='</tbody></table>'; document.getElementById('board').innerHTML=h;
  }
}
function tog(id){ open.has(id)?open.delete(id):open.add(id); render(); }
async function loadKeys(){
  const r=await fetch('/api/answers?key='+encodeURIComponent(document.getElementById('akey').value)); const d=await r.json();
  if(!d.ok){toast(d.error);return;}
  if(d.locked && d.teams){
    document.getElementById('answers').innerHTML=d.teams.map(t=>
      '<div class="arow"><b>'+esc(t.team)+'</b> <span class="muted">(salt '+esc(t.salt)+(t.code?' · code '+esc(t.code):'')+')</span>'+
      t.flags.map(f=>'<code>Flag '+f.num+': '+esc(f.flag)+'</code>').join('')+'</div>'
    ).join('');
  } else {
    document.getElementById('answers').innerHTML=d.flags.map(f=>'<div class="arow"><b>Flag '+f.num+' · '+esc(f.name)+'</b> <span class="muted">('+f.points+' pts · '+esc(f.owasp)+')</span><code>'+esc(f.flag)+'</code></div>').join('');
  }
}
function dl(fmt){ const k=encodeURIComponent(document.getElementById('akey').value); window.open('/api/export?fmt='+fmt+'&key='+k,'_blank'); }
let tt; function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400);}
const es=new EventSource('/events');
es.onmessage=ev=>{ snap=JSON.parse(ev.data); offset=snap.serverNow-Date.now(); render(); };
setInterval(()=>{ const c=document.getElementById('clock'); const r=remaining(); c.textContent=fmt(r*1000); c.classList.toggle('low', r<=60 && snap&&snap.event.status==='running'); },500);
</script></body></html>`;
