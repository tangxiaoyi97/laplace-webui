// @ts-nocheck
import express from 'express';
import path from 'path';
import fs from 'fs';
import ts from 'typescript';
import { fileURLToPath } from 'url';
// Corrected import path: from backend/plugins/webui to root types.ts is ../../../types.ts
import type { LaplacePlugin, LaplaceContext } from '../../../types.ts';

export default class WebUiPlugin implements LaplacePlugin {
    // Use a getter to guarantee property existence at runtime regardless of initialization order
    public get metadata() {
        return {
            name: 'Laplace WebUI',
            version: '3.1.0',
            author: 'Laplace Systems',
            description: 'Official React-based frontend.'
        };
    }

    // Cache compiled JavaScript: Key = filePath, Value = { mtime: number, content: string }
    private cache = new Map<string, { mtime: number, content: string }>();

    public onLoad(ctx: LaplaceContext) {
        const { app, logger, tui, config, saveConfig, users } = ctx;
        
        // Locate UI Root
        const __filename = fileURLToPath(import.meta.url);
        const pluginDir = path.dirname(__filename);
        const uiRoot = path.join(pluginDir, 'ui');

        logger(`[WebUI] Initializing Frontend Module from: ${uiRoot}`);

        if (!fs.existsSync(uiRoot)) {
            logger('[WebUI] CRITICAL: UI Assets directory not found! WebUI will not function.', 'error');
            return;
        }

        // TUI Command
        tui.registerCommand('webui', 'Manage Web Interface settings', async (args) => {
            if (args[0] === 'port') {
                const port = parseInt(args[1]);
                if (isNaN(port) || port < 1024 || port > 65535) {
                    tui.log('Invalid port. Usage: webui port <1024-65535>', '\x1b[31m');
                    return;
                }
                config.panelPort = port;
                saveConfig(config);
                tui.log(`WebUI port set to ${port}. Restart application to apply.`, '\x1b[32m');
            } else if (args[0] === 'clear-cache') {
                this.cache.clear();
                tui.log('WebUI compilation cache cleared.', '\x1b[32m');
            } else {
                tui.log('Usage: webui port <number> | webui clear-cache', '\x1b[33m');
            }
        });

        // Header Info
        const port = config.panelPort || 11228;
        const adminUser = users.getUsers().find((u: any) => u.role === 'admin');
        const token = adminUser ? adminUser.token : 'UNKNOWN';
        tui.addHeaderInfo('Admin Panel', `http://localhost:${port}/dashboard?token=${token}`);

        // OPTIMIZED TSX Compilation with Caching
        app.get(/\.(tsx|ts)$/, (req: any, res: any, next: any) => {
            if (req.path.startsWith('/api')) return next();

            const filePath = path.join(uiRoot, req.path);
            
            // Security: Prevent breaking out of uiRoot
            if (!filePath.startsWith(uiRoot)) {
                return res.status(403).send('Access Denied');
            }
            
            if (!fs.existsSync(filePath)) {
                return next();
            }

            try {
                const stats = fs.statSync(filePath);
                const cached = this.cache.get(filePath);

                // Serve from cache if file hasn't changed
                if (cached && cached.mtime === stats.mtimeMs) {
                    res.setHeader('Content-Type', 'application/javascript');
                    res.setHeader('X-Cache', 'HIT');
                    return res.send(cached.content);
                }

                // Compile
                const source = fs.readFileSync(filePath, 'utf-8');
                const result = ts.transpileModule(source, { 
                    compilerOptions: { 
                        module: ts.ModuleKind.ESNext, 
                        target: ts.ScriptTarget.ES2020, 
                        jsx: ts.JsxEmit.React, 
                        moduleResolution: ts.ModuleResolutionKind.NodeJs,
                        esModuleInterop: true,
                        removeComments: true // Optimization
                    } 
                });

                // Update Cache
                this.cache.set(filePath, { mtime: stats.mtimeMs, content: result.outputText });

                res.setHeader('Content-Type', 'application/javascript');
                res.setHeader('X-Cache', 'MISS');
                res.send(result.outputText);

            } catch (e: any) {
                console.error(`Transpilation error for ${req.path}:`, e.message);
                res.status(500).send(`Transpilation Error: ${e.message}`);
            }
        });

        // Static Files
        app.use(express.static(uiRoot));

        // SPA Catch-all
        const serveIndex = (req: any, res: any) => {
             const indexHtml = path.join(uiRoot, 'index.html');
             if (fs.existsSync(indexHtml)) {
                 res.sendFile(indexHtml);
             } else {
                 res.status(404).send('WebUI Error: index.html missing in plugin directory');
             }
        };

        app.get('/dashboard', serveIndex);
        app.get('*', (req: any, res: any, next: any) => {
            if (req.path.startsWith('/api') || req.path.includes('.')) return next();
            serveIndex(req, res);
        });
    }
}