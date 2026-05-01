import React, { useState } from 'react';
import { Power, StopCircle, RotateCw, Plus, Trash2, ServerCog, ExternalLink } from 'lucide-react';
import type { ServerSummary } from '../types.ts';
import { postScoped } from '../lib/api.ts';
import { Button, Card, Eyebrow, Pill, SectionHeader, StatusDot } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    servers: ServerSummary[];
    defaultServerId: string | null;
    onSelect: (serverId: string) => void;
    onCreateNew: () => void;
    onDeleted: (deletedId: string) => void | Promise<void>;
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ServersOverview({ servers, defaultServerId, onSelect, onCreateNew, onDeleted, notify }: Props) {
    const confirm = useConfirm();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ServerSummary | null>(null);
    const [deleteAction, setDeleteAction] = useState<'KEEP_ALL' | 'KEEP_LATEST' | 'DELETE_ALL'>('KEEP_ALL');
    const [deleting, setDeleting] = useState(false);

    const power = async (server: ServerSummary, action: 'start' | 'stop' | 'restart') => {
        if (action === 'stop' || action === 'restart') {
            const ok = await confirm({
                title: action === 'stop' ? `Stop "${server.name}"?` : `Restart "${server.name}"?`,
                message: 'Connected players will be disconnected.',
                danger: action === 'stop',
                confirmLabel: action === 'stop' ? 'Stop server' : 'Restart server',
            });
            if (!ok) return;
        }
        setBusyId(server.id);
        try {
            const res = await postScoped(`/server/${action}`, server.id, {});
            const json = await res.json();
            if (res.ok && json.success) {
                notify?.(`Server ${action} requested`, 'success');
            } else {
                notify?.(json.error || `${action} failed`, 'error');
            }
        } catch (e: any) {
            notify?.(e.message || 'Network error', 'error');
        } finally {
            setBusyId(null);
        }
    };

    const startDelete = (server: ServerSummary) => {
        if (server.running) {
            notify?.(`Stop "${server.name}" before deleting it.`, 'error');
            return;
        }
        setDeleteTarget(server);
        setDeleteAction('KEEP_ALL');
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await postScoped('/servers/delete', null, {
                serverId: deleteTarget.id,
                backupAction: deleteAction,
            });
            const json = await res.json();
            if (res.ok && json.success) {
                const deletedId = deleteTarget.id;
                notify?.(`Server "${deleteTarget.name}" deleted`, 'success');
                setDeleteTarget(null);
                await onDeleted(deletedId);
            } else {
                notify?.(json.error || 'Delete failed', 'error');
            }
        } catch (e: any) {
            notify?.(e.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <SectionHeader
                eyebrow="Inventory"
                title="All servers"
                lead="Run multiple Minecraft cores side by side. Each server has its own config, world, port, schedule, and process. Click a card to focus on it."
                action={
                    <Button onClick={onCreateNew}>
                        <Plus size={14} /> New server
                    </Button>
                }
            />

            {servers.length === 0 ? (
                <Card tone="canvas" padded className="text-center py-16">
                    <ServerCog size={28} className="mx-auto mb-4 text-[color:var(--color-muted)]" />
                    <h3 className="display-sm mb-2">No servers configured yet.</h3>
                    <p className="text-[14px] text-[color:var(--color-muted)] mb-6 max-w-sm mx-auto">
                        Spin up your first Minecraft instance with the setup wizard. You can add as many as your machine can run.
                    </p>
                    <Button onClick={onCreateNew}><Plus size={14} /> Run setup wizard</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {servers.map((s) => {
                        const isBusy = busyId === s.id || ['STARTING', 'STOPPING', 'RESTARTING'].includes(s.status);
                        const uptime = s.startTime ? formatUptime(Date.now() - s.startTime) : null;
                        return (
                            <Card key={s.id} tone="canvas" padded>
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <button
                                                onClick={() => onSelect(s.id)}
                                                className="text-left display-sm hover:text-[color:var(--color-primary)] transition-colors truncate"
                                                title="Focus on this server"
                                            >
                                                {s.name}
                                            </button>
                                            {s.id === defaultServerId ? <Pill tone="primary">Default</Pill> : null}
                                        </div>
                                        <div className="flex items-center gap-3 text-[12px] text-[color:var(--color-muted)]">
                                            <span className="font-mono">{s.id}</span>
                                            {s.port ? <><span>·</span><span className="font-mono">port {s.port}</span></> : null}
                                            {uptime ? <><span>·</span><span>up {uptime}</span></> : null}
                                        </div>
                                    </div>
                                    <StatusDot status={s.status} />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {!s.running ? (
                                        <Button size="sm" onClick={() => power(s, 'start')} disabled={isBusy} loading={isBusy}>
                                            <Power size={13} /> Start
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="secondary" size="sm" onClick={() => power(s, 'restart')} disabled={isBusy} loading={isBusy}>
                                                <RotateCw size={13} /> Restart
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => power(s, 'stop')} disabled={isBusy}>
                                                <StopCircle size={13} /> Stop
                                            </Button>
                                        </>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => onSelect(s.id)}>
                                        <ExternalLink size={13} /> Manage
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => startDelete(s)} disabled={s.running}>
                                        <Trash2 size={13} className="text-[color:var(--color-error)]" />
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {deleteTarget ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[color:var(--color-ink)]/40" onClick={() => !deleting && setDeleteTarget(null)} />
                    <Card tone="canvas" padded className="relative w-full max-w-[480px]">
                        <Eyebrow className="mb-3 text-[color:var(--color-error)]">Destructive action</Eyebrow>
                        <h3 className="display-sm mb-3">Delete &quot;{deleteTarget.name}&quot;?</h3>
                        <p className="text-[14px] text-[color:var(--color-body)] mb-5 leading-snug">
                            This removes the server directory at <span className="font-mono text-[12px]">laplace_data/servers/{deleteTarget.id}</span>. Choose what to do with the snapshot history:
                        </p>
                        <div className="space-y-2 mb-6">
                            <DeleteOption value="KEEP_ALL" current={deleteAction} onChange={setDeleteAction} title="Keep all backups" subtitle="Recommended. The world data inside the server directory is gone, but every snapshot under backups/ stays put." />
                            <DeleteOption value="KEEP_LATEST" current={deleteAction} onChange={setDeleteAction} title="Keep only the most recent backup" subtitle="Older snapshots are pruned." />
                            <DeleteOption value="DELETE_ALL" current={deleteAction} onChange={setDeleteAction} title="Delete all backups too" subtitle="Permanent. Cannot be undone — read this twice." danger />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
                            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete server</Button>
                        </div>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}

function DeleteOption({ value, current, onChange, title, subtitle, danger }: {
    value: 'KEEP_ALL' | 'KEEP_LATEST' | 'DELETE_ALL';
    current: string;
    onChange: (v: any) => void;
    title: string;
    subtitle: string;
    danger?: boolean;
}) {
    const active = current === value;
    return (
        <button
            type="button"
            onClick={() => onChange(value)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
                active
                    ? danger
                        ? 'border-[color:var(--color-error)] bg-[color:var(--color-error)]/5'
                        : 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5'
                    : 'border-[color:var(--color-hairline)] hover:bg-[color:var(--color-surface-soft)]'
            }`}
        >
            <div className="flex items-start gap-3">
                <span className={`mt-1 inline-block w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                    active ? (danger ? 'border-[color:var(--color-error)] bg-[color:var(--color-error)]' : 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]') : 'border-[color:var(--color-hairline)]'
                }`} />
                <div>
                    <div className="text-[14px] font-medium text-[color:var(--color-ink)]">{title}</div>
                    <div className="text-[12.5px] text-[color:var(--color-muted)] mt-0.5 leading-snug">{subtitle}</div>
                </div>
            </div>
        </button>
    );
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}
