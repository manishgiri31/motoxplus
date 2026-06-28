#!/usr/bin/env bash
# =============================================================================
# MotoXPlus PostgreSQL Backup Script
# =============================================================================
# Usage:
#   ./scripts/db/backup.sh                  # manual run
#   ./scripts/db/backup.sh --upload-r2      # backup + upload to Cloudflare R2
#
# Cron example (daily at 02:00 with R2 upload):
#   0 2 * * * /var/www/motoxplus/scripts/db/backup.sh --upload-r2 >> /var/log/motoxplus-backup.log 2>&1
#
# Requires:
#   - pg_dump (postgresql-client)
#   - aws cli (pip install awscli) OR rclone configured for R2
#   - .env loaded or DATABASE_URL exported
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/motoxplus}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/motoxplus_${TIMESTAMP}.sql.gz"

# Load .env if present and DATABASE_URL not already set
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${APP_DIR}/.env" ]]; then
  export "$(grep -v '^#' "${APP_DIR}/.env" | grep 'DATABASE_URL' | xargs)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

UPLOAD_R2=false
for arg in "$@"; do
  [[ "$arg" == "--upload-r2" ]] && UPLOAD_R2=true
done

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[backup] Output: ${BACKUP_FILE}"

# ---------------------------------------------------------------------------
# pg_dump → gzip
# ---------------------------------------------------------------------------
pg_dump \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  "${DATABASE_URL}" \
  | gzip -9 \
  > "${BACKUP_FILE}"

BACKUP_SIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
echo "[backup] Backup complete — size: ${BACKUP_SIZE}"

# ---------------------------------------------------------------------------
# Upload to Cloudflare R2 (optional)
# ---------------------------------------------------------------------------
if [[ "${UPLOAD_R2}" == "true" ]]; then
  if [[ -z "${R2_ACCOUNT_ID:-}" ]] || [[ -z "${R2_ACCESS_KEY_ID:-}" ]] || [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]] || [[ -z "${R2_BUCKET_NAME:-}" ]]; then
    # Load R2 vars from .env
    if [[ -f "${APP_DIR}/.env" ]]; then
      export "$(grep -v '^#' "${APP_DIR}/.env" | grep -E '^R2_' | xargs)"
    fi
  fi

  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  R2_KEY="backups/db/motoxplus_${TIMESTAMP}.sql.gz"

  echo "[backup] Uploading to R2: s3://${R2_BUCKET_NAME}/${R2_KEY}"

  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 cp \
    "${BACKUP_FILE}" \
    "s3://${R2_BUCKET_NAME}/${R2_KEY}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --region auto \
    --no-progress

  echo "[backup] Upload complete."
fi

# ---------------------------------------------------------------------------
# Remove old backups (local)
# ---------------------------------------------------------------------------
echo "[backup] Removing local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "motoxplus_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING="$(find "${BACKUP_DIR}" -name "motoxplus_*.sql.gz" | wc -l)"
echo "[backup] Retained ${REMAINING} local backup(s)."

echo "[backup] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
