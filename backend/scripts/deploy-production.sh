#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-nuar-backend}"
READINESS_URL="${READINESS_URL:-http://127.0.0.1:3001/ready}"

cd "${BACKEND_DIR}"

on_error() {
  local exit_code=$?
  echo >&2
  echo "Deployment stopped before a confirmed healthy restart (exit ${exit_code})." >&2
  echo "Inspect the error above. Do not mark a failed Prisma migration as applied." >&2
  exit "${exit_code}"
}
trap on_error ERR

echo "[1/8] Installing locked backend dependencies..."
npm ci

echo "[2/8] Generating Prisma Client..."
npx prisma generate

echo "[3/8] Creating and verifying a pre-deploy database backup..."
node scripts/backup-db.js --tag=pre-deploy

echo "[4/8] Checking CRM data integrity before migrations..."
node scripts/check-data-integrity.js

echo "[5/8] Applying pending production migrations..."
npx prisma migrate deploy
npx prisma migrate status

echo "[6/8] Checking CRM data integrity after migrations..."
node scripts/check-data-integrity.js

echo "[7/8] Restarting ${PM2_PROCESS_NAME}..."
if ! pm2 describe "${PM2_PROCESS_NAME}" >/dev/null 2>&1; then
  echo "PM2 process '${PM2_PROCESS_NAME}' was not found." >&2
  echo "Available processes:" >&2
  pm2 list >&2 || true
  exit 1
fi
pm2 restart "${PM2_PROCESS_NAME}" --update-env
pm2 save

echo "[8/8] Waiting for backend readiness check..."
for attempt in {1..10}; do
  if curl --fail --silent --show-error "${READINESS_URL}"; then
    echo
    trap - ERR
    echo "NUAR CRM backend deployed successfully."
    exit 0
  fi
  if [[ "${attempt}" -lt 10 ]]; then
    sleep 2
  fi
done

echo "Backend did not become ready at ${READINESS_URL}." >&2
exit 1
