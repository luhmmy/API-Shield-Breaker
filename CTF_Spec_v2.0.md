# APISHIELD BREAKER — CTF Specification (30-Minute Format)
### *One Breach, Three Rails*
**Event:** API Shield Summit 1.0 — 12 September 2026, Mayfair Hall, Alausa Ikeja, Lagos
**Host:** APIsec University Nigeria × CybariK Limited
**Spec version:** 2.0 · Status: Build-ready · Format: **30 minutes, 6 flags**

---

## What changed from v1.0

- **Flag count cut 16 → 6.** Tuned so the first two are fast (a team scores inside the first ~8 minutes) and the grand flag is the closing race. The dropped challenges (SSRF, airtime race, BFLA payout, processor callback, txn enumeration, etc.) are held in reserve for a longer-format rerun.
- **Renamed the target.** The fictional super-app is now **Aegis Group** — *aegis* is the mythological shield, so "break the shield" is literal. Rails: **Aegis Connect** (telecom), **Aegis Pay** (fintech), **Aegis Mall** (ecommerce), on the **Aegis ID** identity/wallet core. Base URL: `https://api.aegisgroup.africa`.
- **Hints re-themed** to the summit — venue (Mayfair Hall, Alausa, Ikeja), the shield motif, the hex pattern, APIsec/CybariK, and the programme.

---

## 1. Premise

**Aegis Group** is a pan-African super-app running three API-backed products off one shared identity + wallet core. Every player starts as an ordinary **Aegis Connect** subscriber — ₦0 wallet, KYC Tier 0. The CTF is a single kill-chain: telecom hands you a reset code → the code hands you a wallet → the wallet forges you a badge → the badge opens the Mall → the Mall's admin secret drops the shield and drains the settlement account. **Break the shield.**

---

## 2. Format & Scoring

- **Duration:** 30 minutes, single global countdown (run from the admin panel — see companion file).
- **Flags:** 6, chained but forgiving — the first two are solvable cold; later flags reward the teams moving fast.
- **Flag format:** `APISHIELD{lowercase_snake}`
- **Scoring:** static points by difficulty. **First blood** = +10% of the flag value; **grand-flag first blood = +25%**.
- **Total available:** 1,200 pts before bonuses.
- **Team size:** 2–4. Infra isolated per team (or namespaced — see build plan).

Difficulty: 🟢 Easy · 🟡 Medium · 🔴 Insane

---

## 3. The Six Flags

### F1 · Recon — Programme Leak 🟢 · 75 pts · API8 Security Misconfiguration
- **Endpoint:** `GET /api/docs` + any route with header `X-Debug: true`
- **Flaw:** OpenAPI spec served in production (lists the whole route surface, including legacy `v1`); `X-Debug: true` returns a verbose stack trace that leaks the JWT signing-secret hint used in F6.
- **Path:** pull `/api/docs`, read the route map, trigger a debug error to see the leaked config.
- **Flag:** `APISHIELD{sw4gger_left_the_door_open}` (in the OpenAPI `info.description`)
- **Themed hints:**
  1. *Nudge* — "Every summit prints a programme. Aegis printed theirs too — check the front desk at `/api/docs`."
  2. *Direction* — "The Mayfair Hall floor plan is public, and so is Aegis's: one door is marked `X-Debug` and it's propped open."
  3. *Near-solve* — "Read the programme notes in the OpenAPI description for the flag; the debug stack trace whispers the signing secret you'll want at the very end."

### F2 · Aegis Connect — Read Any Call Records 🟢 · 150 pts · API1 BOLA
- **Endpoint:** `GET /api/v2/subscriber/{msisdn}/cdr`
- **Flaw:** no ownership check on `{msisdn}`; any subscriber reads any line's Call Detail Records. One CDR row's SMS body carries the target's Aegis Pay reset OTP.
- **Path:** swap your MSISDN for the target's (`+2348030000001`); read the flag and the OTP from the SMS body.
- **Flag:** `APISHIELD{cdr_b0la_no_owner_check}`
- **Themed hints:**
  1. *Nudge* — "In Alausa, if nobody checks the guest list, you can walk into any hall. Try a room that isn't yours."
  2. *Direction* — "Put someone else's line in `/subscriber/{msisdn}/cdr` — Aegis never checks whose shield it is."
  3. *Near-solve* — "Pull the CDR for `+2348030000001`; one SMS body holds both the flag and the reset code the fintech desk will ask for."

### F3 · Aegis Pay — OTP-Reuse Takeover 🟡 · 200 pts · API2 Broken Authentication
- **Endpoint:** `POST /api/v2/auth/password-reset/confirm`
- **Flaw:** reset trusts the F2 OTP with no binding to the requesting session, and the OTP is reusable.
- **Path:** confirm the target's password reset with the leaked OTP → own their funded, KYC'd wallet.
- **Flag:** `APISHIELD{otp_reuse_full_ato}` (on the target's dashboard)
- **Themed hints:**
  1. *Nudge* — "The badge you lifted in the telecom hall still scans at the fintech gate. Reuse it."
  2. *Direction* — "The code from Aegis Connect opens the Aegis Pay reset door — it was never tied to who asked for it."
  3. *Near-solve* — "POST the leaked OTP to password-reset confirm; the shield drops and the wallet is yours."

### F4 · Aegis Pay — Print Your Own Badge 🟡 · 200 pts · API3 BOPLA (Mass Assignment)
- **Endpoint:** `PATCH /api/v2/pay/profile`
- **Flaw:** binds the whole body — only `name`/`email` should be writable, but it also accepts `kyc_tier` and `role`.
- **Path:** `PATCH {"kyc_tier": 3, "role": "merchant_admin"}` → the extra fields ride through and unlock the Mall's admin functions.
- **Flag:** `APISHIELD{mass_assign_kyc_tier3}`
- **Themed hints:**
  1. *Nudge* — "At the summit some badges say Attendee, some say Speaker. Aegis lets you print your own."
  2. *Direction* — "The profile form takes more fields than it shows you — hand it a higher tier."
  3. *Near-solve* — "Add `kyc_tier:3` and a role bump to your profile PATCH; that badge gets you backstage in the Mall."

### F5 · Aegis Mall — Coupon Stacking 🟡 · 175 pts · API6 Unrestricted Access to Sensitive Business Flows
- **Endpoint:** `POST /api/v2/mall/cart/apply-coupon`
- **Flaw:** no idempotency; the same single-use coupon stacks unlimited times and can drive the total below zero.
- **Path:** apply the coupon repeatedly until the cart hits ₦0, then check out.
- **Flag:** `APISHIELD{coupon_stack_to_zero}` (returned on a ₦0 checkout)
- **Themed hints:**
  1. *Nudge* — "The CybariK swag stall gives one voucher per guest. Aegis Mall never counts how many times you use it."
  2. *Direction* — "Apply the same coupon again. And again. The hex pattern repeats — so does the discount."
  3. *Near-solve* — "Stack the coupon until the cart reads ₦0 and check out; the receipt is your flag."

### F6 · GRAND — Drop the Shield 🔴 · 400 pts · API2 + API5 (Auth + Function-Level)
- **Endpoint:** `POST /api/v2/admin/settlement/withdraw`
- **Flaw:** JWTs are signed with a weak/guessable secret (hinted in F1) and the verifier also accepts `alg: none`. Forge a token with `role: platform_admin`.
- **Path:** mint a `platform_admin` token, call settlement withdraw, drain the merchant account. Shield down — game.
- **Flag:** `APISHIELD{shield_is_down_settlement_drained}`
- **Themed hints:**
  1. *Nudge* — "A shield is only as strong as its secret — and the programme (F1 recon) already printed a hint to it."
  2. *Direction* — "Aegis signs admin badges with a weak secret and even accepts `alg:none`. Forge `role: platform_admin`."
  3. *Near-solve* — "Mint the admin token, call settlement withdraw, and drain it. That's first blood on the grand flag."

---

## 4. OWASP API Security Top 10 (2023) Coverage

| Risk | Flag |
|------|------|
| API1 — BOLA | F2 |
| API2 — Broken Authentication | F3, F6 |
| API3 — BOPLA | F4 |
| API5 — BFLA | F6 |
| API6 — Unrestricted Access to Sensitive Business Flows | F5 |
| API8 — Security Misconfiguration | F1 |
| API9 — Improper Inventory Management | referenced via the live legacy `v1` surface (F1/F2 hint) |

Seven of the ten inside 30 minutes, one per major sector. API4/API7/API10 return in the long-format rerun.

---

## 5. Flag & Points Summary

| ID | Name | Rail | Diff | Pts |
|----|------|------|:----:|:---:|
| F1 | Programme Leak | Aegis ID | 🟢 | 75 |
| F2 | Read Any CDR | Aegis Connect | 🟢 | 150 |
| F3 | OTP-Reuse Takeover | Aegis Pay | 🟡 | 200 |
| F4 | Print Your Own Badge | Aegis Pay | 🟡 | 200 |
| F5 | Coupon Stacking | Aegis Mall | 🟡 | 175 |
| F6 | **Drop the Shield (GRAND)** | Aegis Group | 🔴 | 400 |

**Total:** 1,200 pts before first-blood bonuses.

---

## 6. Pacing (30-minute clock)

| Minute | Expected state |
|--------|----------------|
| 0–8 | Most teams capture F1 + F2 (recon + BOLA). Everyone is on the board. |
| 8–18 | F3 → F4: the fintech takeover and badge forge. The field spreads. |
| 18–26 | F5 in the Mall; strong teams line up the JWT forge. |
| 26–30 | The F6 settlement-drain race. Grand first blood decides the top of the table. |

---

## 7. Player Onboarding

Each team gets: base URL `https://api.aegisgroup.africa`, one subscriber account (MSISDN + password + starting JWT), a one-page Aegis Group world brief, and the scoreboard/submission URL. In scope: only the Aegis base URL and its documented services. Out of scope: the CTF platform itself, other teams' instances, and the venue network. Automated tooling is fine; keep request volume reasonable.

---

## 8. Companion

Timing and submissions are run from **APIShield Breaker — CTF Console** (separate HTML file): 30-minute countdown, per-team flag submission with capture timestamp, time-to-reveal per flag, and total time spent. Answer key and results export are built in.

---

*APISHIELD BREAKER · One Breach, Three Rails · API Shield Summit 1.0*
