# QUICKSTART — run & test APIShield Breaker today

Two terminals, no installs (Node 18+ only). This is the shared-instance setup you chose.

## Run it locally (2 terminals)

**Terminal 1 — the target (what teams hack):**
```bash
cd aegis-target
node server.js
# -> http://localhost:4000
```

**Terminal 2 — the console (submit + live board):**
```bash
cd apishield-live
ADMIN_KEY=changeme node server.js
# -> players http://localhost:3000/   ·   admin http://localhost:3000/admin?key=changeme
```

## Test the full loop yourself (5 minutes)
Play one flag end to end to prove everything works:

1. Open the **admin** page (`http://localhost:3000/admin?key=changeme`), set 30 min, press **Start**.
2. Open the **target** landing page `http://localhost:4000/` and view source — you'll spot the breadcrumb comments. Hit `http://localhost:4000/robots.txt` and `http://localhost:4000/api/v2/internal/release-notes` to see the planted hints.
3. Grab F1 the easy way: `curl http://localhost:4000/api/docs` — the flag is in the description.
4. Open the **players** page `http://localhost:3000/`, join as a team, paste the F1 flag, submit.
5. Watch it land on the admin board with the timestamp + first blood. That's the whole system proven.

Full exploit commands for all six flags are in `aegis-target/SOLUTIONS.md`.

## The planted hints (what teams discover)
- Response headers `X-Aegis-Diagnostics` and `X-Aegis-Notes` (seen in Burp / `curl -D -`)
- `/robots.txt` and `/.well-known/security.txt`
- HTML comments in the landing page source
- `/api/v2/internal/release-notes` — a hidden "engineering backlog" that hints every vuln in dev language
- Contextual tells in `/api/v2/pay/profile` and `/api/v2/mall/promos` responses

Each hint describes a weakness but never contains a flag — teams still have to do the exploit.

## Deploy to one small VPS (for the event)
On a fresh Ubuntu box (DigitalOcean/Hetzner, ~$6/mo):
```bash
# install Node + pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo npm i -g pm2

# upload the bundle, then:
cd aegis-target && pm2 start server.js --name aegis-target
cd ../apishield-live && ADMIN_KEY=your-real-secret pm2 start server.js --name ctf-console --update-env
pm2 save && pm2 startup   # survives reboots
```
- Target is on `:4000`, console on `:3000`. Open both ports in the firewall, or put Caddy in front for clean HTTPS URLs (see `tools/MULTI-TEAM.md` for a Caddyfile example — the reverse-proxy part applies even in single-instance mode).
- Give teams: target URL (to hack) + console URL (to submit). Open the admin URL on the projector.
- **Do a live dry run** on the deployed box before the event: hack one flag, submit it, watch the board.

## Remember
- Flag strings are defined in **both** `aegis-target/server.js` (`FLAG`) and `apishield-live/server.js` (`FLAGS`). They match now — if you edit one, edit the other.
- The target is intentionally insecure. Only run it for the event, on infrastructure you control. Shut it down afterwards.
