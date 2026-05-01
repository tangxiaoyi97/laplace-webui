import type React from 'react';
import type { ServerSummary, ViewState } from '../types.ts';

/**
 * Descriptor for a single sidebar section.
 *
 * Built-in sections are imported statically from `./registry.ts`. Plugin
 * sections come from `GET /api/webui/extensions` and are rendered as iframes
 * via `PluginSection.tsx`.
 */
export interface SectionProps {
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
    currentServer: ServerSummary | null;
    servers: ServerSummary[];
    defaultServerId: string | null;
    refreshServers: () => Promise<void>;
    switchServer: (id: string) => Promise<void>;
    handleServerDeleted: (deletedId: string) => Promise<void>;
    setView: (view: ViewState | string) => void;
}

export type SidebarGroup = 'overview' | 'operations' | 'snapshots' | 'configuration' | 'plugin';

export interface SectionDescriptor {
    id: string;
    label: string;
    group: SidebarGroup;
    /** Lucide icon name (string). The shell renders the icon by lookup. */
    icon: string;
    /** Sort order within the group. Built-ins use 10..90. */
    order: number;
    /**
     * Display rule: 'global' = always available; 'server' = greyed out when
     * no server is selected; 'no-servers' = visible only when zero servers.
     */
    scope: 'global' | 'server' | 'no-servers';
    /** Built-in section render function. Plugin sections supply iframe metadata instead. */
    component?: React.ComponentType<SectionProps>;
    /** Plugin sections only — iframe URL the section embeds. */
    iframeUrl?: string;
    /** Plugin sections only — preferred iframe height. */
    iframeHeight?: number;
    /** Plugin sections only — append ?serverId= to iframe URL. */
    serverScoped?: boolean;
    /** Plugin sections only — pluginId for namespacing. */
    pluginId?: string;
}
