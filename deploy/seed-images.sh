#!/usr/bin/env bash
# deploy/seed-images.sh
#
# Seed the full card-image set (~3,681 images, ~500 MB) onto the Fly.io
# persistent volume. Run ONCE after the first deploy (and after any deploy
# on a fresh volume). Idempotent — skips images already present.
#
# Usage (after first deploy):
#   fly ssh console -a <your-app-name>
#   # inside the console:
#   cd /app && node deploy/seed-images.mjs
#
# Or run directly from your workstation via fly sftp / fly ssh:
#   fly ssh console -a <your-app-name> -C "node /app/deploy/seed-images.mjs"
#
# The script respects the 20 req/s cap from YGOPRODeck (≈16 req/s).
# Images are saved to /data/images/<imageId>.jpg (the Fly volume mount).
#
# NOTE: The web frontend currently hotlinks images from the YGOPRODeck CDN.
# Once the frontend is updated to use /images/<imageId>.jpg (a future spec),
# images on the volume will be served by the Express server at /images/*.

set -euo pipefail

APP=${1:-yugioh-edison}

echo "Seeding card images on Fly.io app: $APP"
echo ""
echo "This runs the seed script inside the running Machine."
echo "It downloads ~3,681 images from YGOPRODeck at ≤20 req/s."
echo "This may take ~4-5 minutes. Images are skipped if already present."
echo ""

fly ssh console -a "$APP" -C "node /app/deploy/seed-images.mjs"
