/**
 * Front-end consumer of the webui extension manifest. Polls
 * /api/webui/extensions every POLL_MS so newly loaded plugins are picked up
 * without a full page refresh, and reconciles registered stylesheets into the
 * document <head>.
 */

import { fetchAuthed } from './api.ts';

export type SidebarGroup = 'overview' | 'operations' | 'snapshots' | 'configuration' | 'plugin';

export interface SectionRegistration {
    id: string;
    label: string;
    group?: SidebarGroup;
    icon?: string;
    order?: number;
    iframeUrl: string;
    height?: number;
    serverScoped?: boolean;
    pluginId?: string;
}

export interface TileRegistration {
    id: string;
    label: string;
    placement?: 'plugins-overview' | 'dashboard-aside';
    order?: number;
    kind: 'stat' | 'iframe';
    value?: string;
    hint?: string;
    iframeUrl?: string;
    height?: number;
    href?: string;
    icon?: string;
    pluginId?: string;
}

export interface StylesheetRegistration {
    id: string;
    url: string;
    role?: 'preset' | 'override';
    pluginId?: string;
}

export interface ExtensionsManifest {
    sections: SectionRegistration[];
    tiles: TileRegistration[];
    stylesheets: StylesheetRegistration[];
    revision: number;
}

const EMPTY: ExtensionsManifest = { sections: [], tiles: [], stylesheets: [], revision: 0 };
const STYLE_TAG_PREFIX = 'data-webui-ext-';
const POLL_MS = 30_000;

export async function fetchExtensions(): Promise<ExtensionsManifest> {
    try {
        const res = await fetchAuthed('/webui/extensions');
        if (!res.ok) return EMPTY;
        const json = await res.json();
        if (json?.success && json?.data) {
            return {
                sections: Array.isArray(json.data.sections) ? json.data.sections : [],
                tiles: Array.isArray(json.data.tiles) ? json.data.tiles : [],
                stylesheets: Array.isArray(json.data.stylesheets) ? json.data.stylesheets : [],
                revision: typeof json.data.revision === 'number' ? json.data.revision : 0,
            };
        }
    } catch { /* ignore */ }
    return EMPTY;
}

/**
 * Reconcile the currently injected stylesheet `<link>` tags with the manifest.
 * Idempotent: stylesheets whose id+url+role haven't changed are left in place.
 * Override stylesheets are appended last so their CSS wins via cascade order.
 */
export function applyStylesheets(stylesheets: StylesheetRegistration[]): void {
    const wanted = new Map<string, StylesheetRegistration>();
    for (const s of stylesheets) wanted.set(s.id, s);

    // Remove ones that are gone or have changed
    const existing = document.head.querySelectorAll<HTMLLinkElement>(`link[${STYLE_TAG_PREFIX}id]`);
    existing.forEach((link) => {
        const id = link.getAttribute(`${STYLE_TAG_PREFIX}id`) || '';
        const next = wanted.get(id);
        const currentUrl = link.getAttribute('href') || '';
        const currentRole = link.getAttribute(`${STYLE_TAG_PREFIX}role`) || 'preset';
        if (!next || next.url !== currentUrl || (next.role || 'preset') !== currentRole) {
            link.parentNode?.removeChild(link);
        }
    });

    // Add missing ones, preset first, override last (cascade order matters).
    const presets = stylesheets.filter((s) => s.role !== 'override');
    const overrides = stylesheets.filter((s) => s.role === 'override');
    for (const sheet of [...presets, ...overrides]) {
        const stillThere = document.head.querySelector(`link[${STYLE_TAG_PREFIX}id="${cssEscape(sheet.id)}"]`);
        if (stillThere) continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.url;
        link.setAttribute(`${STYLE_TAG_PREFIX}id`, sheet.id);
        link.setAttribute(`${STYLE_TAG_PREFIX}role`, sheet.role || 'preset');
        if (sheet.pluginId) link.setAttribute(`${STYLE_TAG_PREFIX}plugin`, sheet.pluginId);
        document.head.appendChild(link);
    }
}

function cssEscape(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/**
 * Subscribe to extension manifest updates. Calls `onUpdate` whenever the
 * revision changes. Returns a stop function.
 */
export function subscribeExtensions(onUpdate: (m: ExtensionsManifest) => void): () => void {
    let lastRevision = -1;
    let stopped = false;
    const tick = async () => {
        if (stopped) return;
        const next = await fetchExtensions();
        if (!stopped && next.revision !== lastRevision) {
            lastRevision = next.revision;
            onUpdate(next);
        }
    };
    void tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
        stopped = true;
        clearInterval(interval);
    };
}
