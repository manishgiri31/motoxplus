#!/usr/bin/env bash
#
# MotoXPlus VPS hardening — idempotent. Safe to re-run; every step checks
# current state before changing anything and skips if already correct.
#
# Written for the documented deployment (nginx.conf, ecosystem.config.js,
# OPERATIONS.md): Ubuntu, nginx terminating TLS in front of PM2 on
# 127.0.0.1:3000, PostgreSQL 16 on the same box after a migration off Railway.
#
# Run as a sudo-capable user on the VPS itself:
#   chmod +x scripts/vps/harden.sh
#   sudo ./scripts/vps/harden.sh
#
# This was authored and reviewed without direct SSH access to the target box
# — no step here has been executed against production. Read it before running
# it, and run the "5-minute verification checklist" at the bottom of
# VPS-HARDENING.md afterward.
set -euo pipefail

log() { echo "[harden] $*"; }
warn() { echo "[harden] WARNING: $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo ./harden.sh)" >&2
  exit 1
fi

APP_USER="${APP_USER:-motoxplus}"
APP_DIR="${APP_DIR:-/var/www/motoxplus}"

# ---------------------------------------------------------------------------
# 1. PostgreSQL exposure — must be checked FIRST. A migration off a managed
#    host (Railway) commonly leaves listen_addresses/pg_hba.conf still
#    accepting remote connections from the app's old external IP, or '*'.
# ---------------------------------------------------------------------------
log "1/8 Checking PostgreSQL exposure..."
PG_CONF=$(find /etc/postgresql -maxdepth 2 -name postgresql.conf 2>/dev/null | head -1)
PG_HBA=$(find /etc/postgresql -maxdepth 2 -name pg_hba.conf 2>/dev/null | head -1)

if [[ -z "$PG_CONF" || -z "$PG_HBA" ]]; then
  warn "Could not locate postgresql.conf/pg_hba.conf under /etc/postgresql — is PostgreSQL 16 installed via apt? Skipping this step; fix manually."
else
  CURRENT_LISTEN=$(grep -E "^\s*listen_addresses" "$PG_CONF" || echo "listen_addresses = (default, all interfaces)")
  log "  current: $CURRENT_LISTEN"
  if ! grep -qE "^\s*listen_addresses\s*=\s*'localhost'" "$PG_CONF"; then
    log "  locking listen_addresses to 'localhost'"
    sed -i "s/^#\?\s*listen_addresses\s*=.*/listen_addresses = 'localhost'/" "$PG_CONF"
    grep -q "^listen_addresses" "$PG_CONF" || echo "listen_addresses = 'localhost'" >> "$PG_CONF"
  else
    log "  already localhost-only, skipping"
  fi

  # Report any pg_hba.conf line that allows non-local ranges — this needs a
  # human decision (what the intended app role/db name is) rather than a
  # blind sed rewrite, so it's reported, not auto-edited.
  NON_LOCAL=$(grep -vE "^\s*#|^\s*$" "$PG_HBA" | grep -E "0\.0\.0\.0/0|::/0" || true)
  if [[ -n "$NON_LOCAL" ]]; then
    warn "pg_hba.conf allows non-local ranges — review and fix manually:"
    echo "$NON_LOCAL" >&2
  else
    log "  pg_hba.conf has no obvious 0.0.0.0/0 or ::/0 entries"
  fi

  systemctl restart postgresql
  log "  postgresql restarted"
fi
log "  Reminder: the app DB role's password must be strong regardless of listen_addresses — rotate it now if it hasn't been rotated since the Railway migration (see VPS-HARDENING.md, git-history secret exposure section)."

# ---------------------------------------------------------------------------
# 2. Firewall
# ---------------------------------------------------------------------------
log "2/8 Configuring ufw..."
if ! command -v ufw &>/dev/null; then
  apt-get install -y ufw
fi
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit 22/tcp comment "SSH, rate-limited"
ufw deny 5432/tcp comment "Postgres — must never be reachable externally"
ufw deny 6379/tcp comment "Redis — must never be reachable externally"
ufw --force enable
log "  ufw status:"
ufw status verbose

log "  Listening sockets (verify nothing unexpected is bound to a public interface):"
ss -tlnp || true

# ---------------------------------------------------------------------------
# 3. SSH hardening + fail2ban
# ---------------------------------------------------------------------------
log "3/8 Hardening sshd..."
SSHD_CONFIG="/etc/ssh/sshd_config"
set_sshd_option() {
  local key="$1" value="$2"
  if grep -qE "^\s*#?\s*${key}\s+" "$SSHD_CONFIG"; then
    sed -i "s/^\s*#\?\s*${key}\s\+.*/${key} ${value}/" "$SSHD_CONFIG"
  else
    echo "${key} ${value}" >> "$SSHD_CONFIG"
  fi
}
set_sshd_option "PasswordAuthentication" "no"
set_sshd_option "PermitRootLogin" "no"
set_sshd_option "PubkeyAuthentication" "yes"
sshd -t && systemctl reload sshd
log "  sshd_config: PasswordAuthentication no, PermitRootLogin no"
warn "Before this takes effect on a real session: confirm your own SSH key is already authorized (~/.ssh/authorized_keys for your login user) — a mistake here can lock you out. This script does NOT verify that for you."

if ! command -v fail2ban-client &>/dev/null; then
  apt-get install -y fail2ban
fi
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban
log "  fail2ban enabled for sshd"

# ---------------------------------------------------------------------------
# 4. nginx / TLS
# ---------------------------------------------------------------------------
log "4/8 Checking nginx..."
if ! command -v nginx &>/dev/null; then
  warn "nginx is not installed but nginx.conf in this repo assumes it fronts PM2. STOPPING — do not expose Node directly. Install nginx and deploy nginx.conf first (see its own header comment for install/certbot commands), then re-run this script."
  exit 1
fi
if ! grep -q "server_tokens off" /etc/nginx/nginx.conf 2>/dev/null; then
  log "  adding 'server_tokens off;' to /etc/nginx/nginx.conf http block"
  sed -i '/http {/a \    server_tokens off;' /etc/nginx/nginx.conf
fi
nginx -t
systemctl reload nginx
log "  nginx config valid and reloaded"

if command -v certbot &>/dev/null; then
  systemctl is-enabled certbot.timer &>/dev/null && log "  certbot.timer enabled (auto-renewal active)" || warn "certbot.timer is not enabled — TLS certs will expire without action"
else
  warn "certbot not found — install via 'apt install certbot python3-certbot-nginx' and run 'certbot --nginx -d motoxplus.com -d www.motoxplus.com'"
fi

# ---------------------------------------------------------------------------
# 5. Unattended security upgrades
# ---------------------------------------------------------------------------
log "5/8 Enabling unattended-upgrades..."
apt-get install -y unattended-upgrades apt-listchanges
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now unattended-upgrades
log "  unattended-upgrades enabled"

# ---------------------------------------------------------------------------
# 6. Backups — verify the existing scripts/db/backup.sh is actually cronned
# ---------------------------------------------------------------------------
log "6/8 Checking backup cron..."
if [[ -f "$APP_DIR/scripts/db/backup.sh" ]]; then
  if crontab -l 2>/dev/null | grep -q "backup.sh"; then
    log "  backup.sh already in crontab"
  else
    warn "scripts/db/backup.sh exists but is NOT in crontab. Add it, e.g.:"
    echo "  0 2 * * * $APP_DIR/scripts/db/backup.sh --upload-r2 >> /var/log/motoxplus-backup.log 2>&1" >&2
  fi
else
  warn "scripts/db/backup.sh not found at $APP_DIR — cannot verify backup cron"
fi

# ---------------------------------------------------------------------------
# 7. Secrets hygiene
# ---------------------------------------------------------------------------
log "7/8 Checking .env permissions and PM2 user..."
if [[ -f "$APP_DIR/.env" ]]; then
  chmod 600 "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env" 2>/dev/null || warn "could not chown .env to $APP_USER — does that user exist?"
  log "  .env set to 600, owned by $APP_USER"
else
  warn ".env not found at $APP_DIR/.env — set APP_DIR correctly and re-run"
fi

if pgrep -u root -f "PM2" &>/dev/null; then
  warn "PM2 appears to be running as root. It should run as $APP_USER: 'pm2 kill' as root, then start it as $APP_USER instead."
else
  log "  PM2 does not appear to be running as root"
fi

log "  IMPORTANT — this repo's git history has .env committed in early commits"
log "  (removed later, but git history is permanent). If this VPS's .env still"
log "  holds any of the values from that history, rotate ALL of: DATABASE_URL"
log "  password, JWT_SECRET, NEXTAUTH_SECRET, RAZORPAY_KEY_SECRET, RESEND_API_KEY,"
log "  DELHIVERY_API_TOKEN, DELHIVERY_WEBHOOK_SECRET, and any SMS provider"
log "  (Twilio/MSG91) credentials. See VPS-HARDENING.md for the full list and"
log "  why — this script does not do the rotation for you (it needs an actual"
log "  human decision about downtime/re-login impact)."

# ---------------------------------------------------------------------------
# 8. Done
# ---------------------------------------------------------------------------
log "8/8 Done. Run the verification checklist in VPS-HARDENING.md next."
