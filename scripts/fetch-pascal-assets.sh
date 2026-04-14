#!/usr/bin/env bash
# Fetches the Pascal editor's public assets (items, icons, audios) into
# frontend/public/pascal/. The @pascal-app/* npm packages do not ship these
# assets, so they are cloned directly from github.com/pascalorg/editor.
set -euo pipefail

REPO_URL="https://github.com/pascalorg/editor.git"
TARGET="frontend/public/pascal"

if [ -d "$TARGET/items" ] && [ -d "$TARGET/icons" ] && [ -d "$TARGET/audios" ]; then
  echo "pascal assets already present at $TARGET — skipping"
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "cloning pascalorg/editor (sparse) into $tmp..."
git clone --depth=1 --filter=blob:none --sparse "$REPO_URL" "$tmp/editor"
git -C "$tmp/editor" sparse-checkout set apps/web/public/items apps/web/public/icons apps/web/public/audios

mkdir -p "$TARGET"
cp -R "$tmp/editor/apps/web/public/items" "$TARGET/items"
cp -R "$tmp/editor/apps/web/public/icons" "$TARGET/icons"
cp -R "$tmp/editor/apps/web/public/audios" "$TARGET/audios"

echo "pascal assets installed at $TARGET"
