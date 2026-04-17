# Laplace WebUI

`laplace-webui` is the official WebUI plugin for `laplace-core`.

This repository is intentionally separate from the core runtime:
- `laplace-core` contains the backend, TUI, and plugin runtime
- `laplace-webui` contains only the WebUI plugin

## Install

Clone this repository directly into the external plugin directory used by `laplace-core`:

```bash
git clone --branch feature --single-branch https://github.com/tangxiaoyi97/laplace-webui.git laplace_data/plugins/webui
```

Required runtime layout after install:

```text
laplace_data/plugins/webui/
  laplace.plugin.json
  index.ts
  plugin-api.ts
  ui/
```

## Start Flow

`webui` does not run as a separate process.

To use it:
1. Install this repository into `laplace_data/plugins/webui`
2. Start `laplace-core` in standard mode: `npm run start`

If you start `laplace-core` in clean mode (`npm run start:clean`), `webui` will not be loaded.

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
