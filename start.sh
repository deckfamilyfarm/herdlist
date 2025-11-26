#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="herdlist-db"
APP_PORT=3005

cd "$APP_DIR"

echo "=== Building herdlist (npm run build) ==="
npm run build

echo "=== Starting/reloading PM2 app: $APP_NAME on port $APP_PORT ==="

# If the app is already managed by pm2, reload it; otherwise start it
if pm2 list | grep -q "$APP_NAME"; then
  NODE_ENV=production PORT="$APP_PORT" pm2 reload "$APP_NAME" \
    --update-env
else
  NODE_ENV=production PORT="$APP_PORT" pm2 start dist/index.js \
    --name "$APP_NAME" \
    --cwd "$APP_DIR" \
    --max-memory-restart 300M \
    --node-args="--max_old_space_size=300" \
    --log-date-format="YYYY-MM-DD HH:mm Z"
fi

echo "=== Done. pm2 status $APP_NAME ==="
pm2 status "$APP_NAME"

