# Trim

A fast, minimal Windows desktop app for trimming videos. Select a portion of any video with a visual timeline, then save it as a new file or overwrite the original.

Built with Electron, React, and FFmpeg.

## Screenshots

![Trim app](assets/Screenshot.png)

Right-click any video in Windows Explorer to open it directly in Trim:

![Right-click context menu](assets/Screenshot2.png)

## Features

- **Visual timeline** with draggable handles to set trim start and end points
- **Three trim modes** — smart (tries fast copy first, falls back to re-encode), stream copy, or full re-encode
- **Overwrite or Save As** — replace the original file or export to a new one
- **Variable playback speed** from 0.25x to 16x
- **Volume control** with mute toggle
- **Keyboard shortcuts** for efficient editing
- **Right-click integration** — open videos directly from Windows Explorer
- **Supports** MP4, MOV, MKV, WebM, AVI, and M4V

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Left Arrow` | Seek backward 5s |
| `Right Arrow` | Seek forward 5s |
| `Shift + Left Arrow` | Seek backward 1s |
| `Shift + Right Arrow` | Seek forward 1s |
| `[` | Set trim start to current time |
| `]` | Set trim end to current time |
| `Home` | Jump to trim start |
| `End` | Jump to trim end |

## Installation

Download the latest installer from the [Releases](https://github.com/Yassine-Mhirsi/TRIM/releases) page and run the `.exe` setup.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/Yassine-Mhirsi/TRIM.git
cd TRIM
npm install
```

### Commands

```bash
npm run dev          # Start dev mode (Vite + Electron)
npm run build        # Typecheck + build renderer + build Electron
npm run dist         # Build Windows NSIS installer (.exe)
npm run lint         # ESLint
npm run typecheck    # TypeScript check without emit
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Desktop:** Electron, electron-builder (NSIS installer)
- **Video:** FFmpeg / FFprobe via fluent-ffmpeg (bundled as static binaries)

## License

MIT
