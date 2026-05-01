# extension-example

Reference plugin demonstrating the WebUI extension API end-to-end:

- **1 section** — full sidebar entry rendered as an iframe
- **2 tiles** — a stat tile + an embedded live-clock iframe
- **1 stylesheet** — preset CSS injected into the WebUI's `<head>`

It also serves as a worked example of the new manifest features:

- Declares `webui` as a **required** prerequisite — the loader will refuse
  to run this plugin if the WebUI plugin isn't installed and loaded.
- Uses `ctx.services.get('webui:extensions')` synchronously in `onLoad()` —
  thanks to the prereq, load order is guaranteed and the listener pattern
  isn't needed.

## Try it locally

```bash
# 1. Symlink (or copy) into your local laplace-core's external plugins dir.
ln -s "$(pwd)/laplace-webui/examples/extension-example" \
      "$(pwd)/laplace-core/laplace_data/plugins/extension-example"

# 2. Restart laplace-core. Look for the new sidebar entry "Extension demo"
#    and "Plugin tiles" in the WebUI.
```

Or, if you want it as a builtin (always loaded with the host):

```bash
ln -s "$(pwd)/laplace-webui/examples/extension-example" \
      "$(pwd)/laplace-core/backend/plugins/extension-example"
```

## What's where

| File | Role |
|---|---|
| `laplace.plugin.json` | Manifest. Declares `webui` as a `required` prereq. |
| `index.ts` | Entry. Mounts static files, calls the webui factory, registers section + tiles + stylesheet. |
| `static/demo.html` | The section's iframe content — uses `tokens.css` to look native. |
| `static/tile.html` | The live-clock tile iframe. |
| `static/preset.css` | The injected stylesheet. |

## See also

- [`laplace-webui/WEBUI_EXTENSIONS.md`](../../WEBUI_EXTENSIONS.md) — full reference for the extension API
- [`laplace-core/PLUGIN_DEVELOPMENT.md`](../../../laplace-core/PLUGIN_DEVELOPMENT.md) — generic plugin development guide
