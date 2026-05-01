import React, { useEffect, useState } from 'react';
import { Power, StopCircle, Plus, RotateCw, ServerCog } from 'lucide-react';
import { ViewState } from '../types.ts';
import type { ServerStatus, ServerSummary } from '../types.ts';
import Terminal from './Terminal.tsx';
import { fetchScoped, postScoped } from '../lib/api.ts';
import { Button, Card, Eyebrow, SectionHeader, StatusDot } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    onNavigate?: (view: ViewState) => void;
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
    currentServer: ServerSummary | null;
    refreshServers?: () => Promise<void> | void;
}

export default function Dashboard({ onNavigate, notify, currentServerId, currentServer }: Props) {
    const confirm = useConfirm();
    const [status, setStatus] = useState<ServerStatus>({ running: false, activeServerId: currentServerId, status: 'OFFLINE' });
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!currentServerId) return;
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await fetchScoped('/server/status', currentServerId);
                if (cancelled) return;
                if (res.ok) {
                    const response = await res.json();
                    if (response.success && response.data) {
                        setStatus(response.data);
                        if (['ONLINE', 'OFFLINE', 'CRASHED'].includes(response.data.status)) setProcessing(false);
                        else setProcessing(true);
                    }
                }
            } catch { /* ignore */ }
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [currentServerId]);

    const isBusy = processing || Boolean(status.busy) || ['STARTING', 'STOPPING', 'RESTARTING'].includes(status.status);
    const busyLabel = status.busyScopes?.length ? status.busyScopes.join(', ') : 'panel-runtime';

    const handlePower = async (action: 'start' | 'stop' | 'restart') => {
        if (isBusy) return;
        if (!currentServerId) { notify?.('Pick a server first.', 'error'); return; }
        if (action === 'start' && status.running) { notify?.('Server is already running', 'error'); return; }
        if (action === 'stop' && !status.running) { notify?.('Server is not running', 'error'); return; }

        if (action === 'stop' || action === 'restart') {
            const ok = await confirm({
                title: action === 'stop' ? `Stop "${currentServer?.name || currentServerId}"?` : `Restart "${currentServer?.name || currentServerId}"?`,
                message: action === 'stop'
                    ? 'Connected players will be disconnected. The server can be started again from this panel.'
                    : 'The server will go down briefly. Connected players will be disconnected during the restart.',
                danger: action === 'stop',
                confirmLabel: action === 'stop' ? 'Stop server' : 'Restart server',
            });
            if (!ok) return;
        }

        setProcessing(true);
        try {
            const res = await postScoped(`/server/${action}`, currentServerId, {});
            const response = await res.json();
            if (res.ok && response.success) notify?.(`Server ${action} command sent`, 'success');
            else { notify?.(response.error || 'Action failed', 'error'); setProcessing(false); }
        } catch {
            notify?.('Connection failed', 'error');
            setProcessing(false);
        }
    };

    if (!currentServerId) {
        return (
            <div>
                <SectionHeader
                    eyebrow="Welcome"
                    title="No server selected."
                    lead="Pick a server from the picker on the left, or create your first one with the setup wizard."
                    action={
                        <Button size="lg" onClick={() => onNavigate?.(ViewState.SERVER_WIZARD)}>
                            <Plus size={16} /> Run setup wizard
                        </Button>
                    }
                />
                <Card tone="cream" padded className="mt-4 text-center py-12">
                    <ServerCog size={28} className="mx-auto mb-3 text-[color:var(--color-muted)]" />
                    <p className="text-[14px] text-[color:var(--color-muted)]">Multi-server is supported — run as many as your hardware can handle.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <SectionHeader
                eyebrow={`Active · ${currentServerId}`}
                title={currentServer?.name || currentServerId}
                lead={isBusy ? `Runtime is busy with ${busyLabel}. Controls are temporarily locked.` : undefined}
                action={
                    <div className="flex items-center gap-3">
                        <StatusDot status={status.status} />
                        {!status.running ? (
                            <Button size="md" onClick={() => handlePower('start')} disabled={isBusy} loading={isBusy}>
                                <Power size={14} /> Start server
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" size="md" onClick={() => handlePower('restart')} disabled={isBusy} loading={isBusy}>
                                    <RotateCw size={14} /> Restart
                                </Button>
                                <Button variant="danger" size="md" onClick={() => handlePower('stop')} disabled={isBusy}>
                                    <StopCircle size={14} /> Stop
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            <Card tone="dark" padded={false} className="overflow-hidden">
                <Terminal serverRunning={status.running} currentServerId={currentServerId} />
            </Card>
        </div>
    );
}
