# MotoXPlus — Operations Runbook

## Daily Operations

### Check application health

```bash
curl -s https://motoxplus.com/api/health | python3 -m json.tool
```

Expected output:
```json
{
  "status": "ok",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latencyMs": 2 }
  }
}
```

### Check PM2 status

```bash
pm2 list
pm2 monit      # real-time dashboard
```

### Check Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
```

### Check disk space

```bash
df -h /
du -sh /var/backups/motoxplus/
du -sh /var/log/pm2/
du -sh /var/www/motoxplus/.next/
```

---

## Application Logs

### PM2 logs

```bash
pm2 logs motoxplus             # tail (press Ctrl+C to stop)
pm2 logs motoxplus --lines 200 # last 200 lines
pm2 logs motoxplus --err       # errors only

# Log files
tail -100 /var/log/pm2/motoxplus-out.log
tail -100 /var/log/pm2/motoxplus-error.log
```

### Nginx logs

```bash
# Access log
tail -100 /var/log/nginx/motoxplus-access.log

# Error log
tail -100 /var/log/nginx/motoxplus-error.log

# Live tail
sudo tail -f /var/log/nginx/motoxplus-access.log
```

### Database query stats

```bash
# Connect to database
psql "${DATABASE_URL}"

# Check slow queries (pg_stat_statements required)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

# Table sizes
SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

# Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

---

## Common Operations

### Zero-downtime reload (after code change)

```bash
cd /var/www/motoxplus
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload ecosystem.config.js --env production --update-env
```

### Database migration only

```bash
cd /var/www/motoxplus
npx prisma migrate deploy
pm2 reload motoxplus  # reload to pick up schema changes
```

### Clear Next.js cache

```bash
cd /var/www/motoxplus
rm -rf .next
npm run build
pm2 reload motoxplus
```

### Scale up PM2 instances

```bash
# Check current instances
pm2 list

# Scale to specific number
pm2 scale motoxplus 4

# Scale to all CPUs
pm2 scale motoxplus max
```

### Rotate Nginx logs

```bash
sudo logrotate -f /etc/logrotate.d/nginx
```

### Reload Nginx (after config change)

```bash
sudo nginx -t              # test config first
sudo nginx -s reload       # graceful reload
```

---

## Troubleshooting

### Application not responding

```bash
# Check PM2 status
pm2 list

# If stopped, restart
pm2 start ecosystem.config.js --env production

# Check logs for errors
pm2 logs motoxplus --err --lines 50
```

### 502 Bad Gateway

Nginx can't reach Node.js on port 3000.

```bash
# Is Node.js running?
pm2 list
ss -tlnp | grep 3000

# Restart PM2
pm2 restart motoxplus

# Check Nginx error log
sudo tail -50 /var/log/nginx/motoxplus-error.log
```

### Database connection errors

```bash
# Test connection
psql "${DATABASE_URL}" -c "SELECT 1;"

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check Prisma can connect
cd /var/www/motoxplus && npx prisma db pull

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Out of memory (OOM)

```bash
# Check memory usage
free -m
pm2 monit

# PM2 auto-restarts on OOM, but check logs
pm2 logs motoxplus --err --lines 100

# Reduce instances if needed
pm2 scale motoxplus 1
```

### High CPU

```bash
# Check which PM2 instances are heavy
pm2 monit

# Check PostgreSQL queries
psql "${DATABASE_URL}" -c "SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle' LIMIT 10;"

# Check Nginx rate limiting (429s indicate abuse)
grep "429" /var/log/nginx/motoxplus-access.log | tail -20
```

### Let's Encrypt renewal failed

```bash
sudo certbot renew
sudo systemctl status certbot.timer
```

---

## Database Operations

### Connect

```bash
psql "${DATABASE_URL}"
# or
psql -h localhost -U motoxplus -d motoxplus
```

### Quick data checks

```bash
psql "${DATABASE_URL}" <<EOF
SELECT 'orders' AS entity, count(*) FROM "Order"
UNION ALL SELECT 'dealers', count(*) FROM "Dealer"
UNION ALL SELECT 'products', count(*) FROM "Product"
UNION ALL SELECT 'payments', count(*) FROM "Payment";
EOF
```

### Pending dealer approvals

```bash
psql "${DATABASE_URL}" -c "SELECT d.\"companyName\", u.email, d.\"createdAt\" FROM \"Dealer\" d JOIN \"User\" u ON d.\"userId\" = u.id WHERE d.status = 'PENDING' ORDER BY d.\"createdAt\" DESC LIMIT 10;"
```

### Recent orders

```bash
psql "${DATABASE_URL}" -c "SELECT \"orderNumber\", \"grandTotal\", status, \"createdAt\" FROM \"Order\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

---

## Scheduled Tasks (Cron)

| Task | Schedule | Command |
|------|----------|---------|
| Database backup | Daily 02:00 | `./scripts/db/backup.sh --upload-r2` |
| Let's Encrypt renewal | Twice daily | Managed by Certbot |
| PM2 log rotation | Daily | `pm2 flush motoxplus` |

View cron: `crontab -l`

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Tech Lead | info@motoxplus.in |
| Hosting | Check VPS provider portal |
| Cloudflare | https://dash.cloudflare.com |
| Razorpay | https://dashboard.razorpay.com |
