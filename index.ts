import express from 'express';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import type { LaplacePlugin, PluginRuntimeContext } from './plugin-api.ts';

type CachedTranspile = {
  mtime: number;
  content: string;
};

export default class WebUiPlugin implements LaplacePlugin {
  private transpileCache = new Map<string, CachedTranspile>();

  public onLoad(ctx: PluginRuntimeContext) {
    const uiRoot = path.join(ctx.pluginRoot, 'ui');
    const indexPath = path.join(uiRoot, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(`UI assets missing: ${indexPath}`);
    }

    ctx.logger(`Initializing WebUI from ${uiRoot}`);

    ctx.registerCommand('webui', 'Manage Web UI settings', async (args) => {
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

      if (sub === 'clear-cache') {
        this.transpileCache.clear();
        ctx.tui.log('WebUI transpile cache cleared.', '\x1b[32m');
        return;
      }

      ctx.tui.log('Usage: webui port <number> | webui clear-cache', '\x1b[33m');
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

    router.get(/\.(tsx|ts)$/, (req, res, next) => {
      const safePath = this.resolveUiPath(uiRoot, req.path);
      if (!safePath) {
        res.status(403).send('Access denied');
        return;
      }
      if (!fs.existsSync(safePath)) {
        next();
        return;
      }

      try {
        const stats = fs.statSync(safePath);
        const cached = this.transpileCache.get(safePath);
        if (cached && cached.mtime === stats.mtimeMs) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('X-Laplace-Cache', 'HIT');
          res.send(cached.content);
          return;
        }

        const source = fs.readFileSync(safePath, 'utf-8');
        const result = ts.transpileModule(source, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2020,
            jsx: ts.JsxEmit.React,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            removeComments: true,
          },
        });

        this.transpileCache.set(safePath, { mtime: stats.mtimeMs, content: result.outputText });
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('X-Laplace-Cache', 'MISS');
        res.send(result.outputText);
      } catch (e: any) {
        ctx.logger(`Transpile failed for ${req.path}: ${e.message}`, 'error');
        res.status(500).send(`Transpile error: ${e.message}`);
      }
    });

    router.use(express.static(uiRoot, { index: false, maxAge: '1h' }));

    const serveSpa = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      if (path.extname(req.path)) {
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

  private resolveUiPath(uiRoot: string, requestPath: string): string | null {
    const normalized = requestPath.replace(/^\/+/, '');
    const resolved = path.resolve(uiRoot, normalized);
    const relative = path.relative(uiRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }
    return resolved;
  }

  public onUnload() {
    this.transpileCache.clear();
  }
}
