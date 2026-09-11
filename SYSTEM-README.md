# APIShield Breaker — Complete CTF System

Everything you need to run the Capture-the-Flag at **API Shield Summit 1.0**. Two independent programs plus the paperwork.

```
                          ┌──────────────────────────────────────────┐
        TEAMS (phones/    │  1. AEGIS TARGET   (aegis-target/)        │
        laptops with      │     the vulnerable super-app they HACK    │
        Burp / curl) ────▶│     → they exploit it to DISCOVER flags   │  port 4000
                          └──────────────────────────────────────────┘
              │ paste the flag they found
              ▼
                          ┌──────────────────────────────────────────┐
                          │  2. CTF CONSOLE   (apishield-live/)       │
        TEAMS  ──────────▶│     player page: SUBMIT flags             │  port 3000
                          │     admin page: countdown + LIVE board    │
        HOST (projector) ▶│     → validates, timestamps, ranks        │
                          └──────────────────────────────────────────┘
```

They're separate on purpose: the **target** is where flags are *earned*, the **console** is where they're *submitted* and the game is *watched*. The console never contains the vulnerabilities; the target never handles scoring.

## What's in the box
```
aegis-target/        The vulnerable range (the thing teams attack)
  server.js          6 challenges, all OWASP API Top 10 (2023)
  package.json
  SOLUTIONS.md       ← organisers only: exact exploit for every flag
apishield-live/      The submission console + live scoreboard
  server.js          team self-submission, SSE live feed, timer
  package.json
  README.md          run guide (local)
  DEPLOY.md          cloud deploy (Railway / Render / Fly / VPS)
CTF_Spec_v2.0.md     the 30-minute, 6-flag design + themed hints
```

## Run order on the day

**1. Start the target** (teams attack this):
```bash
cd aegis-target && node server.js          # http://<host>:4000
```

**2. Start the console** (submissions + board):
```bash
cd apishield-live && ADMIN_KEY=your-secret node server.js   # http://<host>:3000
```

**3. Give teams two things:**
- **Target URL** → `http://<host>:4000/` (where they hack)
- **Submit URL** → `http://<host>:3000/` (where they submit)

A QR code for each on a slide works best.

**4. Host:** open `http://<host>:3000/admin?key=your-secret` on the projector, set 30 minutes, press **Start**. The live feed and scoreboard drive themselves from there.

## Where to run it
- **In-person, one room (simplest):** both on your laptop; teams join over the venue Wi-Fi. Watch for guest-Wi-Fi "client isolation" (see `apishield-live/DEPLOY.md`).
- **Cloud (stable public URLs, sidesteps Wi-Fi isolation):** deploy each folder as its own service on Railway / a VPS. Both are zero-dependency Node apps with a `start` script. See `apishield-live/DEPLOY.md` — the same guidance applies to the target. Keep each to a single instance.

## Important
- The target is **intentionally insecure**. Only run it on a network you control, for the event. Don't put real data in it. Shut it down afterwards.
- Flag strings are defined in **both** `aegis-target/server.js` (`FLAG`) and `apishield-live/server.js` (`FLAGS`). If you change one, change the other to match.
- Do a full dry run before doors open: hack one flag on the target, submit it on the console, watch it hit the admin board.

## Difficulty & fairness
Only **F2 → F3** is a hard dependency (F2 leaks the OTP F3 needs). F1, F4, F5, F6 are all independently solvable, so no single flag can lock a team out of the rest. Pacing and the three-tier themed hints are in `CTF_Spec_v2.0.md`.
