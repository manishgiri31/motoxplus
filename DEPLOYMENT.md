# MotoXPlus — Deployment Guide

## Stack

| Component | Technology |
|-----------|-----------|
| App server | Next.js 14 on Node.js 20 |
| Process manager | PM2 (cluster mode) |
| Reverse proxy | Nginx |
| Database | PostgreSQL 16 (local) |
| TLS | Let's Encrypt via Certbot |
| Storage | Cloudflare R2 |
| DNS/CDN | Cloudflare |

## Server Requirements

- Ubuntu 24.04 LTS
- 4 GB RAM minimum (8 GB recommended)
- 2 vCPUs minimum
- 40 GB SSD
- Public IPv4

---

## First-Time Server Setup

### 1. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx postgresql postgresql-contrib certbot python3-certbot-nginx libnginx-mod-brotli ufw fail2ban
```

### 2. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # should print v20.x
```

### 3. PM2

```bash
sudo npm install -g pm2
pm2 startup systemd
# Copy/run the command it prints to enable PM2 on reboot
```

### 4. PostgreSQL database

```bash
sudo -u postgres psql <<EOF
CREATE USER motoxplus WITH PASSWORD 'STRONG_RANDOM_PASSWORD_HERE';
CREATE DATABASE motoxplus OWNER motoxplus;
GRANT ALL PRIVILEGES ON DATABASE motoxplus TO motoxplus;
EOF
```

Test: `psql postgresql://motoxplus:PASSWORD@localhost/motoxplus -c "SELECT 1;"`

### 5. Application directory

```bash
sudo mkdir -p /var/www/motoxplus
sudo chown $USER:$USER /var/www/motoxplus
cd /var/www/motoxplus
git clone https://github.com/YOUR_ORG/motoxplus.git .
```

### 6. Environment variables

```bash
cp .env.example .env
nano .env  # fill in all required values
```

Key values to update:
- `DATABASE_URL` → local PostgreSQL (`postgresql://motoxplus:PASSWORD@localhost/motoxplus`)
- `NEXTAUTH_SECRET` → `openssl rand -hex 32`
- `JWT_SECRET` → `openssl rand -hex 32`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` → live keys from Razorpay dashboard
- All R2 credentials

### 7. Build and migrate

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 8. Start with PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 list
```

Verify: `curl http://localhost:3000/api/health`

### 9. Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/motoxplus.com
sudo ln -sf /etc/nginx/sites-available/motoxplus.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo nginx -s reload
```

### 10. SSL via Let's Encrypt

```bash
sudo certbot --nginx -d motoxplus.com -d www.motoxplus.com
# Select "Redirect HTTP to HTTPS" when prompted
```

Auto-renewal is set up automatically by Certbot. Verify:
```bash
sudo certbot renew --dry-run
```

### 11. Firewall

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw deny 3000/tcp    # block direct Node access
sudo ufw enable
```

---

## Zero-Downtime Deployment (GitHub Actions)

Deployments run automatically on every push to `main`. See [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

### Required GitHub Secrets

Set these in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Server IP or domain |
| `VPS_USER` | SSH user (e.g. `ubuntu`) |
| `VPS_SSH_KEY` | Private SSH key (full content) |
| `VPS_PORT` | SSH port (default `22`) |
| `DATABASE_URL` | Production database URL |
| `NEXTAUTH_URL` | `https://motoxplus.com` |
| `NEXTAUTH_SECRET` | 64-char random hex |
| `RAZORPAY_KEY_ID` | Live Razorpay key |
| `RAZORPAY_KEY_SECRET` | Live Razorpay secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same as RAZORPAY_KEY_ID |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | R2 public CDN URL |
| `JWT_SECRET` | 64-char random hex |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender email address |
| `NEXT_PUBLIC_APP_URL` | `https://motoxplus.com` |
| `NEXT_PUBLIC_COMPANY_NAME` | Company name |

### Manual deployment

```bash
cd /var/www/motoxplus
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload ecosystem.config.js --env production --update-env
```

---

## PM2 Operations

```bash
pm2 list                          # list all apps
pm2 logs motoxplus                # tail logs
pm2 logs motoxplus --lines 100    # last 100 lines
pm2 monit                         # real-time monitoring
pm2 reload motoxplus              # zero-downtime reload
pm2 restart motoxplus             # hard restart
pm2 stop motoxplus                # stop
pm2 delete motoxplus              # remove from PM2
pm2 save                          # persist config across reboots
```

---

## Database Backups

See [BACKUP.md](BACKUP.md) for the full backup strategy.

Quick manual backup:
```bash
./scripts/db/backup.sh --upload-r2
```

Set up daily cron at 02:00:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/motoxplus/scripts/db/backup.sh --upload-r2 >> /var/log/motoxplus-backup.log 2>&1") | crontab -
```

---

## Monitoring

| URL | Purpose |
|-----|---------|
| `/api/health` | Full health check (DB latency, uptime) |
| `/api/health/ready` | Readiness probe |
| `/api/health/live` | Liveness probe |

Check health:
```bash
curl -s https://motoxplus.com/api/health | python3 -m json.tool
```

PM2 logs are at `/var/log/pm2/`.  
Nginx logs are at `/var/log/nginx/motoxplus-*.log`.

---

## Rollback

If a deployment causes issues:

```bash
cd /var/www/motoxplus

# List recent commits
git log --oneline -10

# Roll back to previous commit
git reset --hard HEAD~1

# Rebuild and reload
npm run build
pm2 reload ecosystem.config.js --env production
```

To restore from a database backup, see [BACKUP.md](BACKUP.md).
