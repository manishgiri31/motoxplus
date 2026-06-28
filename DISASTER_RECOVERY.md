# MotoXPlus — Disaster Recovery Plan

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Application crash | < 2 min (PM2 auto-restart) | 0 |
| Server reboot | < 5 min | 0 |
| Database corruption | < 1 hour | 24 hours max |
| Server total loss | < 4 hours | 24 hours max |
| Full region failure | < 8 hours | 24 hours max |

---

## Scenario 1 — Application Crash

PM2 auto-restarts the app. If it keeps crashing:

```bash
# Check what's wrong
pm2 logs motoxplus --err --lines 100

# Common causes:
# - Missing env variable → check .env
# - Port already in use → pkill -f "next start"
# - Out of memory → check with `free -m`

# Manual restart
pm2 restart motoxplus
```

---

## Scenario 2 — Server Reboot

PM2 and Nginx are configured to start on boot.

```bash
# Verify PM2 startup is saved
pm2 save
pm2 startup  # run the printed command if not done yet

# Verify Nginx
sudo systemctl enable nginx

# After reboot, check
pm2 list
sudo systemctl status nginx
curl https://motoxplus.com/api/health
```

---

## Scenario 3 — Database Corruption

### Detect

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check for corruption
psql "${DATABASE_URL}" -c "SELECT * FROM pg_catalog.pg_tables LIMIT 5;"
```

### Repair or restore

```bash
# Option A: PostgreSQL auto-repair (WAL recovery)
sudo systemctl restart postgresql

# Option B: Restore from backup
./scripts/db/restore.sh /var/backups/motoxplus/LATEST_BACKUP.sql.gz

# Option C: Restore from R2 (if local backup is also corrupted)
./scripts/db/restore.sh --list-r2
./scripts/db/restore.sh --from-r2 backups/db/LATEST_KEY.sql.gz
```

---

## Scenario 4 — Full Server Loss

### Prerequisites (set up before disaster)

1. Database backups uploaded to Cloudflare R2 (daily via cron)
2. Code in GitHub
3. `.env` values stored in a secure password manager
4. SSH keys for new server stored securely

### Recovery steps

**1. Provision new server** (Ubuntu 24.04, 4+ GB RAM)

**2. Run server setup** (takes ~20 min)

Follow [DEPLOYMENT.md](DEPLOYMENT.md) — First-Time Server Setup section.

**3. Restore database from R2**

```bash
cd /var/www/motoxplus

# List available R2 backups
./scripts/db/restore.sh --list-r2

# Restore the latest one
./scripts/db/restore.sh --from-r2 backups/db/motoxplus_YYYYMMDD_HHMMSS.sql.gz
```

**4. Build and start the application**

```bash
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

**5. Update DNS**

In Cloudflare: update the A record for `motoxplus.com` to the new server IP.  
DNS propagation: instant with Cloudflare proxied, up to 300s TTL otherwise.

**6. Obtain new SSL certificate**

```bash
sudo certbot --nginx -d motoxplus.com -d www.motoxplus.com
```

**7. Verify**

```bash
curl -s https://motoxplus.com/api/health | python3 -m json.tool
```

---

## Scenario 5 — Cloudflare R2 Outage

File uploads will fail. Existing images will not load.

**Mitigation:**
- The app degrades gracefully (image not found shows a placeholder)
- Orders and payments continue working (no R2 dependency)
- R2 has 99.9% SLA uptime

**Recovery:**
- R2 outages are usually resolved within minutes to hours by Cloudflare
- Monitor: https://www.cloudflarestatus.com

---

## Scenario 6 — Razorpay Outage

Online payments (Razorpay) will fail. UPI/bank transfer (manual payment submission) remains available as a fallback.

**Mitigation:**
- Dealers can submit payment screenshots for manual verification
- Admin can manually approve payments via `/admin/payments`

---

## Data Recovery — Specific Tables

### Recover a deleted order

Orders cascade to `OrderItem`, `Payment`, `Invoice`. If accidentally deleted via Prisma Studio or direct SQL, restore from backup:

```bash
# Restore to temp database
pg_restore --dbname=postgresql://motoxplus:PASSWORD@localhost/motoxplus_temp backup.dump

# Extract specific records
psql postgresql://motoxplus:PASSWORD@localhost/motoxplus_temp \
  -c "SELECT * FROM \"Order\" WHERE id = 'ORDER_ID';"

# Re-insert into production
psql "${DATABASE_URL}" < extracted_records.sql
```

---

## Post-Recovery Checklist

After any recovery event:

- [ ] All PM2 instances are running: `pm2 list`
- [ ] Health check passes: `curl https://motoxplus.com/api/health`
- [ ] Can log in to admin panel
- [ ] Can log in as a test dealer account
- [ ] Recent orders are visible in admin
- [ ] File uploads work (upload a test image)
- [ ] Payment flow works (create a test order)
- [ ] Email notifications work (trigger a test email)
- [ ] Database backup scheduled: `crontab -l`
- [ ] Update post-mortem document with root cause and timeline
