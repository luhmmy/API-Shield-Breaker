# APIShield Breaker — Live CTF Server

Teams submit flags from their own phones; your admin dashboard updates live as captures land — showing **"Team X captured Flag N"** with timestamps, never the flag itself. Flag checking happens on the server, so the answers never reach players' browsers.

## What you need
- A laptop with **Node.js 18+** installed (`node --version` to check).
- The laptop and all teams on the **same Wi-Fi / LAN** (the venue network, or a phone hotspot).
- Nothing else — the server has zero dependencies.

## Run it
```bash
node server.js
```
On start it prints two URLs and an **ADMIN KEY**, e.g.:
```
Players  →  http://192.168.0.14:3000/
Admin    →  http://192.168.0.14:3000/admin?key=shield-a1b2
ADMIN KEY: shield-a1b2
```
- **Share the Players URL** with teams (write it on a slide / whiteboard, or make a QR code of it).
- **Keep the Admin URL to yourself** — open it on the projector laptop. Anyone with the admin key can control the timer and see the answer key.

Want a fixed key instead of a random one:
```bash
ADMIN_KEY=summit2026 PORT=3000 node server.js
```

## Running the round
1. Open the **Admin** page. Set the length (defaults to 30 min) and press **Start** when you're ready.
2. Teams open the **Players** page, enter a team name, and submit flags as they solve.
3. The **Live feed** and **Scoreboard** update instantly. First bloods are highlighted gold.
4. When time runs out the round auto-ends and submissions lock.
5. **Export JSON / CSV** from the admin page for the results and prize-giving.

## Good to know
- State is saved to `ctf-state.json` beside the server, so a restart mid-round won't lose progress. Delete that file for a clean slate.
- **Clear captures** resets the board and timer but keeps teams (handy for a second round).
- Flag strings, names, and points live in the `FLAGS` array at the top of `server.js` — edit there if the spec changes.
- The 30-minute format ships with 6 flags (F1–F6) matching **CTF Spec v2.0**.

## If teams can't connect
- Confirm they're on the same network as the laptop.
- Allow Node through the laptop firewall (Windows will prompt the first time; on macOS: System Settings → Network → Firewall).
- Some guest Wi-Fi blocks device-to-device traffic ("client isolation"). If so, run a phone hotspot for the teams + laptop, or ask the venue to disable isolation.
