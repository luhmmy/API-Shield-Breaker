/* =====================================================================
   AEGIS GROUP — Deliberately Vulnerable Target API
   The CTF range for APIShield Breaker · API Shield Summit 1.0
   ---------------------------------------------------------------------
   FOR ISOLATED, AUTHORISED CTF USE ONLY.
   This app is intentionally insecure by design — it is a training range,
   the same genre as OWASP Juice Shop / crAPI. Never expose it to a network
   you don't fully control, and never put real data in it.
   ---------------------------------------------------------------------
   Zero dependencies.  Run:  node server.js   (defaults to port 4000)
   ===================================================================== */

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;

/* --- intentionally weak signing secret (F6). Hint leaked via X-Debug. --- */
const JWT_SECRET = process.env.JWT_SECRET || 'aegis';   // the brand name, lowercased

/* --- flags. FLAG_SALT gives each team instance unique flag strings so a
   flag from one team's range won't validate for another. Empty salt =
   shared single-instance mode (original behaviour). --- */
const FLAG_SALT = process.env.FLAG_SALT || '';
const INSTANCE_NAME = process.env.INSTANCE_NAME || '';
const _s = FLAG_SALT ? '__'+FLAG_SALT : '';
const FLAG = {
  F1:`APISHIELD{sw4gger_left_the_door_open${_s}}`,
  F2:`APISHIELD{cdr_b0la_no_owner_check${_s}}`,
  F3:`APISHIELD{otp_reuse_full_ato${_s}}`,
  F4:`APISHIELD{mass_assign_kyc_tier3${_s}}`,
  F5:`APISHIELD{coupon_stack_to_zero${_s}}`,
  F6:`APISHIELD{shield_is_down_settlement_drained${_s}}`,
};

/* --- seeded target NPC (the "VIP" everyone pivots through) --- */
const TARGET_MSISDN = '+2348030000001';
const TARGET_NAME = 'Amara O.';
const TARGET_OTP = '738291';
const SETTLEMENT_ACCOUNT = 'AEGIS-SETTLE-0007';

/* --- per-player state (shared instance, isolated per token) --- */
const players = {}; // sub -> player

/* =====================  JWT (intentionally broken)  ===================== */
function b64urlJson(o){ return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function signJWT(payload){
  const h=b64urlJson({alg:'HS256',typ:'JWT'});
  const p=b64urlJson(payload);
  const sig=crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+p).digest('base64url');
  return `${h}.${p}.${sig}`;
}
function verifyJWT(token){
  if(!token) return null;
  const parts=token.split('.');
  if(parts.length<2) return null;
  let header, payload;
  try{
    header=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  }catch(e){ return null; }
  const alg=(header.alg||'').toLowerCase();
  if(alg==='none') return payload;                          // VULN: alg:none accepted
  if(header.alg==='HS256'){
    const expect=crypto.createHmac('sha256',JWT_SECRET).update(parts[0]+'.'+parts[1]).digest('base64url');
    if(parts[2]===expect) return payload;                   // VULN: weak secret ("aegis")
    return null;
  }
  return null;
}
function bearer(req){ const h=req.headers['authorization']||''; return h.startsWith('Bearer ')?h.slice(7):null; }
function currentUser(req){ const p=verifyJWT(bearer(req)); if(!p||!p.sub) return null; return {token:p, player:players[p.sub]}; }

/* =========================  HTTP plumbing  ============================= */
/* --- breadcrumb headers on every response (visible in Burp / raw curl) --- */
const HINT_HEADERS={
  'X-Aegis-Env':'staging',
  'X-Aegis-Diagnostics':'append header  X-Debug: true  for verbose errors (staging only)',
  'X-Aegis-Notes':'internal engineering backlog at /api/v2/internal/release-notes'
};
function send(res,code,obj,req){
  const body={...obj};
  if(code>=400 && req && String(req.headers['x-debug']).toLowerCase()==='true'){
    body.debug={                                            // VULN (F1): verbose debug leak
      trace:[
        'at AegisGateway.authorise (/srv/aegis/gateway/auth.js:88:14)',
        'at verifyToken (/srv/aegis/lib/jwt.js:41:9)',
        'at Object.handler (/srv/aegis/routes/'+ (req.url||'') +')'
      ],
      config:{
        jwt_alg:'HS256',
        jwt_secret_hint:'the company brand name, all lowercase (see /api/docs)',
        legacy_api:'/api/v1 is still routable — inventory not decommissioned',
        note:'TODO(sec): rotate JWT secret off the brand name before launch'
      }
    };
  }
  res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*',...HINT_HEADERS});
  res.end(JSON.stringify(body,null,2));
}
function html(res,code,str){ res.writeHead(code,{'Content-Type':'text/html',...HINT_HEADERS}); res.end(str); }
function text(res,code,str){ res.writeHead(code,{'Content-Type':'text/plain',...HINT_HEADERS}); res.end(str); }
function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(d?JSON.parse(d):{}); }catch(e){ r({}); } }); }); }

function newPlayer(handle){
  const sub='u'+crypto.randomBytes(4).toString('hex');
  const msisdn='+23480'+String(Math.floor(1000000+Math.random()*8999999));
  const p={
    sub, handle:handle||('guest_'+sub.slice(1,5)), msisdn,
    role:'subscriber', kyc_tier:0,
    profile:{name:handle||'Guest', email:(handle||'guest')+'@aegis.africa'},
    cart:{item:'Aegis Pro Bundle', price:50000, applied:[]},
    dashboard_note:'Nothing to see here yet.'
  };
  players[sub]=p;
  return p;
}

/* ===============================  CDR data  ============================ */
function cdrFor(msisdn){
  if(msisdn===TARGET_MSISDN){
    return {msisdn, subscriber:TARGET_NAME, tier:'VIP', records:[
      {ts:'2026-09-12T08:14:03Z', type:'sms', dir:'in', from:'AegisPay',
        sms_body:`Your Aegis Pay password reset code is ${TARGET_OTP}. Do not share it. ${FLAG.F2}`},
      {ts:'2026-09-12T08:02:55Z', type:'voice', dir:'out', to:'+2348030000042', duration_s:143},
      {ts:'2026-09-11T19:31:10Z', type:'data', bytes:284000000, apn:'aegis.internet'},
    ]};
  }
  // any other number also returns records (that's the BOLA) — with a breadcrumb to the VIP
  return {msisdn, subscriber:'Subscriber', tier:'standard', records:[
    {ts:'2026-09-12T07:55:00Z', type:'voice', dir:'in', from:TARGET_MSISDN,
      note:`Missed call from ${TARGET_MSISDN} (${TARGET_NAME}, VIP)`},
    {ts:'2026-09-11T22:10:00Z', type:'sms', dir:'in', from:'AegisMall', sms_body:'Your order shipped.'},
  ]};
}

/* ===============================  ROUTER  ============================= */
const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host}`);
  const p=url.pathname, m=req.method;
  if(m==='OPTIONS'){ res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}); return res.end(); }

  /* ---- landing ---- */
  if(p==='/' && m==='GET') return html(res,200,LANDING);

  /* ---- recon breadcrumbs ---- */
  if(p==='/robots.txt' && m==='GET'){
    return text(res,200,
`User-agent: *
Disallow: /api/docs
Disallow: /api/v1/
Disallow: /internal/
Disallow: /api/v2/internal/
# AEG-201: keep staging out of search. Eng backlog lives at /api/v2/internal/release-notes
`);
  }
  if(p==='/.well-known/security.txt' && m==='GET'){
    return text(res,200,
`Contact: mailto:security@aegisgroup.africa
Policy: /api/v2/internal/release-notes
# Please don't pentest prod without a ROE. (Staging is fair game, apparently.)
`);
  }

  /* ---- hidden "internal engineering backlog": in-character hints for the whole chain ---- */
  if(p==='/api/v2/internal/release-notes' && (m==='GET')){
    return send(res,200,{
      service:'Aegis Platform', environment:'staging',
      warning:'INTERNAL. Not for external distribution. If you can read this in prod, the gateway ACL is misconfigured (again).',
      open_tickets:[
        {id:'AEG-441', area:'Connect / CDR', severity:'high',
         summary:'GET /subscriber/{msisdn}/cdr never checks the number belongs to the caller — any subscriber can pull any line\'s records. Launch blocker.'},
        {id:'AEG-502', area:'Pay / Auth', severity:'high',
         summary:'Password-reset OTP is not tied to the requesting session and is reusable within its TTL. Reset codes also still show up in the message/CDR log.'},
        {id:'AEG-517', area:'Pay / Profile', severity:'critical',
         summary:'PATCH /pay/profile binds the whole body — kyc_tier and role are client-writable. DO NOT SHIP. (Whoever added the spread operator: see me. — T.)'},
        {id:'AEG-530', area:'Mall / Promos', severity:'medium',
         summary:'Coupons are not idempotent; SHIELD5K / SUMMIT10 apply repeatedly and the cart total can hit zero or go negative. "one per customer" is only enforced in the web UI.'},
        {id:'AEG-560', area:'Admin / Settlement', severity:'critical',
         summary:'settlement/withdraw authorises purely on the JWT role claim. Signing key is still the brand name lowercased and the verifier accepts alg:none (old lib default). Rotate the key and pin HS256 before the Mayfair Hall demo.'}
      ],
      pre_launch_checklist:['Rotate JWT secret','Decommission /api/v1','Disable X-Debug','Scope CDR by owner — before 12 Sept, Alausa']
    },req);
  }

  /* ---- F1: exposed docs (flag sits in the description) ---- */
  if(p==='/api/docs' && m==='GET'){
    return send(res,200,{
      openapi:'3.0.0',
      info:{
        title:'Aegis Group Unified API',
        version:'2.0',
        description:`Aegis Group — Connect · Pay · Mall. Internal build. NOTE FROM PLATFORM TEAM: staging flag ${FLAG.F1}. Signing key is the brand name lowercased until we rotate it.`
      },
      servers:[{url:'/api/v2'},{url:'/api/v1 (legacy, do not use)'}],
      paths:{
        '/auth/register':{post:{summary:'Create a subscriber, returns a JWT'}},
        '/auth/password-reset/confirm':{post:{summary:'Confirm reset with OTP'}},
        '/subscriber/{msisdn}/cdr':{get:{summary:'Call detail records'}},
        '/pay/profile':{get:{},patch:{summary:'Update your profile'}},
        '/mall/promos':{get:{}}, '/mall/cart':{get:{}},
        '/mall/cart/apply-coupon':{post:{}}, '/mall/checkout':{post:{}},
        '/admin/settlement/withdraw':{post:{summary:'platform_admin only'}},
        '/v1/messages':{get:{summary:'[legacy] raw message log'}}
      }
    },req);
  }

  /* ---- register / login ---- */
  if(p==='/api/v2/auth/register' && m==='POST'){
    const b=await readBody(req); const pl=newPlayer((b.handle||'').trim());
    return send(res,200,{ok:true, msisdn:pl.msisdn, handle:pl.handle,
      token:signJWT({sub:pl.sub, msisdn:pl.msisdn, role:'subscriber', kyc_tier:0}),
      hint:'Explore /api/docs. Your own CDR is at /api/v2/subscriber/'+pl.msisdn+'/cdr'},req);
  }

  /* ---- F2: BOLA on CDR (no ownership check) ---- */
  let mCdr=p.match(/^\/api\/v2\/subscriber\/([^/]+)\/cdr$/);
  if(mCdr && m==='GET'){
    const u=currentUser(req); if(!u) return send(res,401,{error:'Authentication required.'},req);
    const msisdn=decodeURIComponent(mCdr[1]);              // VULN: never checks msisdn belongs to caller
    return send(res,200,cdrFor(msisdn),req);
  }

  /* ---- legacy v1 message log (API9 flavour, alt OTP path) ---- */
  if(p==='/api/v1/messages' && m==='GET'){
    const msisdn=url.searchParams.get('msisdn');
    if(msisdn===TARGET_MSISDN) return send(res,200,{msisdn,messages:[
      {from:'AegisPay', body:`Your Aegis Pay password reset code is ${TARGET_OTP}.`}]},req);
    return send(res,200,{msisdn,messages:[]},req);
  }

  /* ---- F3: password reset confirm (OTP not bound to caller, reusable) ---- */
  if(p==='/api/v2/auth/password-reset/confirm' && m==='POST'){
    const b=await readBody(req);
    if(b.msisdn===TARGET_MSISDN && String(b.otp)===TARGET_OTP){   // VULN: any caller w/ the OTP
      return send(res,200,{ok:true, status:'Password reset for '+TARGET_NAME,
        account_session:signJWT({sub:'npc-amara', msisdn:TARGET_MSISDN, role:'subscriber'}),
        flag:FLAG.F3},req);
    }
    return send(res,400,{error:'Invalid msisdn or OTP.'},req);
  }

  /* ---- profile view ---- */
  if(p==='/api/v2/pay/profile' && m==='GET'){
    const u=currentUser(req); if(!u||!u.player) return send(res,401,{error:'Authentication required.'},req);
    const pl=u.player; return send(res,200,{msisdn:pl.msisdn, role:pl.role, kyc_tier:pl.kyc_tier, profile:pl.profile, editable_fields:['name','email']},req);
  }

  /* ---- F4: mass assignment on profile update ---- */
  if(p==='/api/v2/pay/profile' && m==='PATCH'){
    const u=currentUser(req); if(!u||!u.player) return send(res,401,{error:'Authentication required.'},req);
    const b=await readBody(req); const pl=u.player;
    // VULN: whole body merged; kyc_tier and role should never be client-writable
    if('name'in b) pl.profile.name=b.name;
    if('email'in b) pl.profile.email=b.email;
    if('kyc_tier'in b) pl.kyc_tier=Number(b.kyc_tier);
    if('role'in b) pl.role=b.role;
    const out={ok:true, msisdn:pl.msisdn, role:pl.role, kyc_tier:pl.kyc_tier, profile:pl.profile};
    if(pl.kyc_tier>=3) out.flag=FLAG.F4;
    return send(res,200,out,req);
  }

  /* ---- Mall: promos + cart ---- */
  if(p==='/api/v2/mall/promos' && m==='GET'){
    return send(res,200,{coupons:[
      {code:'SHIELD5K', type:'fixed', value:5000, note:'₦5,000 off — one per customer'},
      {code:'SUMMIT10', type:'percent', value:10, note:'10% off'}
    ], limit_note:'"one per customer" is enforced in the web UI only (AEG-530)'},req);
  }
  if(p==='/api/v2/mall/cart' && m==='GET'){
    const u=currentUser(req); if(!u||!u.player) return send(res,401,{error:'Authentication required.'},req);
    const c=u.player.cart; return send(res,200,{item:c.item, price:c.price, applied:c.applied, total:cartTotal(c)},req);
  }

  /* ---- F5: coupon stacking (no idempotency; total can go <= 0) ---- */
  if(p==='/api/v2/mall/cart/apply-coupon' && m==='POST'){
    const u=currentUser(req); if(!u||!u.player) return send(res,401,{error:'Authentication required.'},req);
    const b=await readBody(req); const c=u.player.cart;
    const coupon={SHIELD5K:{type:'fixed',value:5000}, SUMMIT10:{type:'percent',value:10}}[(b.code||'').toUpperCase()];
    if(!coupon) return send(res,400,{error:'Unknown coupon code.'},req);
    c.applied.push(coupon);                                 // VULN: same coupon stacks unlimited
    return send(res,200,{ok:true, applied_count:c.applied.length, total:cartTotal(c),
      note:cartTotal(c)<=0?'Cart is free — proceed to /api/v2/mall/checkout':'keep going'},req);
  }
  if(p==='/api/v2/mall/checkout' && m==='POST'){
    const u=currentUser(req); if(!u||!u.player) return send(res,401,{error:'Authentication required.'},req);
    const c=u.player.cart; const total=cartTotal(c);
    if(total<=0) return send(res,200,{ok:true, charged:0, status:'Order placed for ₦0', flag:FLAG.F5},req);
    return send(res,200,{ok:true, charged:total, status:'Order placed'},req);
  }

  /* ---- F6: settlement withdraw — platform_admin only (forge the JWT) ---- */
  if(p==='/api/v2/admin/settlement/withdraw' && m==='POST'){
    const u=currentUser(req);
    if(!u) return send(res,401,{error:'Authentication required.'},req);
    if(u.token.role!=='platform_admin')                    // normal players are 'subscriber'
      return send(res,403,{error:'Forbidden — requires role=platform_admin.'},req);
    const b=await readBody(req);
    return send(res,200,{ok:true, account:b.account||SETTLEMENT_ACCOUNT,
      withdrawn:b.amount||'ALL', status:'Settlement account drained', flag:FLAG.F6},req);
  }

  /* ---- status (handy for testing X-Debug) ---- */
  if(p==='/api/v2/status' && m==='GET') return send(res,200,{status:'ok', service:'aegis-gateway', ts:Date.now()},req);

  return send(res,404,{error:'Not found: '+p},req);
});
function cartTotal(c){
  let t=c.price;
  for(const d of c.applied){ t = d.type==='fixed' ? t-d.value : t-Math.round(c.price*d.value/100); }
  return t;
}

server.listen(PORT,()=>{
  console.log('\n  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║  AEGIS GROUP — Vulnerable Target (APIShield Breaker CTF)  ║');
  console.log('  ║  Intentionally insecure. Isolated / authorised use only.  ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log(`\n   Target base URL:  http://localhost:${PORT}/`);
  if(INSTANCE_NAME||FLAG_SALT) console.log(`   Instance:         ${INSTANCE_NAME||'(unnamed)'}   salt=${FLAG_SALT||'(none)'}`);
  console.log(`   Start here:       GET /api/docs   ·   POST /api/v2/auth/register\n`);
});

const LANDING=`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- platform: API reference at /api/docs · staging build -->
<!-- ops TODO before launch: disable X-Debug, decommission /api/v1, read robots.txt -->
<!-- QA note (AEG-517): profile update still accepts more fields than the form shows -->
<title>Aegis Group</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--berry:#A83A67;--teal:#2C7488;--plum:#6E2B58;--ink:#1a1220}
*{box-sizing:border-box}body{margin:0;font-family:Montserrat,system-ui,sans-serif;color:var(--ink);
background:linear-gradient(135deg,#faf6f8,#f2e9ee);min-height:100vh;display:grid;place-items:center;padding:24px}
.wrap{max-width:640px;background:#fff;border-radius:18px;padding:38px;box-shadow:0 12px 50px rgba(110,43,88,.12);border:1px solid #ecdfe6}
.logo{display:flex;align-items:center;gap:14px;margin-bottom:8px}
.shield{width:44px;height:52px;background:linear-gradient(160deg,var(--plum),var(--berry));color:#fff;
clip-path:polygon(50% 0,100% 22%,100% 62%,50% 100%,0 62%,0 22%);display:grid;place-items:center;font-family:Anton;font-size:22px}
h1{font-family:Anton;font-weight:400;font-size:34px;letter-spacing:.5px;margin:0;color:var(--plum)}
.tag{color:var(--teal);font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:11px;margin:0 0 20px}
p{line-height:1.6}
code{background:var(--ink);color:#7CFFB2;padding:2px 7px;border-radius:5px;font-size:13px}
.rails{display:flex;gap:10px;margin:20px 0;flex-wrap:wrap}
.rail{flex:1;min-width:130px;border:1px solid #ecdfe6;border-radius:10px;padding:12px 14px}
.rail b{color:var(--berry)}
.note{margin-top:22px;padding:12px 14px;background:#fff3f6;border-left:4px solid var(--berry);border-radius:6px;font-size:13px;color:#7a3a55}
</style></head><body><div class="wrap">
<div class="logo"><div class="shield">AE</div><div><h1>Aegis Group</h1></div></div>
<p class="tag">Connect · Pay · Mall — one super-app</p>
<p>Welcome to the Aegis Group unified API. To get started, create a subscriber account and explore the platform.</p>
<div class="rails">
<div class="rail"><b>Aegis Connect</b><br>Telecom &amp; messaging</div>
<div class="rail"><b>Aegis Pay</b><br>Wallets &amp; KYC</div>
<div class="rail"><b>Aegis Mall</b><br>Marketplace</div>
</div>
<p><b>Register:</b> <code>POST /api/v2/auth/register</code> &nbsp;→&nbsp; get your token.<br>
<b>API reference:</b> <code>GET /api/docs</code></p>
<div class="note">This is a Capture-the-Flag training range for API Shield Summit 1.0. Everything here is fictional and intentionally vulnerable. Break the shield.</div>
</div></body></html>`;
