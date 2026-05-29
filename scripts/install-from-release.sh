#!/usr/bin/env bash
# Install vibe (caelum's fork) from the latest GitHub Release — no Rust, no build.
#
# This downloads the prebuilt macOS app from
#   https://github.com/caelum021/vibe/releases
# unzips it, strips the Gatekeeper quarantine flag (the build is unsigned), drops
# it into /Applications, and launches it.
#
# One-liner (no clone needed):
#   curl -fsSL https://raw.githubusercontent.com/caelum021/vibe/main/scripts/install-from-release.sh | bash

set -euo pipefail

REPO="caelum021/vibe"
APP_NAME="vibe"
DEST_APP="/Applications/$APP_NAME.app"
API="https://api.github.com/repos/$REPO/releases"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "ERROR: this installer is for macOS only." >&2
  exit 1
fi

ARCH="$(uname -m)" # arm64 (Apple Silicon) or x86_64 (Intel)
echo "==> Looking up the latest release of $REPO..."

# Pick the newest release's macOS .app zip. The releases API lists newest first,
# so head -1 is the latest (works even if it's marked as a pre-release).
ASSET_URL="$(curl -fsSL "$API" \
  | grep -o '"browser_download_url": *"[^"]*macos[^"]*\.zip"' \
  | sed 's/.*"\(https[^"]*\)"/\1/' \
  | head -1)"

if [ -z "${ASSET_URL:-}" ]; then
  echo "ERROR: no macOS .app zip found in the latest release." >&2
  echo "       Check https://github.com/$REPO/releases" >&2
  exit 1
fi

[ "$ARCH" = "x86_64" ] && echo "NOTE: this Mac is Intel; the published build targets Apple Silicon. It will run under Rosetta if installed."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "==> Downloading $ASSET_URL"
curl -fL "$ASSET_URL" -o "$TMP/vibe.zip"

echo "==> Unpacking..."
ditto -x -k "$TMP/vibe.zip" "$TMP/extracted"
SRC_APP="$(find "$TMP/extracted" -maxdepth 2 -name "$APP_NAME.app" -type d | head -1)"
if [ -z "${SRC_APP:-}" ]; then
  echo "ERROR: $APP_NAME.app not found inside the downloaded archive." >&2
  exit 1
fi

echo "==> Quitting any running $APP_NAME..."
osascript -e "quit app \"$APP_NAME\"" 2>/dev/null || true
sleep 1

echo "==> Installing to $DEST_APP..."
rm -rf "$DEST_APP"
ditto "$SRC_APP" "$DEST_APP"
xattr -dr com.apple.quarantine "$DEST_APP" 2>/dev/null || true

VERSION="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$DEST_APP/Contents/Info.plist" 2>/dev/null || echo '?')"
echo "==> Installed $APP_NAME $VERSION. Launching..."
open -a "$DEST_APP"
