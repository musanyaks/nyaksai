#!/usr/bin/env bash
# Builds the Nyaksai source bundle (downloadable from the app at /nyaksai-bundle.zip).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="public/nyaksai-bundle.zip"
rm -f "$OUT"

zip -r -q "$OUT" \
  src prisma desktop scripts public README.md README-NYAKSAI.md .env.example \
  package.json bun.lock next.config.ts tailwind.config.ts postcss.config.mjs \
  tsconfig.json components.json eslint.config.mjs \
  -x "public/nyaksai-bundle.zip" "public/Nyaksai-*.exe" "public/*.exe" \
     "desktop/node_modules/*" "desktop/resources/*" "desktop/dist/*" \
     "scripts/imgsearch.sh" 2>/dev/null || true

# .env.example may not exist yet in some checkouts — create a stub so the zip is valid
if [ ! -f .env.example ]; then
  echo 'DATABASE_URL="file:../db/custom.db"' > .env.example
  zip -q "$OUT" .env.example
fi

echo "Bundle written to $OUT ($(du -h "$OUT" | cut -f1))"
