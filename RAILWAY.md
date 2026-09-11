# Deploy APIShield Breaker to Railway

Run the two servers as **two services in one Railway project**, each from its own folder. Railway runs persistent processes, which is what the in-memory state and live SSE feed need.

## Step 0 — what you need
A GitHub account, a Railway account (Hobby plan, usage-based ~$5/mo), and this bundle.

## Step 1 — push this bundle to GitHub
From inside the `apishield-breaker` folder:
```bash
git init
git add .
git commit -m "APIShield Breaker CTF"
gh repo create apishield-breaker --private --source=. --push
```
No `gh` CLI? Create an empty private repo on github.com, then:
```bash
git remote add origin https://github.com/<you>/apishield-breaker.git
git branch -M main
git push -u origin main
```

## Step 2 — the target service (what teams hack)
1. railway.app → **New Project → Deploy from GitHub repo →** pick `apishield-breaker`.
2. Open the created service → **Settings** → set **Root Directory** to `aegis-target`.
3. Rename the service to `aegis-target` (right-click on the canvas).
4. **Settings → Networking → Generate Domain.** This `*.railway.app` URL is the **target URL teams hack**.

## Step 3 — the console service (submit + live board)
1. Project canvas → **+ New → GitHub Repo →** the same `apishield-breaker` repo (creates a 2nd service).
2. Open it → **Settings** → set **Root Directory** to `apishield-live`. Rename it `ctf-console`.
3. **Variables** tab → add `ADMIN_KEY` = your secret (e.g. `summit2026`).
4. **Settings → Networking → Generate Domain.** This is the **console URL** (submit + board).

If the first build errored before you set the Root Directory, that's expected — set it and redeploy. Read **Deploy logs** if a build sticks; the real error is usually mid-log, not at the bottom.

## Step 4 — two settings that matter
- **Single instance only.** In each service's **Scale** section, leave replicas at **1**. State + live feed live in one process's memory; a 2nd replica splits the game.
- **Don't redeploy mid-event.** Railway's disk is ephemeral, so a redeploy/restart resets the console's saved state. During the round, in-memory state is the source of truth — don't push to `main` while it's live.

## Step 5 — dry run (before the event)
You now have two `*.railway.app` URLs.
1. Open `https://<console-domain>/admin?key=summit2026`, set 30 min, **Start**.
2. Visit `https://<target-domain>/api/docs`, copy the F1 flag from the description.
3. Open `https://<console-domain>/`, join a test team, paste the flag, submit.
4. Watch it hit the admin board with timestamp + first blood. Then **Clear captures** to reset.

## Step 6 — event day
Give teams two links: the **target** `*.railway.app` (to hack) and the **console** `*.railway.app` (to submit). Put the **admin** URL on the projector, set 30 min, press **Start**.

## Step 7 — after the event
Remove both services (or delete the project). The target is deliberately vulnerable — don't leave it running.

## Cost
Two small always-on services. Deploy a day or two before and remove after to stay near the bottom of the ~$5–20/mo usage band.

## CLI alternative (skip GitHub)
Install the Railway CLI, then from inside each folder:
```bash
railway init
railway up
railway domain      # prints the public URL
```
Set `ADMIN_KEY` in the console service's Variables either way.
