# APIShield Breaker — CTF

Capture-the-Flag for **API Shield Summit 1.0** (12 Sep 2026, Mayfair Hall, Alausa Ikeja) — APIsec University Nigeria × CybariK.

A 30-minute, 6-flag CTF covering the OWASP API Security Top 10 (2023). Two zero-dependency Node apps:

- **`aegis-target/`** — the deliberately vulnerable Aegis Group API teams hack to find flags.
- **`apishield-live/`** — the submission console + live scoreboard the host runs on the projector.

```
 teams ──hack──▶  aegis-target   (find flags by exploiting)
 teams ─submit─▶  apishield-live  (flags validated, timed, ranked, shown live)
 host  ─watch──▶  apishield-live/admin  (countdown + live board)
```

## Deploy
- **Railway (recommended):** see **[RAILWAY.md](RAILWAY.md)** — push this repo, two services, done.
- **Local / VPS:** see **[QUICKSTART.md](QUICKSTART.md)**.

## Run locally (2 terminals, Node 18+)
```bash
cd aegis-target   && node server.js                       # target  → :4000
cd apishield-live && ADMIN_KEY=changeme node server.js    # console → :3000, admin at /admin?key=changeme
```

## Docs
| File | What |
|------|------|
| `RAILWAY.md` | Step-by-step Railway deploy |
| `QUICKSTART.md` | Local run + one-box VPS deploy + dry run |
| `SYSTEM-README.md` | How the two halves fit together |
| `CTF_Spec_v2.0.md` | The 30-min, 6-flag design + themed hints |
| `aegis-target/SOLUTIONS.md` | **Organisers only** — exact exploit per flag + planted breadcrumbs |
| `apishield-live/DEPLOY.md` | Cloud deploy notes for the console |
| `tools/` | **Optional** — multi-team isolation (not needed for the shared setup) |

## Notes
- The target is **intentionally insecure**. Only run it for the event, on infrastructure you control, and shut it down afterwards.
- Flag strings are defined in **both** `aegis-target/server.js` (`FLAG`) and `apishield-live/server.js` (`FLAGS`). They match — if you edit one, edit the other.
- Keep each service to a **single instance** (no autoscaling); state and the live feed live in one process's memory.
