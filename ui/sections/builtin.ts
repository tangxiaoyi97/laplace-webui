import Dashboard from '../components/Dashboard.tsx';
import ServersOverview from '../components/ServersOverview.tsx';
import ServerWizard from '../components/ServerWizard.tsx';
import FileManager from '../components/FileManager.tsx';
import PlayerManager from '../components/PlayerManager.tsx';
import LogsView from '../components/LogsView.tsx';
import BackupManager from '../components/BackupManager.tsx';
import BackupSchedule from '../components/BackupSchedule.tsx';
import ServerSettings from '../components/ServerSettings.tsx';
import { ViewState } from '../types.ts';
import type { SectionDescriptor, SectionProps } from './types.ts';
import React from 'react';

/**
 * Adapter: bridges the old per-component prop shape (notify, currentServerId,
 * currentServer, refreshServers, optional onNavigate/onViewChange) to the
 * unified SectionProps. Lets us modularize without touching every view.
 */
function wrap<P extends Record<string, any>>(Component: React.ComponentType<P>, extra?: (p: SectionProps) => Partial<P>) {
    return function WrappedSection(props: SectionProps) {
        const passthrough = (extra ? extra(props) : {}) as Partial<P>;
        const merged = {
            notify: props.notify,
            currentServerId: props.currentServerId,
            currentServer: props.currentServer,
            servers: props.servers,
            refreshServers: props.refreshServers,
            ...passthrough,
        } as unknown as P;
        return React.createElement(Component, merged);
    };
}

export const BUILTIN_SECTIONS: SectionDescriptor[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        group: 'overview',
        icon: 'LayoutDashboard',
        order: 10,
        scope: 'global',
        component: wrap(Dashboard, (p) => ({
            onNavigate: (v: any) => p.setView(v),
        })),
    },
    {
        id: 'servers',
        label: 'All servers',
        group: 'overview',
        icon: 'ServerCog',
        order: 20,
        scope: 'global',
        component: wrap(ServersOverview, (p) => ({
            servers: p.servers,
            defaultServerId: p.defaultServerId,
            onSelect: async (id: string) => {
                await p.switchServer(id);
                p.setView('files');
            },
            onCreateNew: () => p.setView(ViewState.SERVER_WIZARD),
            onDeleted: async (deletedId: string) => p.handleServerDeleted(deletedId),
        })),
    },
    {
        id: 'files',
        label: 'Files',
        group: 'operations',
        icon: 'FolderOpen',
        order: 10,
        scope: 'server',
        component: wrap(FileManager),
    },
    {
        id: 'players',
        label: 'Players',
        group: 'operations',
        icon: 'Users',
        order: 20,
        scope: 'server',
        component: wrap(PlayerManager),
    },
    {
        id: 'logs',
        label: 'Logs',
        group: 'operations',
        icon: 'FileText',
        order: 30,
        scope: 'server',
        component: wrap(LogsView),
    },
    {
        id: 'backups',
        label: 'Backups',
        group: 'snapshots',
        icon: 'Archive',
        order: 10,
        scope: 'server',
        component: wrap(BackupManager),
    },
    {
        id: 'backup-schedule',
        label: 'Schedule',
        group: 'snapshots',
        icon: 'CalendarClock',
        order: 20,
        scope: 'server',
        component: wrap(BackupSchedule),
    },
    {
        id: 'settings',
        label: 'Server settings',
        group: 'configuration',
        icon: 'Settings',
        order: 10,
        scope: 'server',
        component: wrap(ServerSettings),
    },
    {
        id: 'server-wizard',
        label: 'Add new server',
        group: 'configuration',
        icon: 'Server',
        order: 20,
        scope: 'global',
        component: wrap(ServerWizard, (p) => ({
            onViewChange: (v: any) => p.setView(v),
        })),
    },
];
