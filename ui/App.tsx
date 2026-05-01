import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, LogOut, Terminal, XCircle, CheckCircle, AlertCircle, ChevronRight,
    ChevronDown, Plus, ServerCog, FolderOpen, Users, FileText, Archive, CalendarClock,
    Settings, Server, Puzzle, Box, BarChart, BarChart2, BarChart3, Bell, Bookmark,
    Calendar, Clock, Cloud, Code, Cpu, Database, Download, Edit, Eye, Filter, Flag,
    Gauge, Gift, Globe, Hash, Heart, Home, Image, Info, Key, Layers, Layout, Link as LinkIcon,
    List, Lock, Mail, MapPin, Menu, MessageSquare, Mic, Monitor, Moon, Music, Package,
    PenTool, Phone, PieChart, Play, Power, Radio, Rocket, RotateCw, Save, Search, Send,
    Share, Shield, ShoppingCart, Slash, Smile, Star, Sun, Tag, Target, Trash2, TrendingUp,
    Upload, User, Video, Wifi, Wrench, Zap,
} from 'lucide-react';

// Known icons: anything a plugin can name. If a plugin requests an icon not in
// this set, the shell falls back to Box. Adding entries is the right way to
// extend the palette — a wildcard `import * as Lucide` would defeat tree
// shaking and bloat the bundle by ~700kb.
const ICON_REGISTRY: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    LayoutDashboard, LogOut, Terminal, XCircle, CheckCircle, AlertCircle, ChevronRight,
    ChevronDown, Plus, ServerCog, FolderOpen, Users, FileText, Archive, CalendarClock,
    Settings, Server, Puzzle, Box, BarChart, BarChart2, BarChart3, Bell, Bookmark,
    Calendar, Clock, Cloud, Code, Cpu, Database, Download, Edit, Eye, Filter, Flag,
    Gauge, Gift, Globe, Hash, Heart, Home, Image, Info, Key, Layers, Layout, Link: LinkIcon,
    List, Lock, Mail, MapPin, Menu, MessageSquare, Mic, Monitor, Moon, Music, Package,
    PenTool, Phone, PieChart, Play, Power, Radio, Rocket, RotateCw, Save, Search, Send,
    Share, Shield, ShoppingCart, Slash, Smile, Star, Sun, Tag, Target, Trash2, TrendingUp,
    Upload, User, Video, Wifi, Wrench, Zap,
};
import PublicHome from './components/PublicHome.tsx';
import { ViewState } from './types.ts';
import type { ServerSummary } from './types.ts';
import {
    checkToken, clearStoredToken, fetchAuthed, getStoredToken,
    normalizeTokenInput, postScoped, setStoredToken,
} from './lib/api.ts';
import { Button, Card, Eyebrow } from './components/primitives.tsx';
import { BUILTIN_SECTIONS } from './sections/builtin.ts';
import { PluginSection } from './sections/PluginSection.tsx';
import { PluginsOverview } from './sections/PluginsOverview.tsx';
import type { SectionDescriptor, SidebarGroup, SectionProps } from './sections/types.ts';
import { applyStylesheets, subscribeExtensions, type ExtensionsManifest, type SectionRegistration } from './lib/extensions.ts';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

/** Normalize legacy ViewState constants ('DASHBOARD') to section ids ('dashboard'). */
function normalizeView(view: string): string {
    const map: Record<string, string> = {
        DASHBOARD: 'dashboard',
        SERVERS_OVERVIEW: 'servers',
        SERVER_WIZARD: 'server-wizard',
        FILES: 'files',
        PLAYERS: 'players',
        LOGS: 'logs',
        SETTINGS: 'settings',
        BACKUPS: 'backups',
        BACKUP_SCHEDULE: 'backup-schedule',
    };
    return map[view] || view;
}

const GROUP_ORDER: SidebarGroup[] = ['overview', 'operations', 'snapshots', 'configuration', 'plugin'];
const GROUP_LABEL: Record<SidebarGroup, string> = {
    overview: 'Overview',
    operations: 'Operations',
    snapshots: 'Snapshots',
    configuration: 'Configuration',
    plugin: 'Plugins',
};

function resolveLucideIcon(name: string | undefined): React.ComponentType<{ size?: number; className?: string }> {
    if (!name) return Box;
    return ICON_REGISTRY[name] || Box;
}

export default function App() {
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    useEffect(() => {
        const handlePopState = () => setCurrentPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    if (currentPath === '/' || currentPath === '/index') return <PublicHome />;
    if (currentPath.startsWith('/dashboard')) return <AdminPanel />;
    return <PublicHome />;
}

function AdminPanel() {
    const [view, setViewRaw] = useState<string>('dashboard');
    const setView = useCallback((next: string) => setViewRaw(normalizeView(next)), []);
    const [auth, setAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [servers, setServers] = useState<ServerSummary[]>([]);
    const [serversLoaded, setServersLoaded] = useState(false);
    const [currentServerId, setCurrentServerId] = useState<string | null>(null);
    const [defaultServerId, setDefaultServerId] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [panelVersion, setPanelVersion] = useState<string | null>(null);
    const [gitCommit, setGitCommit] = useState<string | null>(null);
    const [extensions, setExtensions] = useState<ExtensionsManifest>({ sections: [], tiles: [], stylesheets: [], revision: 0 });
    const pickerRef = React.useRef<HTMLDivElement>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [verifying, setVerifying] = useState(false);

    const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    useEffect(() => {
        const urlToken = (() => {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            return hashParams.get('token');
        })();
        const fromUrl = urlToken ? normalizeTokenInput(urlToken) : '';
        if (fromUrl) {
            setStoredToken(fromUrl);
            window.history.replaceState({}, '', '/dashboard');
        }
        const stored = getStoredToken();
        if (!stored) { setLoading(false); return; }
        checkToken(stored)
            .then((result) => {
                if (result.ok) setAuth(true);
                else clearStoredToken();
            })
            .finally(() => setLoading(false));
    }, []);

    // Server inventory polling
    useEffect(() => {
        if (!auth) return;
        let cancelled = false;
        const refresh = async () => {
            try {
                const res = await fetchAuthed('/servers');
                if (!res.ok) return;
                const json = await res.json();
                if (cancelled || !json.success) return;
                const list: ServerSummary[] = json.data.servers || [];
                setServers(list);
                setServersLoaded(true);
                setDefaultServerId(json.data.activeServer ?? null);
                setCurrentServerId((prev) => {
                    if (prev && list.some((s) => s.id === prev)) return prev;
                    if (json.data.activeServer && list.some((s) => s.id === json.data.activeServer)) return json.data.activeServer;
                    return list[0]?.id ?? null;
                });
            } catch { /* network blip */ }
        };
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [auth]);

    // Build/version banner
    useEffect(() => {
        if (!auth) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/health');
                if (!res.ok) return;
                const json = await res.json();
                if (cancelled) return;
                if (typeof json?.panelVersion === 'string') setPanelVersion(json.panelVersion);
                if (typeof json?.gitCommit === 'string' || json?.gitCommit === null) setGitCommit(json.gitCommit);
            } catch { /* not fatal */ }
        })();
        return () => { cancelled = true; };
    }, [auth]);

    // Plugin extensions: subscribe + apply stylesheets
    useEffect(() => {
        if (!auth) return;
        const stop = subscribeExtensions((manifest) => {
            setExtensions(manifest);
            applyStylesheets(manifest.stylesheets);
        });
        return () => {
            stop();
            // Strip injected stylesheets on logout/unmount.
            applyStylesheets([]);
        };
    }, [auth]);

    // Picker click-outside / Esc handling
    useEffect(() => {
        if (!pickerOpen) return;
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
        };
        const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', escHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', escHandler);
        };
    }, [pickerOpen]);

    const cleanupAuth = () => {
        clearStoredToken();
        setAuth(false);
        setTokenInput('');
        setTokenError('');
    };

    const handleTokenSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (verifying) return;
        const cleaned = normalizeTokenInput(tokenInput);
        if (!cleaned) { setTokenError('Token is required.'); return; }
        setVerifying(true);
        setTokenError('');
        const result = await checkToken(cleaned);
        setVerifying(false);
        if (result.ok) {
            setStoredToken(cleaned);
            setAuth(true);
            setTokenInput('');
        } else {
            setTokenError(result.message);
        }
    };

    const handleLogout = () => {
        cleanupAuth();
        window.location.href = '/';
    };

    const switchServer = useCallback(async (id: string) => {
        if (!servers.some((s) => s.id === id)) {
            notify('That server is no longer configured.', 'error');
            return;
        }
        setCurrentServerId(id);
        setPickerOpen(false);
        try {
            await postScoped('/servers/select', null, { serverId: id });
            setDefaultServerId(id);
        } catch { /* non-fatal */ }
    }, [notify, servers]);

    const refreshServers = useCallback(async () => {
        try {
            const res = await fetchAuthed('/servers');
            const json = await res.json();
            if (json.success) {
                const list: ServerSummary[] = json.data.servers || [];
                setServers(list);
                setServersLoaded(true);
                setDefaultServerId(json.data.activeServer ?? null);
                setCurrentServerId((prev) => {
                    if (prev && list.some((s) => s.id === prev)) return prev;
                    if (json.data.activeServer && list.some((s) => s.id === json.data.activeServer)) return json.data.activeServer;
                    return list[0]?.id ?? null;
                });
            }
        } catch { /* ignore */ }
    }, []);

    const handleServerDeleted = useCallback(async (deletedId: string) => {
        setCurrentServerId((prev) => (prev === deletedId ? null : prev));
        await refreshServers();
    }, [refreshServers]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[color:var(--color-canvas)]">
                <div className="w-6 h-6 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
            </div>
        );
    }

    if (!auth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[color:var(--color-canvas)] px-4">
                <div className="w-full max-w-[440px]">
                    <Eyebrow className="mb-4">Restricted access</Eyebrow>
                    <h1 className="display-lg mb-3">Sign in to your<br />control panel.</h1>
                    <p className="text-[15px] text-[color:var(--color-body)] mb-8 max-w-md">
                        Use the admin token printed in your <span className="font-mono text-[13px]">laplace-core</span> console on first launch — or rotate one from the TUI with <span className="font-mono text-[13px]">user token</span>.
                    </p>
                    <Card tone="canvas" padded className="mb-4">
                        <form onSubmit={handleTokenSubmit} noValidate>
                            <label className="block">
                                <span className="block text-[12px] font-medium text-[color:var(--color-ink)] mb-2">Admin token</span>
                                <input
                                    type="password"
                                    value={tokenInput}
                                    onChange={(e) => { setTokenInput(e.target.value); if (tokenError) setTokenError(''); }}
                                    placeholder="Paste admin token"
                                    aria-invalid={Boolean(tokenError)}
                                    className={`w-full h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border text-[14px] text-[color:var(--color-ink)] ${
                                        tokenError ? 'border-[color:var(--color-error)]' : 'border-[color:var(--color-hairline)]'
                                    }`}
                                    autoFocus
                                />
                            </label>
                            {tokenError ? (
                                <div className="mt-2 text-[12px] text-[color:var(--color-error)] leading-snug" role="alert">{tokenError}</div>
                            ) : null}
                            <Button type="submit" className="w-full mt-4" loading={verifying} disabled={verifying}>
                                {verifying ? 'Verifying…' : 'Continue'}
                            </Button>
                        </form>
                    </Card>
                    <button
                        onClick={() => (window.location.href = '/')}
                        className="text-[13px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] inline-flex items-center gap-1"
                    >
                        Return to public page <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        );
    }

    const currentServer = servers.find((s) => s.id === currentServerId) || null;

    // Merge built-in sections with plugin-supplied ones from the manifest.
    // Plugin sections come in as iframe descriptors; convert to SectionDescriptor.
    const pluginSections: SectionDescriptor[] = extensions.sections.map((reg: SectionRegistration) => ({
        id: reg.id,
        label: reg.label,
        group: (reg.group as SidebarGroup) || 'plugin',
        icon: reg.icon || 'Puzzle',
        order: reg.order ?? 200,
        scope: reg.serverScoped ? 'server' : 'global',
        iframeUrl: reg.iframeUrl,
        iframeHeight: reg.height,
        serverScoped: reg.serverScoped,
        pluginId: reg.pluginId,
    }));

    // Synthetic Plugins overview section (always available when there are extensions
    // or stylesheets of any kind, to avoid clutter in clean installs).
    const hasAnyExtensions = pluginSections.length > 0 || extensions.tiles.length > 0 || extensions.stylesheets.length > 0;
    const pluginsOverviewSection: SectionDescriptor | null = hasAnyExtensions ? {
        id: 'plugins-overview',
        label: 'Plugin tiles',
        group: 'plugin',
        icon: 'Puzzle',
        order: 0,
        scope: 'global',
    } : null;

    const allSections: SectionDescriptor[] = [
        ...BUILTIN_SECTIONS,
        ...(pluginsOverviewSection ? [pluginsOverviewSection] : []),
        ...pluginSections,
    ];

    // Group + sort for the sidebar.
    const grouped: Record<SidebarGroup, SectionDescriptor[]> = {
        overview: [], operations: [], snapshots: [], configuration: [], plugin: [],
    };
    for (const s of allSections) {
        const g = grouped[s.group] || (grouped.plugin);
        g.push(s);
    }
    for (const key of Object.keys(grouped) as SidebarGroup[]) {
        grouped[key].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }

    const activeSection = allSections.find((s) => s.id === view) || BUILTIN_SECTIONS[0];

    const renderActive = () => {
        const baseProps: SectionProps = {
            notify,
            currentServerId,
            currentServer,
            servers,
            defaultServerId,
            refreshServers,
            switchServer,
            handleServerDeleted,
            setView,
        };

        if (activeSection.id === 'plugins-overview') {
            return <PluginsOverview tiles={extensions.tiles.filter((t) => (t.placement || 'plugins-overview') === 'plugins-overview')} sectionsCount={pluginSections.length} stylesheetsCount={extensions.stylesheets.length} />;
        }

        if (activeSection.iframeUrl) {
            return <PluginSection descriptor={activeSection} {...baseProps} />;
        }

        // Special-case "Dashboard when no servers" → wizard.
        if (activeSection.id === 'dashboard') {
            if (!serversLoaded) {
                return (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-5 h-5 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
                    </div>
                );
            }
            if (servers.length === 0) {
                const wiz = BUILTIN_SECTIONS.find((s) => s.id === 'server-wizard');
                if (wiz?.component) {
                    const Wiz = wiz.component;
                    return <Wiz {...baseProps} />;
                }
            }
        }

        if (!activeSection.component) return null;
        const Comp = activeSection.component;
        return <Comp {...baseProps} />;
    };

    return (
        <div className="min-h-screen flex bg-[color:var(--color-canvas)] text-[color:var(--color-body)]">
            <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto flex items-center gap-3 bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] px-4 py-3 rounded-lg animate-fade-in min-w-[280px]">
                        {toast.type === 'success' && <CheckCircle size={16} className="text-[color:var(--color-success)]" />}
                        {toast.type === 'error' && <XCircle size={16} className="text-[color:var(--color-error)]" />}
                        {toast.type === 'info' && <AlertCircle size={16} className="text-[color:var(--color-accent-sage)]" />}
                        <span className="text-[13px] text-[color:var(--color-ink)]">{toast.message}</span>
                    </div>
                ))}
            </div>

            <aside className="w-[260px] hidden md:flex flex-col border-r border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)]">
                <div className="px-7 pt-9 pb-5">
                    <div className="font-display text-[26px] tracking-[-0.6px] text-[color:var(--color-ink)] leading-none">laplace</div>
                    <div className="eyebrow mt-2">Control panel</div>
                </div>

                {/* Server picker */}
                <div className="px-4 pb-4 relative" ref={pickerRef}>
                    <button
                        onClick={() => setPickerOpen((v) => !v)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-md bg-[color:var(--color-surface-soft)] border border-[color:var(--color-hairline)] transition-colors text-left ${
                            servers.length === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[color:var(--color-surface-card)]'
                        }`}
                        aria-haspopup="listbox"
                        aria-expanded={pickerOpen}
                        title={servers.length === 0 ? 'No servers configured yet — run the setup wizard' : undefined}
                        disabled={servers.length === 0}
                    >
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{
                            background: currentServer?.status === 'ONLINE' ? 'var(--color-success)'
                                : currentServer?.status === 'CRASHED' ? 'var(--color-error)'
                                : currentServer?.running ? 'var(--color-accent-ochre)'
                                : 'var(--color-muted-soft)',
                        }} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-[color:var(--color-ink)] truncate">
                                {currentServer?.name || (servers.length === 0 ? 'No servers yet' : 'Select a server')}
                            </div>
                            <div className="text-[11px] text-[color:var(--color-muted)] truncate">
                                {currentServer ? `${currentServer.id} · ${currentServer.status.toLowerCase()}` : 'Run the wizard to add one'}
                            </div>
                        </div>
                        <ChevronDown size={14} className={`text-[color:var(--color-muted)] transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {pickerOpen && servers.length > 0 ? (
                        <div className="absolute left-4 right-4 top-full mt-1 z-30 bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] rounded-md shadow-lg max-h-[300px] overflow-auto" role="listbox">
                            {servers.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => switchServer(s.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[color:var(--color-surface-soft)] transition-colors ${
                                        s.id === currentServerId ? 'bg-[color:var(--color-surface-card)]' : ''
                                    }`}
                                >
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{
                                        background: s.status === 'ONLINE' ? 'var(--color-success)'
                                            : s.status === 'CRASHED' ? 'var(--color-error)'
                                            : s.running ? 'var(--color-accent-ochre)'
                                            : 'var(--color-muted-soft)',
                                    }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] text-[color:var(--color-ink)] truncate">{s.name}</div>
                                        <div className="text-[11px] text-[color:var(--color-muted)] truncate">{s.id} · port {s.port ?? '—'} · {s.status.toLowerCase()}</div>
                                    </div>
                                    {s.id === defaultServerId ? <span className="text-[10px] text-[color:var(--color-muted)] uppercase tracking-[1.2px]">default</span> : null}
                                </button>
                            ))}
                            <button
                                onClick={() => { setPickerOpen(false); setView('server-wizard'); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-[color:var(--color-hairline)] hover:bg-[color:var(--color-surface-soft)] transition-colors"
                            >
                                <Plus size={14} className="text-[color:var(--color-primary)]" />
                                <span className="text-[13px] text-[color:var(--color-primary)] font-medium">Add new server</span>
                            </button>
                        </div>
                    ) : null}
                </div>

                <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
                    {GROUP_ORDER.map((group) => {
                        const items = grouped[group];
                        if (!items || items.length === 0) return null;
                        return (
                            <div key={group} className="pb-2">
                                <div className="px-4 pt-5 pb-2 eyebrow text-[10px]">{GROUP_LABEL[group]}</div>
                                <div className="space-y-0.5">
                                    {items.map((s) => {
                                        const Icon = resolveLucideIcon(s.icon);
                                        const disabled = (s.scope === 'server' && !currentServerId)
                                            || (s.scope === 'no-servers' && servers.length > 0);
                                        const active = view === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => !disabled && setView(s.id)}
                                                disabled={disabled}
                                                title={s.pluginId ? `${s.pluginId} · ${s.label}` : s.label}
                                                className={`group flex items-center gap-3 w-full h-9 px-4 rounded-md text-[13.5px] transition-colors ${
                                                    active
                                                        ? 'bg-[color:var(--color-surface-card)] text-[color:var(--color-ink)] font-medium'
                                                        : 'text-[color:var(--color-body)] hover:bg-[color:var(--color-surface-soft)] hover:text-[color:var(--color-ink)]'
                                                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                                <Icon size={15} className={active ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--color-muted)]'} />
                                                <span className="truncate">{s.label}</span>
                                                {s.pluginId ? <span className="ml-auto text-[10px] text-[color:var(--color-muted-soft)] uppercase tracking-[1.2px]">ext</span> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="px-4 pb-6 pt-4 border-t border-[color:var(--color-hairline)]">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 h-10 w-full rounded-md text-[13px] text-[color:var(--color-muted)] hover:text-[color:var(--color-error)] hover:bg-[color:var(--color-error)]/5 transition-colors"
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 px-10 flex items-center justify-between border-b border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)]">
                    <div className="flex items-center gap-3 text-[13px] text-[color:var(--color-muted)]">
                        <Terminal size={14} />
                        {currentServer ? (
                            <>
                                <span className="text-[color:var(--color-ink)] font-medium">{currentServer.name}</span>
                                <span>·</span>
                                <span>{currentServer.status.toLowerCase()}</span>
                                {currentServer.port ? <><span>·</span><span className="font-mono">:{currentServer.port}</span></> : null}
                                <span className="text-[color:var(--color-muted-soft)] ml-2">{servers.length} server{servers.length === 1 ? '' : 's'} configured</span>
                            </>
                        ) : (
                            <span>No server selected</span>
                        )}
                    </div>
                    <div className="text-[11.5px] text-[color:var(--color-muted)] flex items-center gap-2 font-mono">
                        {panelVersion ? <span>v{panelVersion}</span> : <span className="opacity-60">v?</span>}
                        <span className="text-[color:var(--color-muted-soft)]">·</span>
                        {gitCommit
                            ? <span title={`Git commit ${gitCommit}`}>{gitCommit}</span>
                            : <span className="opacity-60" title="Not running from a git checkout">no-git</span>}
                    </div>
                </header>

                <main className="flex-1 overflow-auto px-10 py-10">
                    <div className="max-w-[1200px] mx-auto">
                        {renderActive()}
                    </div>
                </main>
            </div>
        </div>
    );
}
