#!/usr/bin/env bash
# =============================================================================
# MotoXPlus PostgreSQL Restore Script
# =============================================================================
# Usage:
#   ./scripts/db/restore.sh /path/to/backup.sql.gz
#   ./scripts/db/restore.sh --list-r2         # list available R2 backups
#   ./scripts/db/restore.sh --from-r2 <key>   # restore from R2
#
# WARNING: This will DROP and recreate the motoxplus database.
#          Ensure the app is stopped before restoring.
#
# Requires:
#   - psql, createdb, dropdb (postgresql-client)
#   - aws cli for --from-r2 option
# =============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/motoxplus}"

# Load .env if DATABASE_URL not set
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${APP_DIR}/.env" ]]; then
  export "$(grep -v '^#' "${APP_DIR}/.env" | grep 'DATABASE_URL' | xargs)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[restore] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
LIST_R2=false
FROM_R2=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list-r2) LIST_R2=true; shift ;;
    --from-r2) FROM_R2="$2"; shift 2 ;;
    -*) echo "[restore] Unknown option: $1" >&2; exit 1 ;;
    *) BACKUP_FILE="$1"; shift ;;
  esac
done

# Load R2 env vars if needed
load_r2_env() {
  if [[ -z "${R2_ACCOUNT_ID:-}" ]] && [[ -f "${APP_DIR}/.env" ]]; then
    export "$(grep -v '^#' "${APP_DIR}/.env" | grep -E '^R2_' | xargs)"
  fi
}

# ---------------------------------------------------------------------------
# List R2 backups
# ---------------------------------------------------------------------------
if [[ "${LIST_R2}" == "true" ]]; then
  load_r2_env
  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  echo "[restore] Listing R2 backups in s3://${R2_BUCKET_NAME}/backups/db/"
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 ls \
    "s3://${R2_BUCKET_NAME}/backups/db/" \
    --endpoint-url "${R2_ENDPOINT}" \
    --region auto \
    --human-readable \
    --recursive \
    | sort -r | head -20
  exit 0
fi

# ---------------------------------------------------------------------------
# Download from R2
# ---------------------------------------------------------------------------
if [[ -n "${FROM_R2}" ]]; then
  load_r2_env
  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  BACKUP_FILE="${BACKUP_DIR}/restore_$(date +%Y%m%d_%H%M%S).sql.gz"
  mkdir -p "${BACKUP_DIR}"
  echo "[restore] Downloading s3://${R2_BUCKET_NAME}/${FROM_R2} → ${BACKUP_FILE}"
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 cp \
    "s3://${R2_BUCKET_NAME}/${FROM_R2}" \
    "${BACKUP_FILE}" \
    --endpoint-url "${R2_ENDPOINT}" \
    --region auto
  echo "[restore] Downloaded."
fi

# ---------------------------------------------------------------------------
# Validate backup file
# ---------------------------------------------------------------------------
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "[restore] Usage: $0 <backup.sql.gz>" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[restore] ERROR: File not found: ${BACKUP_FILE}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Safety confirmation
# ---------------------------------------------------------------------------
echo ""
echo "======================================================================"
echo "  WARNING: This will DESTROY the current database and restore from:"
echo "  ${BACKUP_FILE}"
echo "  Size: $(du -sh "${BACKUP_FILE}" | cut -f1)"
echo "======================================================================"
echo ""
read -rp "Type 'RESTORE' to confirm: " CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "[restore] Aborted."
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract DB name from DATABASE_URL
# ---------------------------------------------------------------------------
DB_NAME="$(echo "${DATABASE_URL}" | sed -E 's|.*\/([^?]+).*|\1|')"
DB_HOST="$(echo "${DATABASE_URL}" | sed -E 's|.*@([^:/]+).*|\1|')"
DB_PORT="$(echo "${DATABASE_URL}" | sed -E 's|.*:([0-9]+)/.*|\1|')"
DB_USER="$(echo "${DATABASE_URL}" | sed -E 's|postgresql://([^:]+):.*|\1|')"

echo "[restore] Target database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"

# ---------------------------------------------------------------------------
# Stop the application
# ---------------------------------------------------------------------------
if command -v pm2 &>/dev/null; then
  echo "[restore] Stopping PM2 app..."
  pm2 stop motoxplus 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------
echo "[restore] Dropping and recreating database: ${DB_NAME}"
PGPASSWORD="${DATABASE_URL##*:}" \
  dropdb --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" --if-exists "${DB_NAME}"
PGPASSWORD="${DATABASE_URL##*:}" \
  createdb --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" "${DB_NAME}"

echo "[restore] Restoring from ${BACKUP_FILE}..."
zcat "${BACKUP_FILE}" \
  | PGPASSWORD="${DATABASE_URL##*:}" \
    psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    --quiet

echo "[restore] Restore complete."

# ---------------------------------------------------------------------------
# Restart the application
# ---------------------------------------------------------------------------
if command -v pm2 &>/dev/null; then
  echo "[restore] Restarting PM2 app..."
  pm2 start ecosystem.config.js --env production
fi

echo "[restore] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
