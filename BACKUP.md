# MotoXPlus — Backup & Restore Guide

## Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Database (full) | Daily at 02:00 | 14 days local, 90 days R2 | Local + Cloudflare R2 |
| Application code | Continuous | Git history | GitHub |
| Uploaded files | Real-time | Permanent | Cloudflare R2 |
| Environment config | Manual | Secure vault | 1Password / Bitwarden |

---

## Automated Database Backups

### Setup

```bash
# Make scripts executable
chmod +x /var/www/motoxplus/scripts/db/backup.sh
chmod +x /var/www/motoxplus/scripts/db/restore.sh

# Add AWS CLI for R2 uploads (optional)
pip3 install awscli

# Add daily cron at 02:00 with R2 upload
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/motoxplus/scripts/db/backup.sh --upload-r2 >> /var/log/motoxplus-backup.log 2>&1") | crontab -

# Verify cron
crontab -l
```

### Manual backup

```bash
# Local backup only
./scripts/db/backup.sh

# Backup + upload to Cloudflare R2
./scripts/db/backup.sh --upload-r2
```

Backups are stored at `/var/backups/motoxplus/`.

### Verify latest backup

```bash
ls -lh /var/backups/motoxplus/ | tail -5
```

---

## Restore

### From local backup

```bash
# List available backups
ls -lh /var/backups/motoxplus/

# Restore (will prompt for confirmation)
./scripts/db/restore.sh /var/backups/motoxplus/motoxplus_20240115_020000.sql.gz
```

### From Cloudflare R2

```bash
# List R2 backups
./scripts/db/restore.sh --list-r2

# Restore from a specific R2 key
./scripts/db/restore.sh --from-r2 backups/db/motoxplus_20240115_020000.sql.gz
```

---

## Manual Database Backup (quick)

```bash
# Without compression
pg_dump "${DATABASE_URL}" > backup.sql

# With compression
pg_dump "${DATABASE_URL}" | gzip -9 > backup.sql.gz

# Custom format (faster restore, allows parallel restore)
pg_dump --format=custom "${DATABASE_URL}" > backup.dump
```

---

## Manual Restore (quick)

```bash
# From plain SQL
psql "${DATABASE_URL}" < backup.sql

# From gzip
zcat backup.sql.gz | psql "${DATABASE_URL}"

# From custom format
pg_restore --dbname="${DATABASE_URL}" backup.dump
```

---

## R2 File Storage Backup

Product images, dealer documents, and payment screenshots are stored in Cloudflare R2.  
R2 has built-in redundancy (11 nines durability) — no additional backup is needed.

To download a local copy:
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure for R2 (see https://rclone.org/s3/#cloudflare-r2)
rclone config

# Sync R2 bucket locally
rclone sync r2:motoxplus-assets /local/backup/r2/
```

---

## Backup Testing

Test restores monthly in a staging environment:

```bash
# On staging server
DATABASE_URL="postgresql://motoxplus:PASSWORD@localhost/motoxplus_restore_test" \
  ./scripts/db/restore.sh /var/backups/motoxplus/latest.sql.gz
```

---

## Backup Log

View backup history:

```bash
cat /var/log/motoxplus-backup.log | tail -50
```

---

## Disaster Recovery

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for complete DR procedures.
