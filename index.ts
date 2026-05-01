import express from 'express';
import fs from 'fs';
import path from 'path';

import type { LaplacePlugin, PluginRuntimeContext } from './plugin-api.ts';

export default class WebUiPlugin implements LaplacePlugin {
  public onLoad(ctx: PluginRuntimeContext) {
    const uiRoot = path.join(ctx.pluginRoot, 'dist', 'ui');
    const indexPath = path.join(uiRoot, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(
        `WebUI build missing at ${uiRoot}. Run 'npm run build' inside the plugin directory first.`
      );
    }

    ctx.logger(`Serving WebUI from ${uiRoot}`);

    ctx.registerCommand('webui', 'Manage WebUI settings (webui port <number>)', async (args) => {
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
      ctx.tui.log('Usage: webui port <number>', '\x1b[33m');
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

  public onUnload() {}
}
