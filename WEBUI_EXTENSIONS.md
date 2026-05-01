# Extending the laplace WebUI

How to make a `laplace-core` plugin contribute UI to the WebUI panel —
sidebar sections, dashboard tiles, custom stylesheets — using the public
extension API exposed by the WebUI plugin.

This is an addendum to
[`laplace-core/PLUGIN_DEVELOPMENT.md`](../laplace-core/PLUGIN_DEVELOPMENT.md).
Read that first if you haven't built a laplace plugin before.

---

## Mental model

```
┌─────────────────────┐     services.get('webui:extensions')      ┌────────────────────┐
│  your plugin        │ ───────────────────────────────────────▶  │  webui plugin      │
│                     │                                            │  (registry)        │
│  registerSection    │                                            │  manifest +        │
│  registerTile       │                                            │  /api/webui/...    │
│  registerStylesheet │                                            └─────────┬──────────┘
└─────────────────────┘                                                      │
                                                                             ▼
                                                              ┌──────────────────────────┐
                                                              │  WebUI React shell       │
                                                              │  fetches manifest,       │
                                                              │  renders sections in     │
                                                              │  iframes, injects CSS.   │
                                                              └──────────────────────────┘
```

Three primitives:
- **Section** — a full sidebar entry with its own page, rendered as a
  sandboxed iframe pointing at a URL your plugin serves.
- **Tile** — a small card on the WebUI's "Plugin tiles" page. Either a
  static stat (label / value / hint) or a tiny embedded iframe.
- **Stylesheet** — a `<link rel="stylesheet">` injected into the WebUI's
  `<head>`. Use it to either match the existing palette (`role: 'preset'`)
  or override rules (`role: 'override'`).

Your plugin can register any number of each.

---

## Quick start

### 1. Declare the prerequisite

In `laplace.plugin.json`:

```jsonc
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "apiVersion": "1.0.0",
  "entry": "index.ts",
  "capabilities": { "httpRoutes": true, "staticAssets": true },
  "prerequisites": [
    { "id": "webui", "level": "required" }
  ]
}
```

`required` means: the host refuses to install your plugin if the WebUI isn't
installed (the user is prompted to also install it). At runtime, it
guarantees the WebUI plugin loads first.

If you can degrade gracefully without UI, use `"level": "recommended"`
instead and use `services.listen()` (see "Optional integration" below).

### 2. Register your stuff in `onLoad`

```ts
import path from 'path';
import { fileURLToPath } from 'url';
import type { LaplacePlugin, PluginRuntimeContext } from '../../../types.ts';

type WebuiFactory = (pluginId: string) => {
    registerSection(reg: any): () => void;
    registerTile(reg: any): () => void;
    registerStylesheet(reg: any): () => void;
};

export default class MyPlugin implements LaplacePlugin {
    private dispose: Array<() => void> = [];

    public async onLoad(ctx: PluginRuntimeContext) {
        const here = path.dirname(fileURLToPath(import.meta.url));
        ctx.mountStatic('/api/my-plugin', path.join(here, 'static'), { maxAge: 60_000 });

        // Required prereq → guaranteed to be present here.
        const factory = ctx.services.get<WebuiFactory>('webui:extensions');
        if (!factory) {
            ctx.logger('webui:extensions missing — manifest prereq is wrong?', 'error');
            return;
        }
        const ui = factory(ctx.pluginId);

        this.dispose.push(ui.registerSection({
            id: `${ctx.pluginId}:home`,
            label: 'My Plugin',
            iframeUrl: '/api/my-plugin/home.html',
        }));

        this.dispose.push(ui.registerTile({
            id: `${ctx.pluginId}:online`,
            label: 'Players online',
            kind: 'stat',
            value: '17',
            hint: 'last poll',
        }));
    }

    public async onUnload() {
        for (const fn of this.dispose) {
            try { fn(); } catch { /* ignore */ }
        }
        this.dispose = [];
    }
}
```

That's it. After restart your section appears in the sidebar's **Plugins**
group, your tile appears on the **Plugin tiles** page. The WebUI polls the
manifest every 30 seconds, so updated values picked up without needing to
refresh the browser.

---

## The factory pattern

The `webui:extensions` service is a factory:

```ts
type WebuiExtensionFactory = (pluginId: string) => WebuiExtensionApi;
```

You call it once with your own `ctx.pluginId` to get an API that
auto-stamps every registration with your id. That's why every example uses:

```ts
const ui = factory(ctx.pluginId);
ui.registerSection({ ... });   // pluginId is filled in for you
```

You can call `factory()` multiple times with different ids if you really
need to (e.g. a plugin that multiplexes), but typically you call it once.

### Returned `WebuiExtensionApi` surface

```ts
interface WebuiExtensionApi {
    registerSection(reg: SectionRegistration):     () => void;
    registerTile(reg: TileRegistration):           () => void;
    registerStylesheet(reg: StylesheetRegistration): () => void;
    snapshot(): WebuiExtensionsManifest;            // diagnostics
}
```

Each `register*` returns an unregister function. **Save them and call them
in `onUnload`** — otherwise stale registrations linger across plugin
reloads.

---

## Sections

A section is a full sidebar entry that opens its own page (rendered as an
iframe).

```ts
interface SectionRegistration {
    id: string;                   // e.g. `${pluginId}:metrics`
    label: string;                // displayed in the sidebar
    group?: SidebarGroup;         // 'overview' | 'operations' | 'snapshots' |
                                  // 'configuration' | 'plugin'  (default: 'plugin')
    icon?: string;                // lucide icon name; falls back to Box. See
                                  // "Available icons" below.
    order?: number;               // sidebar sort order within the group (default 200;
                                  // built-ins use 10..90)
    iframeUrl: string;            // same-origin path or http(s) URL
    height?: number;              // pixels (default 720; clamped 120..2400)
    serverScoped?: boolean;       // append ?serverId=<focused> to the iframe URL
}
```

### Validation rules

The registry rejects anything that doesn't pass:

| Field | Rule |
|---|---|
| `id` | `/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/` — colons are allowed for namespacing |
| `iframeUrl` | Same-origin path (`/api/...`) or absolute http(s); 1–2048 chars |
| `height` | clamped to `[120, 2400]` |

Invalid registrations throw synchronously — bad URLs / ids surface in your
plugin's logs, not silently in production.

### Server-scoped sections

If your section's content depends on which Minecraft server is focused
(e.g. per-server metrics), set `serverScoped: true`. The WebUI appends
`?serverId=<currently-focused-server-id>` to the iframe URL each time the
user changes the picker. Inside your iframe:

```html
<script>
  const params = new URLSearchParams(window.location.search);
  const serverId = params.get('serverId');
  // fetch /api/my-plugin/data?serverId=...
</script>
```

If no server is focused, the WebUI shows a polite "pick a server" placeholder
instead of loading your iframe.

### Sidebar groups

Sections you register go into the **`plugin`** group by default. You can
override with `group:` to slot into one of the built-in groups
(`overview`, `operations`, `snapshots`, `configuration`) — useful when your
extension is a first-class part of an existing flow rather than a side
feature.

---

## Tiles

```ts
interface TileRegistration {
    id: string;
    label: string;
    placement?: 'plugins-overview' | 'dashboard-aside';   // default 'plugins-overview'
    order?: number;
    kind: 'stat' | 'iframe';

    // for kind: 'stat'
    value?: string;             // big text (top of card)
    hint?: string;              // small text underneath
    href?: string;              // makes the whole tile clickable (opens new tab)

    // for kind: 'iframe'
    iframeUrl?: string;         // small embedded page
    height?: number;            // pixels (default 140; clamped 60..800)

    icon?: string;
}
```

Two flavors:

### Stat tile

```ts
ui.registerTile({
    id: `${ctx.pluginId}:players`,
    label: 'Players online',
    kind: 'stat',
    value: '17',
    hint: 'across 3 servers',
    href: '/api/my-plugin/details.html',   // optional click-through
});
```

Static text. Update by re-calling `registerTile` with the same `id` — the
registry replaces the entry and the WebUI picks up the change on its next
30-second poll.

### Iframe tile

```ts
ui.registerTile({
    id: `${ctx.pluginId}:clock`,
    label: 'Live clock',
    kind: 'iframe',
    iframeUrl: '/api/my-plugin/clock.html',
    height: 140,
});
```

For tiles that need their own update loop (live data, animations) — your
iframe handles polling internally, the WebUI is just hosting it.

### Placement

- **`'plugins-overview'`** (default) — the **Plugin tiles** page in the
  sidebar's Plugins group. Fits 2–3 tiles per row at typical widths.
- **`'dashboard-aside'`** — currently the same target rendering-wise, but
  reserved for future dashboard-side rail integration. Use this if your tile
  is operationally interesting at-a-glance.

---

## Stylesheets

```ts
ui.registerStylesheet({
    id: `${ctx.pluginId}:skin`,
    url: '/api/my-plugin/skin.css',
    role: 'preset' | 'override',
});
```

The WebUI injects a `<link rel="stylesheet" href="...">` into `<head>`.
Both roles are functionally identical at the cascade level today — both go
in `<head>` — but the WebUI puts `'preset'` ones first and `'override'`
ones last so cascade order matches intent. Use:

- **`'preset'`** when you want to *add* utility classes / tokens for your
  plugin's iframes to opt into. Doesn't override webui rules.
- **`'override'`** when you want to *replace* webui styles (e.g. theme
  swap). Goes after webui CSS so your selectors win.

### Reconciliation is idempotent

The WebUI's stylesheet injector diffs the manifest against current
`<link>` tags every poll cycle:
- Stylesheets whose `id+url+role` are unchanged are left alone.
- Removed registrations are stripped.
- Added ones are appended.

This means **don't append your CSS yourself** — register it and let the
WebUI manage it. Otherwise your tags survive plugin reload and pile up.

---

## The tokens.css

The WebUI plugin serves its design tokens at:

```
GET /api/webui/tokens.css
```

It exposes:

- Every CSS variable used by the bundled WebUI: `--color-canvas`,
  `--color-primary`, `--color-ink`, `--color-surface-card`, `--color-error`,
  `--font-sans`, `--font-mono`, etc.
- Convenience component classes: `.r-card`, `.r-card-cream`,
  `.r-card-card`, `.r-card-dark`, `.r-eyebrow`, `.r-display`, `.r-button`,
  `.r-button-secondary`, `.r-mono`.

**Use it inside your iframes** so they look native:

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="/api/webui/tokens.css">
    <style>
      body { padding: 32px; }
      .stat { font-size: 36px; color: var(--color-ink); letter-spacing: -0.6px; }
    </style>
  </head>
  <body>
    <div class="r-eyebrow">Plugin · my-plugin</div>
    <h1 class="r-display" style="font-size: 32px;">Hello.</h1>
    <button class="r-button">Primary action</button>
    <button class="r-button r-button-secondary">Secondary</button>
  </body>
</html>
```

The stylesheet is cache-controlled `max-age=300`. If you need to override a
specific token in your iframe, just redefine the variable on `:root` after
the link tag.

---

## Iframe content best practices

The WebUI mounts plugin sections with this sandbox:

```html
<iframe
  src="..."
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
  referrerpolicy="same-origin"
  loading="lazy"
/>
```

Tiles get a tighter sandbox (`allow-same-origin allow-scripts allow-forms`).

**You CAN** in iframes:
- Run scripts (event handlers, fetch, intervals).
- Share localStorage with the parent (same-origin).
- Make authenticated requests using the user's session — the cookie is sent
  automatically. Read `Authorization: Bearer <token>` if you need it
  (the parent stores it under `localStorage['laplace_token']`).

**You SHOULD NOT** in iframes:
- Try to navigate the parent (`top.location = ...`) — the WebUI's frame
  won't break out.
- Assume your iframe always has a `serverId` query param. Default gracefully.
- Hold long-lived WebSockets in tiles. Tiles re-render whenever the manifest
  changes; use them for short-lived UI.

### Talking to your backend from an iframe

Your iframe is same-origin with the host, so:

```js
const token = localStorage.getItem('laplace_token');
fetch('/api/my-plugin/data', { headers: { Authorization: `Bearer ${token}` } })
  .then(r => r.json())
  .then(...);
```

Or just rely on cookie auth if you've set up cookies in your routes. Either
works.

---

## Available icons

Plugin sections can specify any of the following lucide-react icon names.
Anything not in the list falls back to `Box`:

```
LayoutDashboard, LogOut, Terminal, XCircle, CheckCircle, AlertCircle, ChevronRight,
ChevronDown, Plus, ServerCog, FolderOpen, Users, FileText, Archive, CalendarClock,
Settings, Server, Puzzle, Box, BarChart, BarChart2, BarChart3, Bell, Bookmark,
Calendar, Clock, Cloud, Code, Cpu, Database, Download, Edit, Eye, Filter, Flag,
Gauge, Gift, Globe, Hash, Heart, Home, Image, Info, Key, Layers, Layout, Link,
List, Lock, Mail, MapPin, Menu, MessageSquare, Mic, Monitor, Moon, Music, Package,
PenTool, Phone, PieChart, Play, Power, Radio, Rocket, RotateCw, Save, Search, Send,
Share, Shield, ShoppingCart, Slash, Smile, Star, Sun, Tag, Target, Trash2, TrendingUp,
Upload, User, Video, Wifi, Wrench, Zap
```

The list is intentionally bounded — adding all of lucide-react would
double the WebUI bundle size. PR more if you need them; a one-line
addition to `ui/App.tsx` is all it takes.

---

## Optional integration (recommended-prereq pattern)

If your plugin can do useful work without UI, declare the WebUI as
`recommended` instead of `required` and use `listen` so missing-WebUI
doesn't crash you:

```jsonc
"prerequisites": [
  { "id": "webui", "level": "recommended" }
]
```

```ts
public async onLoad(ctx: PluginRuntimeContext) {
    // Always run the core work
    setInterval(() => this.tick(), 60_000);

    // If WebUI is around, also surface tiles. If not, no-op.
    ctx.services.listen('webui:extensions', (factory: any) => {
        const ui = factory(ctx.pluginId);
        this.dispose.push(ui.registerTile({ ... }));
    });
}
```

`listen` fires immediately if the service is already there, otherwise the
moment someone (re)registers it. The WebUI plugin only registers once at
load — but listen is the correct primitive for "may or may not be present"
integrations.

---

## Lifecycle and cleanup

Every `register*` call returns an unregister function. **Always save and
invoke them in `onUnload`** — the WebUI plugin doesn't garbage-collect
registrations from plugins that disappear. Stale registrations would mean
a section that 404s when clicked.

```ts
private dispose: Array<() => void> = [];

public async onLoad(ctx: PluginRuntimeContext) {
    this.dispose.push(ui.registerSection({ ... }));
    this.dispose.push(ui.registerTile({ ... }));
    this.dispose.push(ui.registerStylesheet({ ... }));
}

public async onUnload() {
    for (const fn of this.dispose) {
        try { fn(); } catch { /* ignore */ }
    }
    this.dispose = [];
}
```

---

## Worked example

The repo ships
[`examples/extension-example/`](./examples/extension-example/)
as a reference. It registers:

- One section (`Extension demo`, opens an iframe at
  `/api/extension-example/demo.html`)
- Two tiles (a stat tile + a live-updating clock iframe)
- One preset stylesheet (`/api/extension-example/preset.css`)

The plugin's manifest declares `webui` as a required prerequisite, so the
loader ensures the WebUI plugin is up before our `onLoad` runs.

Read the example's `index.ts` end to end — it's the canonical shape and
shorter than any docstring.

---

## TUI introspection

Once a plugin has registered extensions, you can verify from the TUI:

```
> webui ext list

WebUI extensions (rev=4)
  Sections: 1
    - extension-example:demo  [plugin]  Extension demo  -> /api/extension-example/demo.html
  Tiles: 2
    - extension-example:headline  [plugins-overview]  Plugins live  (stat)
    - extension-example:embed     [plugins-overview]  Embedded tile  (iframe)
  Stylesheets: 1
    - extension-example:preset  [preset]  /api/extension-example/preset.css
```

If a plugin's registrations *don't* show up here:

1. Check `plugin list` — is the plugin loaded?
2. If loaded but no registrations: check the plugin's logs in the TUI for
   "webui:extensions missing" or validation errors.
3. If everything looks fine: hard-refresh the WebUI page (the manifest is
   polled but the SPA caches it briefly).

---

## REST contract (for advanced users)

The WebUI exposes:

| Endpoint | Purpose |
|---|---|
| `GET /api/webui/extensions` | The full manifest as JSON. The WebUI polls this every 30s. |
| `GET /api/webui/tokens.css` | Design tokens stylesheet for plugin iframes. Cached 5 min. |

Both are auth-gated. You don't typically call them directly from a plugin —
the WebUI does. They're documented here in case you want to inspect or
build alternative consumers.

The manifest shape:

```ts
interface WebuiExtensionsManifest {
    sections: SectionRegistration[];
    tiles: TileRegistration[];
    stylesheets: StylesheetRegistration[];
    revision: number;          // bumps on every change; use as cache key
}
```

---

## Common mistakes

- **Forgetting the prerequisite.** Without `"webui": "required"` declared,
  load order is alphabetical, and `services.get('webui:extensions')` may
  return `null` because the WebUI plugin loads after yours.
- **Not namespacing ids.** A bare `"id": "metrics"` collides with anyone
  else's. Always prefix: `${ctx.pluginId}:metrics`.
- **Returning the unregister fn from `register*` and not calling it.**
  Stale registrations linger.
- **Hardcoding `pluginId`** in registrations instead of letting the factory
  do it. The factory's auto-stamping is the whole point — use it.
- **Iframe at a non-same-origin URL.** The validator allows http(s)
  cross-origin URLs, but cookies/localStorage/`Authorization` won't be
  shared and most realistic plugin functionality breaks. Prefer
  same-origin paths served from your plugin's `mountStatic` or
  `mountRouter`.
- **Trying to render a React component instead of an iframe.** The WebUI is
  a pre-bundled SPA — code from your plugin can't share its React
  context. Iframes are the right boundary for cross-plugin UI.
