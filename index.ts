import express from 'express';
import fs from 'fs';
import path from 'path';

import type { LaplacePlugin, PluginRuntimeContext } from './plugin-api.ts';
import { WebuiExtensionRegistry } from './extension-registry.ts';
import type { WebuiExtensionFactory, WebuiExtensionsManifest } from './extension-api.ts';

const TOKEN_CSS_FILENAME = 'tokens.css';
const TOKEN_CSS_FALLBACK = `:root {
  --color-canvas: #faf9f5;
  --color-surface-soft: #f5f0e8;
  --color-surface-card: #efe9de;
  --color-surface-strong: #e8e0d2;
  --color-surface-dark: #181715;
  --color-hairline: #e6dfd8;
  --color-ink: #141413;
  --color-body: #3d3d3a;
  --color-muted: #6c6a64;
  --color-on-primary: #ffffff;
  --color-on-dark: #faf9f5;
  --color-primary: #d21f5b;
  --color-primary-active: #a71948;
  --color-accent-sage: #7ba098;
  --color-accent-ochre: #b8862e;
  --color-success: #5c8a5e;
  --color-warning: #b8862e;
  --color-error: #9b2c2c;
}
body { background: var(--color-canvas); color: var(--color-body); font-family: 'Inter', system-ui, sans-serif; }
`;

export default class WebUiPlugin implements LaplacePlugin {
  private extensionRegistry: WebuiExtensionRegistry | null = null;

  public onLoad(ctx: PluginRuntimeContext) {
    const uiRoot = path.join(ctx.pluginRoot, 'dist', 'ui');
    const indexPath = path.join(uiRoot, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(
        `WebUI build missing at ${uiRoot}. Run 'npm run build' inside the plugin directory first.`
      );
    }

    ctx.logger(`Serving WebUI from ${uiRoot}`);

    const registry = new WebuiExtensionRegistry((msg, type) => ctx.logger(msg, type));
    this.extensionRegistry = registry;

    // Publish the extension API on the cross-plugin service bus as a factory.
    // Consumers call factory(theirPluginId) to get a WebuiExtensionApi that
    // auto-stamps every registration with their pluginId. Pairs nicely with a
    // declared 'webui' prerequisite — the dependent plugin can do this
    // synchronously in onLoad() because the topological loader runs us first.
    const factory: WebuiExtensionFactory = (pluginId: string) => registry.scopedFor(pluginId);
    ctx.services.register<WebuiExtensionFactory>('webui:extensions', factory);

    ctx.registerCommand('webui', 'Manage WebUI settings (webui port <number> | webui ext list)', async (args) => {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'port') {
        const rawPort = Number.parseInt(args[1] || '', 10);
        if (!Number.isInteger(rawPort) || rawPort < 1024 || rawPort > 65535) {
          ctx.tui.log('Invalid port. Usage: webui port <1024-65535>', '\x1b[31m');
          return;
        }
        await ctx.updateConfig((config) => {
          config.panelPort = rawPort;
          return config;
        });
        ctx.tui.log(`WebUI port set to ${rawPort}. Restart required.`, '\x1b[32m');
        return;
      }
      if (sub === 'ext' || sub === 'extensions') {
        const snap = registry.snapshot();
        ctx.tui.log(`WebUI extensions (rev=${snap.revision})`);
        ctx.tui.log(`  Sections: ${snap.sections.length}`);
        for (const s of snap.sections) {
          ctx.tui.log(`    - ${s.id}  [${s.group}]  ${s.label}  -> ${s.iframeUrl}`);
        }
        ctx.tui.log(`  Tiles: ${snap.tiles.length}`);
        for (const t of snap.tiles) {
          ctx.tui.log(`    - ${t.id}  [${t.placement}]  ${t.label}  (${t.kind})`);
        }
        ctx.tui.log(`  Stylesheets: ${snap.stylesheets.length}`);
        for (const s of snap.stylesheets) {
          ctx.tui.log(`    - ${s.id}  [${s.role || 'preset'}]  ${s.url}`);
        }
        return;
      }
      ctx.tui.log('Usage: webui port <number> | webui ext list', '\x1b[33m');
    });

    const cfg = ctx.getConfig();
    const port = cfg.panelPort || 11228;
    const adminUser = ctx.users.getUsers().find((user: any) => user.role === 'admin');
    if (adminUser?.token) {
      const token = encodeURIComponent(adminUser.token);
      ctx.addHeaderInfo('Admin Panel', `http://localhost:${port}/dashboard#token=${token}`);
    } else {
      ctx.addHeaderInfo('Admin Panel', `http://localhost:${port}/dashboard`);
    }

    const router = ctx.createRouter();

    // Serve the design tokens. Other plugins' iframes can `<link rel="stylesheet"
    // href="/api/webui/tokens.css">` to inherit Raspberry's color/font palette.
    router.get('/api/webui/tokens.css', (_req: express.Request, res: express.Response) => {
      const tokens = path.join(ctx.pluginRoot, 'tokens.css');
      res.set('Cache-Control', 'public, max-age=300');
      if (fs.existsSync(tokens)) {
        res.type('text/css').sendFile(tokens);
        return;
      }
      res.type('text/css').send(TOKEN_CSS_FALLBACK);
    });

    // Live extension manifest. The frontend polls this to pick up new
    // sections/tiles/stylesheets registered by other plugins.
    router.get('/api/webui/extensions', (_req: express.Request, res: express.Response) => {
      const snapshot: WebuiExtensionsManifest = registry.snapshot();
      res.json({ success: true, data: snapshot });
    });

    router.use(express.static(uiRoot, { index: false, maxAge: '1h' }));

    const serveSpa = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api') || path.extname(req.path)) {
        next();
        return;
      }
      res.sendFile(indexPath);
    };

    router.get('/', serveSpa);
    router.get(/^\/dashboard(?:\/.*)?$/, serveSpa);
    router.get(/^\/(?!api\/).*$/, serveSpa);

    ctx.mountRouter('/', router);
  }

  public onUnload(ctx: PluginRuntimeContext) {
    ctx.services.unregister('webui:extensions');
    this.extensionRegistry = null;
  }
}
