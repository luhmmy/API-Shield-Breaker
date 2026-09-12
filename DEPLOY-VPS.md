# APIShield Breaker — VPS Deployment Guide (Docker + Caddy)

Deploy **APIShield Breaker CTF** on an Ubuntu/Debian VPS with automated Let's Encrypt HTTPS and isolated containers.

---

## 1. Prerequisites

1. A VPS (Ubuntu 22.04 / 24.04 or Debian) with a public IPv4 address.
2. Docker & Docker Compose installed on the VPS:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   # Log out and log back in, or run: newgrp docker
   ```

---

## 2. DNS Records Setup

At your domain registrar / DNS manager (where `apisecunigeria.com.ng` is managed), create **two A records**:

| Type | Name / Host | Points to (Value) | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `ctf` | `<YOUR_VPS_PUBLIC_IP>` | Players submission console & live scoreboard |
| **A** | `target.ctf` | `<YOUR_VPS_PUBLIC_IP>` | The vulnerable Aegis API range teams hack |

*(TTL can be set to 300s / 5 minutes so it propagates quickly.)*

---

## 3. Configure the Firewall

Ensure ports **80** and **443** are open so Caddy can obtain SSL certificates and serve web traffic:

```bash
sudo ufw allow 22/tcp     # SSH (don't lock yourself out!)
sudo ufw allow 80/tcp     # HTTP (ACME challenge & redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

---

## 4. Deploy the Stack

### Step 4.1: Clone or upload the repository
```bash
git clone <your-repo-url> api-shield-breaker
cd api-shield-breaker
```

### Step 4.2: Configure `.env`
Copy `.env.example` to `.env` and set your secret admin key:
```bash
cp .env.example .env
nano .env
```

Make sure you set `ADMIN_KEY` to a secret known only to you (e.g. `summit-ikeja-secret-987`):
```env
ADMIN_KEY=your-secure-admin-password
DOMAIN_CONSOLE=ctf.apisecunigeria.com.ng
DOMAIN_TARGET=target.ctf.apisecunigeria.com.ng
JWT_SECRET=aegis
```

### Step 4.3: Start the containers
```bash
docker compose up -d --build
```

Verify all 3 containers are running:
```bash
docker compose ps
```
You should see `apishield-console`, `aegis-target`, and `ctf-caddy` in state `Up`.

Check Caddy logs to confirm SSL certificates were issued:
```bash
docker compose logs -f caddy
```
*(Look for `certificate obtained successfully`.)*

---

## 5. Event URLs

| Purpose | URL | Audience |
| :--- | :--- | :--- |
| **Players Submit Page** | `https://ctf.apisecunigeria.com.ng/` | Put a QR code of this on the projector / slides. |
| **Admin Board & Timer** | `https://ctf.apisecunigeria.com.ng/admin?key=<YOUR_ADMIN_KEY>` | **Host only** — open this on the projector screen. |
| **Aegis Target Range** | `https://target.ctf.apisecunigeria.com.ng/` | Give this link to teams to hack. |

---

## 6. Pre-Event 5-Minute Dry Run

Before the summit begins, test the full loop end-to-end:

1. Open `https://ctf.apisecunigeria.com.ng/admin?key=<YOUR_ADMIN_KEY>`. Set duration to 30 minutes and click **Start**.
2. Visit `https://target.ctf.apisecunigeria.com.ng/api/docs`.
3. Copy the F1 flag from the Swagger API description: `APISHIELD{sw4gger_left_the_door_open}`.
4. In another browser / tab, visit `https://ctf.apisecunigeria.com.ng/`.
5. Join as a test team (e.g., `Test Team`), paste the flag, and submit.
6. Look at your Admin projector screen: the capture, time-to-reveal, and First Blood badge should appear in real time over the live feed!
7. On the Admin screen, click **Clear captures** and **Reset timer** to reset the board cleanly for the event.

---

## 7. Helpful Commands

- **View live server logs:**
  ```bash
  docker compose logs -f
  ```
- **Restart services:**
  ```bash
  docker compose restart
  ```
- **Backup game state:**
  ```bash
  cat ./data/ctf-state.json
  ```

---

## 8. Post-Event Cleanup

Because `aegis-target` is intentionally vulnerable, you should tear it down after the event:

```bash
docker compose down -v
```
This stops all containers, tears down the isolated Docker network, and leaves your VPS completely clean.
