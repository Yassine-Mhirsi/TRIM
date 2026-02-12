# TRIM

Windows desktop app for trimming videos with FFmpeg.

## Development

- Install dependencies: `npm ci`
- Run app in development: `npm run dev`
- Build production bundles: `npm run build`
- Build Windows installer: `npm run dist`

## GitHub Release (.exe download)

This repo includes a workflow at `.github/workflows/release.yml` that:

1. Runs when you push a git tag that starts with `v` (example: `v0.1.0`)
2. Builds the Windows NSIS installer (`.exe`)
3. Uploads release artifacts to the GitHub Releases page

### Release steps

1. Ensure `package.json` version matches your intended release (example: `0.1.1`)
2. Commit and push your changes
3. Create and push a tag:
   - `git tag v0.1.1`
   - `git push origin v0.1.1`
4. Open GitHub Actions and wait for `Build and Release Windows` to finish
5. Download the installer from the new GitHub Release
