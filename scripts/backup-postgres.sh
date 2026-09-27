#!/usr/bin/env bash
# Nightly (or on-demand) Postgres backup → file or S3
# Usage: DATABASE_URL=postgres://... ./scripts/backup-postgres.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/medcore-${STAMP}.sql.gz"
echo "Backing up to $FILE"
pg_dump "$DATABASE_URL" | gzip -c > "$FILE"
echo "OK $(du -h "$FILE" | cut -f1)"
if [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
  aws s3 cp "$FILE" "s3://${S3_BACKUP_BUCKET}/postgres/${STAMP}.sql.gz"
  echo "Uploaded to s3://${S3_BACKUP_BUCKET}/postgres/${STAMP}.sql.gz"
fi
