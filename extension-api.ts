/**
 * Public extension contract for the laplace WebUI.
 *
 * Other plugins consume the WebUI extension API through the cross-plugin
 * service bus published by laplace-core:
 *
 *   ctx.services.listen<WebuiExtensionApi>('webui:extensions', (webui) => {
 *     webui.registerSection({ ... });
 *     webui.registerTile({ ... });
 *     webui.registerStylesheet('/api/myplugin/skin.css');
 *   });
 *
 * Sections, tiles and stylesheets registered this way are returned to the
 * frontend via `GET /api/webui/extensions` and merged into the runtime UI
 * registry on the next page load (the frontend also polls every 30s so newly
 * loaded plugins are picked up without a refresh).
 *
 * Design philosophy: cross-plugin UI is delivered as URLs. Sections embed via
 * iframes, tiles can either be static text or iframes, and stylesheets are
 * `<link rel="stylesheet">` injected into the host document. This keeps the
 * webui bundle self-contained while letting plugins ship arbitrary UI in any
 * stack — they just need to serve HTML/CSS over HTTP.
 *
 * To produce iframe contents that match the Raspberry style, plugins can pull
 * the design tokens from `GET /api/webui/tokens.css` (served by the webui
 * plugin). It exposes the same CSS variables (--color-canvas, --color-primary,
 * etc.) the bundled views use.
 */

export type SidebarGroup = 'overview' | 'operations' | 'snapshots' | 'configuration' | 'plugin';

export interface SectionRegistration {
    /** Stable identifier, namespaced by plugin. e.g. 'myplugin:metrics'. */
    id: string;
    /** Visible label in the sidebar. */
    label: string;
    /** Sidebar group bucket. Plugin sections default to 'plugin'. */
    group?: SidebarGroup;
    /** Lucide icon name (string). The webui will fall back to a default icon if unknown. */
    icon?: string;
    /** Sort order within the group (ascending). Built-ins occupy 0..100. */
    order?: number;
    /** URL the iframe loads. Must be same-origin. */
    iframeUrl: string;
    /** Optional preferred iframe height in px. Default is 100% (full page). */
    height?: number;
    /** Whether the section needs a focused server. If true, iframe URL gets ?serverId= appended. */
    serverScoped?: boolean;
    /** Plugin id, set by the webui plugin when accepting the registration. */
    pluginId?: string;
}

export type TilePlacement = 'plugins-overview' | 'dashboard-aside';

export interface TileRegistration {
    id: string;
    label: string;
    placement?: TilePlacement;
    order?: number;
    /** Either a static value or an iframe. Choose one. */
    kind: 'stat' | 'iframe';
    /** stat: short string shown big. */
    value?: string;
    /** stat: small description under the value. */
    hint?: string;
    /** iframe: source URL. */
    iframeUrl?: string;
    /** iframe: pixel height. Default 140. */
    height?: number;
    /** Optional click-through URL (stat kind only). */
    href?: string;
    /** Lucide icon name. */
    icon?: string;
    pluginId?: string;
}

export interface StylesheetRegistration {
    id: string;
    /** URL of the stylesheet served by the plugin. */
    url: string;
    /**
     * 'preset' = appended after webui styles, used to slot into existing tokens.
     * 'override' = appended at end of <head>, intended to override webui rules.
     * Functionally identical for now (both go in <head>); separate semantics so
     * the webui can future-proof load order without breaking plugins.
     */
    role?: 'preset' | 'override';
    pluginId?: string;
}

export interface WebuiExtensionsManifest {
    sections: SectionRegistration[];
    tiles: TileRegistration[];
    stylesheets: StylesheetRegistration[];
    /** Monotonic counter; bumped any time a registration changes. */
    revision: number;
}

export interface WebuiExtensionApi {
    /** Register a full sidebar section backed by an iframe. Returns an unregister fn. */
    registerSection(section: SectionRegistration): () => void;
    /** Register a small tile (stat or iframe). Returns an unregister fn. */
    registerTile(tile: TileRegistration): () => void;
    /** Inject a stylesheet into the webui's <head>. Returns an unregister fn. */
    registerStylesheet(stylesheet: StylesheetRegistration): () => void;
    /** Snapshot of the current registry. Mainly for diagnostics. */
    snapshot(): WebuiExtensionsManifest;
}

/**
 * Service published by the WebUI plugin on `services.register('webui:extensions', factory)`.
 *
 * Consumers call it with their own plugin id to get a WebuiExtensionApi
 * pre-bound to that namespace; every registration made through the returned
 * api is automatically attributed to the plugin.
 *
 * Recommended usage with a declared prerequisite (the WebUI plugin must be a
 * 'required' prereq in the consumer's manifest, so the load order is
 * guaranteed):
 *
 *   const factory = ctx.services.get<WebuiExtensionFactory>('webui:extensions')!;
 *   const ui = factory(ctx.pluginId);
 *   ui.registerSection({ ... });
 *
 * If the consumer prefers not to depend on load order at all, they can use
 * `ctx.services.listen('webui:extensions', factory => ...)` instead.
 */
export type WebuiExtensionFactory = (pluginId: string) => WebuiExtensionApi;
