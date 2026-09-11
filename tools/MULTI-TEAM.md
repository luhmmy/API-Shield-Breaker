# Running APIShield Breaker for 5 separate teams (cloud)

This sets up **genuine per-team isolation** on one cloud server: each team gets its own target instance with its own unique flags, and the console validates each team against their own flags. A flag from one team's range will not work for another.

```
                    ┌──────── one cloud server ────────────────────────┐
                    │                                                    │
  Team Alausa ─────▶│  target :4001  (salt A)  ─┐                        │
  Team Ikeja  ─────▶│  target :4002  (salt B)   │  5 isolated ranges     │
  Team Mayfair─────▶│  target :4003  (salt C)   │  (launch-targets.js)   │
  Team Hex    ─────▶│  target :4004  (salt D)   │                        │
  Team Shield ─────▶│  target :4005  (salt E)  ─┘                        │
                    │                                                    │
  all teams   ─────▶│  console :3000  (reads teams.json, locked mode)    │
  host (screen)────▶│  console :3000/admin?key=...                       │
                    └────────────────────────────────────────────────────┘
```

## Step 1 — assign teams and generate salts
On the server (or locally, then upload the file):
```bash
node make-teams.js "Team Alausa" "Team Ikeja" "Team Mayfair" "Team Hex" "Team Shield"
```
This writes **teams.json** and prints a table: each team's **port**, **salt**, and **join code**. Keep that table — you'll hand each team their URL + join code.

## Step 2 — start the 5 isolated targets
```bash
node launch-targets.js
# -> starts one target per team on ports 4001–4005, each with its own FLAG_SALT
```

## Step 3 — start the console in locked mode
Copy the same **teams.json** next to `apishield-live/server.js`, then:
```bash
cd apishield-live
cp ../teams.json .              # locks the console to these 5 teams
ADMIN_KEY=your-secret node server.js
```
On boot the console pre-creates the 5 teams with their salts. Players will now **pick their team from a dropdown** and enter their **join code** — they can't type a random name or use another team's flags.

## Step 4 — give each team their entry points
Each team needs two URLs:
- **Their target** (where they hack) — their own instance, e.g. `https://alausa.ctf.yourdomain/` → port 4001
- **The console** (where they submit) — shared, `https://ctf.yourdomain/` → port 3000
…plus their **join code**.

## Clean URLs with a reverse proxy (Caddy)
Ports are ugly and some networks block them. Caddy gives HTTPS + clean subdomains automatically. Example `Caddyfile`:
```
ctf.yourdomain.com        { reverse_proxy 127.0.0.1:3000 }   # console (all teams)
alausa.ctf.yourdomain.com { reverse_proxy 127.0.0.1:4001 }
ikeja.ctf.yourdomain.com  { reverse_proxy 127.0.0.1:4002 }
mayfair.ctf.yourdomain.com{ reverse_proxy 127.0.0.1:4003 }
hex.ctf.yourdomain.com    { reverse_proxy 127.0.0.1:4004 }
shield.ctf.yourdomain.com { reverse_proxy 127.0.0.1:4005 }
```
Point a wildcard `*.ctf.yourdomain.com` DNS record at the server, run `caddy run`, and every team gets a tidy HTTPS URL. (No domain? Use path-based routing or just hand out `http://SERVER_IP:400X` per team.)

## Keeping it running
Use `pm2` so the processes survive your SSH session and restarts:
```bash
npm i -g pm2
pm2 start launch-targets.js --name aegis-targets
pm2 start apishield-live/server.js --name ctf-console --update-env    # set ADMIN_KEY in env first
pm2 save
```

## Which server size
Six small Node processes barely use resources. A single **1–2 GB VPS** (DigitalOcean/Hetzner ~$6–12/mo) handles 5 teams comfortably. Railway works too — but multiple always-on services there cost more than one small VPS, so for a fixed 5-team event a VPS is the cheaper, simpler pick.

## Fairness recap
- **Isolated state:** each team hacks their own instance; nobody can touch another team's environment.
- **Unique flags:** every team's flags differ, so flags can't be shared or copied.
- **Locked join:** teams pick their assigned name and enter a join code; no impersonation.
- **Dry run first:** on the live server, join as one team, hack a flag on that team's target, submit it on the console, watch it hit the admin board.

## Simpler alternative (if you don't need anti-collusion)
Skip `teams.json` entirely and run **one** shared target (`node aegis-target/server.js`) + the console in open mode. Every player still gets their own account and isolated cart/profile; the only thing you lose is unique-per-team flags. Fine for a friendly or unsupervised-cheating-isn't-a-concern setting; use the isolated setup above when the leaderboard matters.
