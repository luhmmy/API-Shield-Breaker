# Deploying APIShield Breaker to the cloud

The server keeps state and the live feed **in memory** and pushes updates over a long-lived SSE connection. That means you want a host that runs a **persistent Node process** — not a serverless platform (Vercel/Netlify won't work without swapping to an external store + polling).

> **Golden rule: run ONE instance. Never enable autoscaling / multiple replicas.** The scoreboard and feed live in a single process's memory; a second instance would see a different game.

`process.env.PORT` and `process.env.ADMIN_KEY` are already read from the environment, so no code changes are needed to deploy.

---

## Option A — Railway (recommended, ~$5/mo Hobby)
Persistent process, no cold starts, deploy from a git push.
1. Push this folder to a GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway detects Node and runs `npm start`.
4. Add a variable **`ADMIN_KEY`** = something only you know (Settings → Variables).
5. Under Settings, generate a public domain. That's your Players URL.
6. Confirm the service is set to **1 replica** (default). Leave it there.

## Option B — Render ($7/mo Starter; free tier sleeps)
1. Push to GitHub.
2. Render: **New → Web Service** → connect the repo.
3. Build command: *(blank)* · Start command: `npm start`.
4. Add env var **`ADMIN_KEY`**.
5. **Pick the Starter instance, not Free** — the free tier sleeps after 15 min and cold-starts for 30–60s, which will bite you exactly at kickoff.

## Option C — Fly.io (~$2/mo, per-second)
```bash
fly launch        # detects Node; keep one machine
fly secrets set ADMIN_KEY=your-secret-key
fly deploy
```
Keep it to a single machine (don't scale count > 1).

## Option D — Plain VPS (DigitalOcean droplet etc., ~$4–6/mo)
Most control, and `ctf-state.json` persists across restarts here.
```bash
# on the droplet
git clone <your-repo> && cd apishield-live
ADMIN_KEY=your-secret-key PORT=3000 node server.js
# keep it running with pm2 or a systemd unit, and put nginx/Caddy in front for HTTPS
```
If you use nginx as a reverse proxy, disable buffering on the SSE route so the feed streams:
```nginx
location /events { proxy_pass http://127.0.0.1:3000; proxy_buffering off; proxy_cache off; }
```
(The app already sends `X-Accel-Buffering: no`, which most managed hosts honour.)

---

## After deploy
- **Players URL:** `https://<your-domain>/` — put a QR code of this on a slide.
- **Admin URL:** `https://<your-domain>/admin?key=<ADMIN_KEY>` — keep it private.
- Do a full dry run on the live URL before the event: start the timer, join from a phone, submit a real flag, watch it hit the admin feed.

## Reliability notes for a live round
- Don't redeploy or restart mid-round on Railway/Render/Fly — their disks are ephemeral, so in-memory state is the source of truth during the event. On a VPS, `ctf-state.json` makes restarts safe.
- If you want full crash-safety on a managed host, move state to Redis (Railway/Upstash one-click) — happy to wire that in if you decide you need it.
