# AGENTS.md — TRIM

## Project Overview

TRIM is a Windows desktop app for trimming videos, built with Electron + React + FFmpeg. Users select a portion of a video via a timeline with drag handles and either save it as a new file or overwrite the original.

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 7
- **Desktop:** Electron 40, electron-builder 26, electron-updater 6 (NSIS installer with auto-updates)
- **Video:** FFmpeg/FFprobe via fluent-ffmpeg (bundled as static binaries)

## Project Structure

```
electron/              → Electron main process (main.ts, preload.ts)
src/main/              → Main process services (ffmpegService.ts, recentFiles.ts, windowState.ts)
src/main/types/        → Type declarations (ffprobe-static.d.ts)
src/renderer/          → React UI (App.tsx, main.tsx, styles.css)
src/renderer/components/ → Timeline, VideoPlayer, PlaybackControls, SpeedControl, VolumeControl, ShortcutsOverlay
src/renderer/hooks/    → useVideoPlayer, useKeyboardShortcuts, useTimelineDrag, useTimelineThumbnail
src/renderer/utils/    → Helpers (math.ts, time.ts)
src/renderer/types/    → Renderer type declarations
build/                 → Installer scripts (NSIS)
scripts/               → Utility scripts (context menu registration)
assets/                → App icon
.github/workflows/     → CI/CD (release.yml)
```

## Commands

```bash
npm run dev          # Start dev mode (Vite + Electron concurrently)
npm run build        # Typecheck + build renderer + build Electron
npm run dist         # Build Windows NSIS installer (.exe)
npm run lint         # ESLint on TS/TSX files
npm run typecheck    # TypeScript check without emit
npm run release:patch  # Bump patch, push, push tags
npm run release:minor  # Bump minor, push, push tags
npm run release:major  # Bump major, push, push tags
```

## Architecture

- **IPC pattern:** Main ↔ Renderer communication via `contextBridge` (preload.ts exposes `window.trimApi`)
- **Key IPC channels:** `trim:probe`, `trim:start`, `trim:overwrite`, `trim:suggest-output-path`, `trim:progress:${jobId}`, `dialog:save-as`, `dialog:open-video`, `app:get-initial-file`, `app:file-opened`, `recent-files:get`, `recent-files:add`, `updater:update-available`, `updater:download-progress`, `updater:update-downloaded`, `updater:check`, `updater:download`, `updater:install`, `frame:save-png`
- **Auto-updates:** electron-updater checks GitHub Releases on startup (3s delay), user-initiated download, auto-installs on quit
- **Three trim modes:** "smart" (default — tries copy first, falls back to reencode), "copy" (fast stream copy), "reencode" (libx264/aac re-encode)
- **Overwrite strategy:** temp file → rename with retry (exponential backoff, up to 8 attempts) → fallback to copy-based swap → backup original → recovery on failure
- **Supported formats:** MP4, MOV, MKV, WebM, AVI, M4V
- **Recent files:** Up to 10 recent files persisted as JSON in userData, displayed in empty state, auto-cleaned (removes non-existent files)
- **Window state persistence:** Window bounds (position and size) saved to JSON in userData, restored on launch with validation (ensures window is visible on connected displays, 640x480 minimum)

## TypeScript Config

- Three tsconfig files: `tsconfig.base.json` (shared strict settings), `tsconfig.renderer.json` (ESNext + React JSX + DOM), `tsconfig.electron.json` (NodeNext → dist-electron/)
- Strict mode enabled, no unused variables/parameters

## Key Files

- `electron/main.ts` — Electron app entry, window management, IPC handlers, auto-updater setup
- `electron/preload.ts` — Secure IPC bridge (`window.trimApi`)
- `src/main/services/ffmpegService.ts` — FFmpeg trim operations, probing, progress parsing
- `src/main/services/recentFiles.ts` — Recent files persistence service (JSON store in userData, max 10 files)
- `src/main/services/windowState.ts` — Window bounds persistence service (JSON store in userData, validates saved position is on connected display)
- `src/renderer/App.tsx` — Main React component (video player, controls, actions, update banner, recent files UI)
- `src/renderer/components/Timeline.tsx` — Drag-handle timeline for trim boundaries with thumbnail preview on hover
- `src/renderer/components/VideoPlayer.tsx` — Video element with click-to-play overlay
- `src/renderer/components/PlaybackControls.tsx` — Play/pause and playback UI
- `src/renderer/components/SpeedControl.tsx` — Variable playback speed (0.25x–16x)
- `src/renderer/components/VolumeControl.tsx` — Volume slider and mute toggle
- `src/renderer/components/ShortcutsOverlay.tsx` — Keyboard shortcuts cheatsheet overlay (toggleable with `?`)
- `src/renderer/hooks/useVideoPlayer.ts` — Video state management hook
- `src/renderer/hooks/useKeyboardShortcuts.ts` — Keyboard shortcut bindings
- `src/renderer/hooks/useTimelineDrag.ts` — Drag interaction logic for timeline handles
- `src/renderer/hooks/useTimelineThumbnail.ts` — Timeline hover thumbnail: manages a hidden video element + canvas to generate frame previews on mousemove, with debounced seeking and a pending-seek queue

## Keyboard Shortcuts

- `Space` — Play/pause toggle
- `Left Arrow` — Step backward 1 frame (auto-pauses)
- `Right Arrow` — Step forward 1 frame (auto-pauses)
- `[` — Set trim start to current time
- `]` — Set trim end to current time
- `Home` — Jump to trim start
- `End` — Jump to trim end
- `S` — Save current frame as PNG
- `I` — Toggle video info overlay (shows resolution and frame rate)
- `Escape` — Close video and return to empty state (closes shortcuts overlay first if open)
- `?` — Toggle keyboard shortcuts cheatsheet

## Roadmap

See [FEATURES.md](./FEATURES.md) for planned feature ideas and their status.

## Conventions

- Dark theme UI (background `#0f1222`, accent `#657cff`)
- Hidden titlebar with custom overlay (titlebar color `#0f1222`, symbol color `#8891b3`)
- Single instance lock — prevents multiple app windows
- Output naming: `{name}_trimmed{ext}` with auto-numbering for conflicts
- Context menu integration via Windows registry (`HKCU\Software\Classes\SystemFileAssociations`)
- Releases triggered by Git tags (`v*`) via GitHub Actions → NSIS installer uploaded to GitHub Releases

## Doc Maintenance

After any significant code change (new features, new IPC channels, new dependencies, renamed/deleted files, architecture changes), **always run the `docs-sync-checker` subagent** to audit AGENTS.md and README.md for gaps. This ensures documentation stays in sync with the codebase across conversations.
