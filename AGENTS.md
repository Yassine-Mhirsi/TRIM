# AGENTS.md

## Cursor Cloud specific instructions

**Trim** is an Electron + React + TypeScript video trimming desktop app. Despite being Windows-targeted for distribution, it runs fine in dev mode on Linux.

### Key commands

See `package.json` scripts and `README.md` for full reference. Summary:

- `npm run dev` — builds Electron TS then starts Vite + Electron concurrently
- `npm run typecheck` — TypeScript check (renderer + electron)
- `npm run build` — typecheck + build renderer + build electron
- `npm run lint` — ESLint (currently broken: ESLint v9 is installed but no `eslint.config.js` exists; the `--ext` flag is v8-only)

### Running Electron on headless Linux

Electron requires a display server. Start Xvfb before launching:

```bash
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &
export DISPLAY=:99
```

Then run `npm run dev` or launch Electron manually. Expect harmless dbus, ALSA, and WebGL stderr warnings in headless environments — they do not affect functionality.

### Opening a video in dev mode

The app accepts a video file path as a CLI argument:

```bash
DISPLAY=:99 VITE_DEV_SERVER_URL=http://localhost:5173 npx electron . /path/to/video.mp4
```

Or start with `npm run dev` and use the "Open Video" button. DevTools open automatically in dev mode (`!app.isPackaged`).

### FFmpeg in dev mode

`ffmpeg-static` and `ffprobe-static` npm packages provide platform-appropriate binaries. No system ffmpeg install needed. The packaged-app code paths look for `.exe` but the dev fallback resolves Linux binaries correctly.

### No automated tests

`npm test` only echoes a placeholder message. There are no unit or integration tests in this codebase.
