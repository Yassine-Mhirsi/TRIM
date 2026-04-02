#!/usr/bin/env bash
# Record a short Trim demo on DISPLAY :99 (Xvfb). Requires: npm install, xdotool, ffmpeg (system or PATH).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cursor / CI often sets DISPLAY to the host display; this script targets Xvfb on :99.
export DISPLAY="${TRIM_DEMO_DISPLAY:-:99}"

VIDEO="${1:-/tmp/test_video.mp4}"
OUT="${2:-/tmp/trim_demo.mp4}"
DURATION="${3:-35}"

if ! pgrep -f "Xvfb :99" >/dev/null 2>&1; then
  echo "Start Xvfb first, e.g.: Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &"
  exit 1
fi

if [[ ! -f "$VIDEO" ]]; then
  echo "Missing video: $VIDEO"
  exit 1
fi

npm run build:electron --silent

cleanup() {
  kill "${VITE_PID:-0}" "${ELEC_PID:-0}" 2>/dev/null || true
}
trap cleanup EXIT

npx vite --port 5173 >/tmp/trim-demo-vite.log 2>&1 &
VITE_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:5173/" >/dev/null; then
    break
  fi
  sleep 0.25
done

VITE_DEV_SERVER_URL="http://localhost:5173" npx electron . "$VIDEO" >/tmp/trim-demo-electron.log 2>&1 &
ELEC_PID=$!

WIN=""
for _ in $(seq 1 90); do
  # Avoid --onlyvisible: Electron on Xvfb is often not marked visible to xdotool.
  WIN="$(xdotool search --name 'Trim' 2>/dev/null | head -1 || true)"
  if [[ -z "$WIN" ]]; then
    WIN="$(xdotool search --class 'Electron' 2>/dev/null | head -1 || true)"
  fi
  if [[ -z "$WIN" ]]; then
    WIN="$(xdotool search --name 'localhost' 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$WIN" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -n "$WIN" ]]; then
  xdotool windowactivate --sync "$WIN" 2>/dev/null || true
  xdotool windowmove --sync "$WIN" 0 0 2>/dev/null || true
  # Let React, video decode, and first paint finish
  sleep 5
else
  echo "Warning: no Electron window found for xdotool; recording without scripted keys" >&2
  sleep 12
fi

FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
if ! command -v "$FFMPEG_BIN" >/dev/null 2>&1; then
  FFMPEG_BIN="$(node -e "console.log(require('ffmpeg-static'))")"
fi

"$FFMPEG_BIN" -y -f x11grab -video_size 1280x800 -framerate 20 -t "$DURATION" -i "${DISPLAY}.0" \
  -c:v libx264 -preset fast -pix_fmt yuv420p "$OUT" &
FF_PID=$!

run_demo_keys() {
  sleep 2
  xdotool key --window "$WIN" space || xdotool key space
  sleep 2
  xdotool key --window "$WIN" space || xdotool key space
  sleep 1
  xdotool key --window "$WIN" Shift+slash || xdotool key Shift+slash
  sleep 2.5
  # Close cheatsheet with ? again — Escape also closes the video (see useKeyboardShortcuts)
  xdotool key --window "$WIN" Shift+slash || xdotool key Shift+slash
  sleep 1
  xdotool key --window "$WIN" Right Right Right || xdotool key Right Right Right
  sleep 0.8
  xdotool key --window "$WIN" bracketleft || xdotool key bracketleft
  sleep 0.8
  xdotool key --window "$WIN" Right Right || xdotool key Right Right
  sleep 0.8
  xdotool key --window "$WIN" bracketright || xdotool key bracketright
  sleep 1
  xdotool key --window "$WIN" i || xdotool key i
  sleep 2
  xdotool key --window "$WIN" i || xdotool key i
  sleep 1
  xdotool key --window "$WIN" Home || xdotool key Home
  sleep 1
  xdotool key --window "$WIN" End || xdotool key End
  sleep 2
}

if [[ -n "$WIN" ]]; then
  run_demo_keys &
else
  echo "Warning: no window id for xdotool; recording without scripted keys" >&2
fi

wait "$FF_PID"
echo "Wrote $OUT"
