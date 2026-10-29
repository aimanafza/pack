#!/bin/sh
# Package the PACK extension for the Chrome Web Store.
# Run from anywhere: sh pack-extension/build.sh
# Writes pack-extension/dist/pack-extension-<version>.zip
set -e
cd "$(dirname "$0")"

if grep -q '^const DEV = true' config.js; then
  echo "config.js still has DEV = true. Set it to false before packaging." >&2
  exit 1
fi

VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' manifest.json)
OUT="dist/pack-extension-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"

# Only what Chrome runs: no build helpers, icon sources or this script
zip -q -X "$OUT" manifest.json config.js background.js content.js \
  sidepanel.html sidepanel.css sidepanel.js \
  icons/icon16.png icons/icon48.png icons/icon128.png

echo "Packaged $OUT ($(du -h "$OUT" | cut -f1 | tr -d ' '))"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
