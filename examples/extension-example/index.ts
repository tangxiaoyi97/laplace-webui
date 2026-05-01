import path from 'path';
import { fileURLToPath } from 'url';
import type { LaplacePlugin, PluginRuntimeContext } from '../../plugin-api.ts';
import type { WebuiExtensionFactory } from '../../extension-api.ts';

/**
 * Extension Example — minimal reference for the webui extension API.
 *
 * Lives in `laplace-webui/examples/` because it's purely a demo of the webui
 * extension contract — laplace-core has no dependency on it. To try it
 * locally, copy or symlink this directory into your
 * `laplace_data/plugins/extension-example/` and restart laplace-core.
 *
 * Because this plugin lists `webui` as a 'required' prerequisite in its
 * manifest, the laplace plugin loader runs the WebUI plugin BEFORE us. That
 * lets us call `services.get(...)` synchronously in onLoad — no listener
 * pattern, no load-order races.
 *
 * Three integration points are demonstrated:
 *   1. registerSection — full sidebar entry rendered as an iframe.
 *   2. registerTile    — small card on the Plugins overview page.
 *   3. registerStylesheet — `<link>` injected into the webui's <head>.
 *
 * Files served from /static/ inside this plugin's dir are exposed at
 * /api/extension-example/* via the mountStatic call below.
 */

export default class ExtensionExamplePlugin implements LaplacePlugin {
    private dispose: Array<() => void> = [];

    public async onLoad(ctx: PluginRuntimeContext) {
        const here = path.dirname(fileURLToPath(import.meta.url));
        ctx.mountStatic('/api/extension-example', path.join(here, 'static'), { maxAge: 60_000 });

        // The 'required' prereq guarantees webui has registered before us.
        // Anything else here would be a manifest bug.
        const factory = ctx.services.get<WebuiExtensionFactory>('webui:extensions');
        if (!factory) {
            ctx.logger('webui:extensions service is missing — manifest prereq is wrong?', 'error');
            return;
        }
        const ui = factory(ctx.pluginId);

        this.dispose.push(ui.registerSection({
            id: `${ctx.pluginId}:demo`,
            label: 'Extension demo',
            group: 'plugin',
            icon: 'Puzzle',
            order: 50,
            iframeUrl: '/api/extension-example/demo.html',
            height: 480,
        }));

        this.dispose.push(ui.registerTile({
            id: `${ctx.pluginId}:headline`,
            label: 'Plugins live',
            kind: 'stat',
            value: '3',
            hint: 'Sections, tiles, and stylesheets registered',
            icon: 'Puzzle',
        }));

        this.dispose.push(ui.registerTile({
            id: `${ctx.pluginId}:embed`,
            label: 'Embedded tile',
            kind: 'iframe',
            iframeUrl: '/api/extension-example/tile.html',
            height: 140,
        }));

        this.dispose.push(ui.registerStylesheet({
            id: `${ctx.pluginId}:preset`,
            url: '/api/extension-example/preset.css',
            role: 'preset',
        }));

        ctx.logger('Extension Example registered: 1 section, 2 tiles, 1 stylesheet.');
    }

    public async onUnload() {
        for (const fn of this.dispose) {
            try { fn(); } catch { /* ignore */ }
        }
        this.dispose = [];
    }
}
