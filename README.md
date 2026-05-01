# Laplace WebUI

`laplace-webui` is the official WebUI plugin for `laplace-core`.

This repository is intentionally separate from the core runtime:
- `laplace-core` contains the backend, TUI, and plugin runtime
- `laplace-webui` contains only the WebUI plugin (built into a self-contained bundle)

## Install (end-user)

Inside the `laplace-core` TUI:

```
plugin install webui
```

That's it. Restart `laplace-core` and the WebUI is live. The installer fetches the latest release zip from GitHub and extracts it into `laplace_data/plugins/webui/`.

Manual drop-in is also supported: grab the release zip from the [Releases page](https://github.com/tangxiaoyi97/laplace-webui/releases) and unzip it into `laplace_data/plugins/webui/`.

## Released layout

```text
laplace_data/plugins/webui/
  laplace.plugin.json
  dist/
    index.js          # bundled plugin entry (esbuild)
    ui/               # bundled React frontend (Vite)
      index.html
      assets/...
```

The plugin folder is fully self-contained — no `npm install`, no source files, no build step required at the install site.

## Develop

```bash
git clone -b feature https://github.com/tangxiaoyi97/laplace-webui.git
cd laplace-webui
npm install
npm run build
```

Symlink the built directory into `laplace-core/laplace_data/plugins/webui` (or place it there directly), then start `laplace-core` in standard mode.

For iterative UI development, run `npm run build:ui -- --watch` to rebuild the frontend on save.

### Build outputs

- `npm run build:ui`    → Vite builds `ui/` into `dist/ui/`
- `npm run build:plugin` → esbuild bundles `index.ts` into `dist/index.js`
- `npm run build`       → both

## Release

Tagged pushes (`v*`) trigger `.github/workflows/release.yml`, which builds and publishes a `laplace-webui-<tag>.zip` to the GitHub Releases page. That zip is what `plugin install webui` downloads.

## Compatibility

- Plugin ID: `webui`
- Plugin API version: `1.0.0`
- Expected host: `laplace-core` plugin runtime v4

## Features

- Dashboard and console
- File manager
- Player management
- Backups
- Server settings and setup wizard
- Public status page

## Notes

- Authentication uses `Authorization: Bearer <token>` against the core API.
- WebSocket authentication uses `Sec-WebSocket-Protocol`.
- This repository should not contain `laplace-core` source files.
