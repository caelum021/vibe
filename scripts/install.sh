#!/usr/bin/env bash
# Build vibe in release mode and install it into /Applications.
#
# Why this exists: the `vibe` CLI is not installed, so the app is launched from
# /Applications/vibe.app. `cargo tauri build` only writes to the project's build
# dir, and the DMG is unsigned (Gatekeeper blocks it), so a manual copy is the
# reliable install path. This script does the whole build -> replace -> launch.
#
# Usage:
#   scripts/install.sh            # build, install, and launch
#   scripts/install.sh --no-open  # build and install, don't launch

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="vibe"
SRC_APP="$ROOT/src-tauri/target/release/bundle/macos/$APP_NAME.app"
DEST_APP="/Applications/$APP_NAME.app"

OPEN_AFTER=1
[ "${1:-}" = "--no-open" ] && OPEN_AFTER=0

echo "==> Building release bundle (this recompiles Rust; first run is slow)..."
( cd "$ROOT/src-tauri" && cargo tauri build )

if [ ! -d "$SRC_APP" ]; then
  echo "ERROR: expected build output not found at $SRC_APP" >&2
  exit 1
fi

echo "==> Quitting any running $APP_NAME..."
osascript -e "quit app \"$APP_NAME\"" 2>/dev/null || true
sleep 1
pkill -f "$DEST_APP" 2>/dev/null || true
sleep 1

echo "==> Installing to $DEST_APP..."
rm -rf "$DEST_APP"
ditto "$SRC_APP" "$DEST_APP"

# Local unsigned build: strip quarantine so Gatekeeper doesn't block launch.
xattr -dr com.apple.quarantine "$DEST_APP" 2>/dev/null || true

VERSION="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$DEST_APP/Contents/Info.plist" 2>/dev/null || echo '?')"
echo "==> Installed $APP_NAME $VERSION to $DEST_APP"

if [ "$OPEN_AFTER" = "1" ]; then
  echo "==> Launching..."
  open -a "$DEST_APP"
fi
