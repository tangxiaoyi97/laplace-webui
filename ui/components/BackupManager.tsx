import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, RotateCcw, Lock, Download, AlertTriangle } from 'lucide-react';
import type { BackupItem, ServerStatus } from '../types.ts';
import { fetchScoped, postScoped } from '../lib/api.ts';
import { Button, Card, Pill, SectionHeader, StatusDot } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
}

export default function BackupManager({ notify, currentServerId }: Props) {
    const confirm = useConfirm();
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [status, setStatus] = useState<ServerStatus>({ running: false, activeServerId: null, status: 'OFFLINE' });
    const generationRef = useRef(0);

    useEffect(() => {
        setBackups([]);
        setStatus({ running: false, activeServerId: null, status: 'OFFLINE' });
    }, [currentServerId]);

    useEffect(() => {
        if (!currentServerId) return;
        let cancelled = false;
        const myGen = ++generationRef.current;
        const fetchData = async () => {
            try {
                const [bRes, sRes] = await Promise.all([
                    fetchScoped('/backups', currentServerId),
                    fetchScoped('/server/status', currentServerId),
                ]);
                if (cancelled || generationRef.current !== myGen) return;
                const bData = await bRes.json();
                const sData = await sRes.json();
                if (cancelled || generationRef.current !== myGen) return;
                if (bRes.ok && bData.success && Array.isArray(bData.data)) setBackups(bData.data);
                if (sRes.ok && sData.success) setStatus(sData.data);
            } catch {
                if (!cancelled && generationRef.current === myGen) notify?.('Failed to load backup data', 'error');
            } finally {
                if (!cancelled && generationRef.current === myGen) setLoading(false);
            }
        };
        setLoading(true);
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [currentServerId]);

    const refreshNow = () => { generationRef.current++; };

    const isLocked = status.status !== 'OFFLINE' || Boolean(status.busy);

    const handleCreate = async () => {
        if (isLocked) { notify?.('Server must be OFFLINE to create a backup.', 'error'); return; }
        if (!currentServerId) return;
        setCreating(true);
        try {
            const res = await postScoped('/backups/create', currentServerId, {});
            const response = await res.json();
            if (res.ok && response.success) { notify?.('Backup created', 'success'); refreshNow(); }
            else notify?.(response.error || 'Failed to create backup', 'error');
        } catch { notify?.('Network error', 'error'); }
        setCreating(false);
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Delete this backup?',
            message: <>Snapshot <span className="font-mono">{id}</span> will be removed permanently.</>,
            danger: true,
            confirmLabel: 'Delete',
        });
        if (!ok) return;
        try {
            const res = await postScoped('/backups/delete', currentServerId, { id });
            const response = await res.json();
            if (res.ok && response.success) { notify?.('Deleted', 'success'); refreshNow(); }
            else notify?.(response.error || 'Delete failed', 'error');
        } catch { notify?.('Delete error', 'error'); }
    };

    const handleRestore = async (id: string) => {
        if (isLocked) { notify?.('Server must be OFFLINE to restore.', 'error'); return; }
        const ok = await confirm({
            title: 'Restore from this snapshot?',
            message: <>This overwrites the current server directory with the contents of <span className="font-mono">{id}</span>. Make a fresh backup first if you might want to come back.</>,
            danger: true,
            confirmLabel: 'Restore',
        });
        if (!ok) return;
        try {
            notify?.('Restore started…', 'info');
            const res = await postScoped('/backups/restore', currentServerId, { id });
            const response = await res.json();
            if (res.ok && response.success) notify?.('Server restored', 'success');
            else notify?.(response.error || 'Restore failed', 'error');
        } catch { notify?.('Restore error', 'error'); }
    };

    const handleDownload = async (id: string) => {
        try {
            const response = await fetchScoped(`/backups/download?id=${encodeURIComponent(id)}`, currentServerId);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${id}.zip`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { notify?.('Download failed', 'error'); }
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    return (
        <div>
            <SectionHeader
                eyebrow="Snapshots"
                title="Manual backups"
                lead="Take a one-off snapshot of the server directory. The server must be offline to guarantee consistency."
                action={
                    <div className="flex items-center gap-3">
                        <StatusDot status={status.status} />
                        <Button onClick={handleCreate} disabled={isLocked} loading={creating}>
                            <Plus size={14} /> New backup
                        </Button>
                    </div>
                }
            />

            {isLocked ? (
                <Card tone="cream" padded className="mb-6 flex items-start gap-3">
                    <Lock size={16} className="mt-0.5 text-[color:var(--color-warning)] shrink-0" />
                    <div className="text-[13px] text-[color:var(--color-body)] leading-snug">
                        Snapshot creation and restoration are paused while the server is online or busy. Stop it from the dashboard or use the scheduled backups feature for automatic stop-snapshot-restart.
                    </div>
                </Card>
            ) : (
                <Card tone="cream" padded className="mb-6 flex items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5 text-[color:var(--color-accent-ochre)] shrink-0" />
                    <div className="text-[13px] text-[color:var(--color-body)] leading-snug">
                        Restoring a snapshot overwrites the current server directory in place — make a fresh backup first if you might want to come back.
                    </div>
                </Card>
            )}

            {!currentServerId ? (
                <Card tone="canvas" padded className="text-center py-16">
                    <p className="text-[14px] text-[color:var(--color-muted)]">Pick a server to manage its backups.</p>
                </Card>
            ) : loading && backups.length === 0 ? (
                <Card tone="canvas" padded className="flex items-center justify-center gap-3 py-16">
                    <div className="w-4 h-4 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
                    <span className="text-[14px] text-[color:var(--color-muted)]">Loading snapshots for {currentServerId}…</span>
                </Card>
            ) : backups.length === 0 ? (
                <Card tone="canvas" padded className="text-center py-16">
                    <p className="text-[14px] text-[color:var(--color-muted)]">No snapshots yet.</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {backups.map((backup) => (
                        <div
                            key={backup.id}
                            className="flex items-center justify-between gap-6 px-5 py-4 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)]"
                        >
                            <div className="min-w-0">
                                <div className="text-[14px] text-[color:var(--color-ink)] font-medium truncate">{backup.name}</div>
                                <div className="flex items-center gap-3 mt-1 text-[12px] text-[color:var(--color-muted)]">
                                    <span>{new Date(backup.timestamp).toLocaleString()}</span>
                                    <Pill tone="neutral">{formatSize(backup.size)}</Pill>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="secondary" size="sm" onClick={() => handleRestore(backup.id)} disabled={isLocked}>
                                    <RotateCcw size={13} /> Restore
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDownload(backup.id)}>
                                    <Download size={13} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(backup.id)}>
                                    <Trash2 size={13} className="text-[color:var(--color-error)]" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
