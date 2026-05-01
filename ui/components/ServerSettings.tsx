import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import type { ServerConfig, ServerSettingsPayload, ServerSummary } from '../types.ts';
import { fetchScoped, postScoped } from '../lib/api.ts';
import { Button, Card, Eyebrow, Input, NumberField, SectionHeader, Toggle } from './primitives.tsx';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
    /** Provided by App for cross-server checks (e.g. port collision warnings). */
    servers?: ServerSummary[];
}

const memoryRegex = /^(\d+)([MG])$/i;
function parseMemoryToMB(input: string): number | null {
    const m = memoryRegex.exec(input.trim());
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return m[2].toUpperCase() === 'G' ? n * 1024 : n;
}

export default function ServerSettings({ notify, currentServerId, servers = [] }: Props) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<ServerConfig | null>(null);
    const [properties, setProperties] = useState<Record<string, string>>({});
    const generationRef = useRef(0);

    useEffect(() => {
        setConfig(null);
        setProperties({});
    }, [currentServerId]);

    const fetchSettings = async () => {
        if (!currentServerId) return;
        const myGen = ++generationRef.current;
        setLoading(true);
        try {
            const res = await fetchScoped('/server/settings', currentServerId);
            const response = await res.json();
            if (generationRef.current !== myGen) return;
            if (res.ok && response.success) {
                const data: ServerSettingsPayload = response.data;
                setConfig(data.config);
                setProperties(data.properties);
            } else {
                notify?.('Failed to load settings', 'error');
            }
        } catch {
            if (generationRef.current === myGen) notify?.('Network error', 'error');
        } finally {
            if (generationRef.current === myGen) setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, [currentServerId]);

    const portInput = properties['server-port'] || '25565';
    const portNumber = Number.parseInt(portInput, 10);
    const portCollidesWith = useMemo(() => {
        if (!Number.isFinite(portNumber)) return null;
        return servers.find((s) => s.id !== currentServerId && s.port === portNumber);
    }, [servers, currentServerId, portNumber]);

    const xmxMB = config ? parseMemoryToMB(config.javaArgs.xmx) : null;
    const xmsMB = config ? parseMemoryToMB(config.javaArgs.xms) : null;
    const memoryError = (xmxMB !== null && xmsMB !== null && xmsMB > xmxMB)
        ? 'Initial RAM (Xms) cannot exceed Max RAM (Xmx). The JVM will refuse to launch.'
        : null;
    const memoryFormatError = config ? (
        (config.javaArgs.xmx && parseMemoryToMB(config.javaArgs.xmx) === null) ||
        (config.javaArgs.xms && parseMemoryToMB(config.javaArgs.xms) === null)
    ) : false;

    const canSave = !memoryError && !memoryFormatError;

    const handleSave = async () => {
        if (!config || !currentServerId) return;
        if (!canSave) {
            notify?.(memoryError || 'Fix the highlighted fields before saving.', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await postScoped('/server/settings', currentServerId, { config, properties });
            const response = await res.json();
            if (res.ok && response.success) { notify?.('Settings saved · restart to apply', 'success'); fetchSettings(); }
            else notify?.(response.error || 'Save failed', 'error');
        } catch { notify?.('Network error', 'error'); }
        setSaving(false);
    };

    const setProp = (key: string, value: string) => setProperties((p) => ({ ...p, [key]: value }));
    const setJava = (k: 'xmx' | 'xms' | 'args', value: string) => {
        if (!config) return;
        setConfig({ ...config, javaArgs: { ...config.javaArgs, [k]: value } });
    };
    const setCrash = (k: 'maxRestarts' | 'restartDelayMs' | 'resetAfterMs', value: number) => {
        if (!config) return;
        const policy = config.crashPolicy || { maxRestarts: 3, restartDelayMs: 5000, resetAfterMs: 5 * 60 * 1000 };
        setConfig({ ...config, crashPolicy: { ...policy, [k]: value } });
    };

    if (loading || !config) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-5 h-5 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
            </div>
        );
    }

    const motd = properties['motd'] || '';
    const maxPlayers = properties['max-players'] || '20';
    const port = properties['server-port'] || '25565';
    const viewDistance = properties['view-distance'] || '10';
    const whitelist = properties['white-list'] === 'true';

    const policy = config.crashPolicy || { maxRestarts: 3, restartDelayMs: 5000, resetAfterMs: 5 * 60 * 1000 };

    return (
        <div>
            <SectionHeader
                eyebrow="Configuration"
                title="Server settings"
                lead="JVM startup, gameplay tuning, crash policy, and the raw server.properties keys. Restart the server to apply most changes."
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" size="md" onClick={fetchSettings}><RefreshCw size={14} /> Reload</Button>
                        <Button size="md" onClick={handleSave} loading={saving} disabled={!canSave}><Save size={14} /> Save</Button>
                    </div>
                }
            />

            <Card tone="canvas" padded className="mb-5">
                <Eyebrow className="mb-4">JVM startup</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Input
                        label="Max RAM (Xmx)"
                        value={config.javaArgs.xmx}
                        onChange={(e) => setJava('xmx', e.target.value)}
                        helper="e.g. 4G or 2048M"
                        error={config.javaArgs.xmx && parseMemoryToMB(config.javaArgs.xmx) === null ? 'Use values like 4G or 2048M.' : undefined}
                    />
                    <Input
                        label="Initial RAM (Xms)"
                        value={config.javaArgs.xms}
                        onChange={(e) => setJava('xms', e.target.value)}
                        helper="e.g. 1G — must be ≤ Xmx"
                        error={
                            (config.javaArgs.xms && parseMemoryToMB(config.javaArgs.xms) === null)
                                ? 'Use values like 1G or 1024M.'
                                : memoryError || undefined
                        }
                    />
                    <Input label="Extra Java flags" value={config.javaArgs.args} onChange={(e) => setJava('args', e.target.value)} placeholder="-XX:+UseG1GC ..." />
                </div>
            </Card>

            <Card tone="canvas" padded className="mb-5">
                <Eyebrow className="mb-4">Gameplay</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="MOTD" value={motd} onChange={(e) => setProp('motd', e.target.value)} />
                    <Input
                        label="Server port"
                        value={port}
                        onChange={(e) => setProp('server-port', e.target.value)}
                        error={portCollidesWith ? `Port ${portCollidesWith.port} is already used by '${portCollidesWith.name}'.` : undefined}
                    />
                    <Input label="Max players" type="number" value={maxPlayers} onChange={(e) => setProp('max-players', e.target.value)} />
                    <Input label="View distance" type="number" value={viewDistance} onChange={(e) => setProp('view-distance', e.target.value)} />
                </div>
                <div className="mt-5 flex items-center justify-between p-4 rounded-md bg-[color:var(--color-surface-soft)]">
                    <div>
                        <div className="text-[14px] text-[color:var(--color-ink)] font-medium">Whitelist</div>
                        <div className="text-[12px] text-[color:var(--color-muted)] mt-0.5">Only listed players can connect.</div>
                    </div>
                    <Toggle
                        checked={whitelist}
                        onChange={(next) => setProp('white-list', next ? 'true' : 'false')}
                        label={whitelist ? 'On' : 'Off'}
                    />
                </div>
            </Card>

            <Card tone="canvas" padded className="mb-5">
                <Eyebrow className="mb-4">Crash recovery</Eyebrow>
                <p className="text-[13px] text-[color:var(--color-muted)] mb-4 max-w-2xl">
                    How aggressively the panel restarts a crashed server. After a stable run, the crash counter resets — so a long-running server isn't stuck at "max attempts reached" because of an old run.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <NumberField label="Max restart attempts" value={policy.maxRestarts} onChange={(n) => setCrash('maxRestarts', n)} min={0} max={10} />
                    <NumberField label="Restart delay" value={policy.restartDelayMs / 1000} onChange={(n) => setCrash('restartDelayMs', n * 1000)} min={0} max={120} suffix="seconds" />
                    <NumberField label="Reset counter after" value={policy.resetAfterMs / 60000} onChange={(n) => setCrash('resetAfterMs', n * 60000)} min={1} max={1440} suffix="minutes" />
                </div>
            </Card>

            <Card tone="canvas" padded>
                <Eyebrow className="mb-4">Advanced — server.properties</Eyebrow>
                <div className="rounded-md bg-[color:var(--color-surface-dark)] text-[color:var(--color-on-dark)] p-5 font-mono text-[12.5px] max-h-[480px] overflow-auto">
                    <table className="w-full">
                        <tbody>
                            {Object.keys(properties).sort().map((key) => (
                                <tr key={key} className="border-b border-white/5">
                                    <td className="py-2 pr-4 text-[color:var(--color-accent-sage)] align-top w-[40%] break-all">{key}</td>
                                    <td className="py-2">
                                        <input
                                            type="text"
                                            value={properties[key]}
                                            onChange={(e) => setProp(key, e.target.value)}
                                            className="w-full bg-transparent text-[color:var(--color-on-dark)] focus:outline-none"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
