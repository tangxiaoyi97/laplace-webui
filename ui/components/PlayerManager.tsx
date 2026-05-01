import React, { useState, useEffect, useRef } from 'react';
import type { Player, PlayerActionType } from '../types.ts';
import {
    Clock, Shield, Ban, MessageSquare, LogOut, X, Crown, CheckCircle,
    UserCheck, UserX, Link as LinkIcon, Copy,
} from 'lucide-react';
import { fetchScoped, postScoped } from '../lib/api.ts';
import { Button, Card, Eyebrow, Pill, SectionHeader } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
}

type TabType = 'all' | 'online' | 'banned' | 'whitelist';

export default function PlayerManager({ notify, currentServerId }: Props) {
    const confirm = useConfirm();
    const [players, setPlayers] = useState<Player[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<(Player & { serverId: string }) | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [currentTab, setCurrentTab] = useState<TabType>('all');
    const [isWhitelistMode, setIsWhitelistMode] = useState(false);
    const generationRef = useRef(0);

    useEffect(() => {
        setPlayers([]);
        setSelectedPlayer(null);
        setMessageInput('');
    }, [currentServerId]);

    useEffect(() => {
        if (!currentServerId) return;
        let cancelled = false;
        const myGen = ++generationRef.current;
        const fetchState = async () => {
            try {
                const [pRes, sRes] = await Promise.all([
                    fetchScoped('/players', currentServerId),
                    fetchScoped('/server/settings', currentServerId),
                ]);
                if (cancelled || generationRef.current !== myGen) return;
                const pResponse = await pRes.json();
                const sResponse = await sRes.json();
                if (cancelled || generationRef.current !== myGen) return;
                if (pResponse.success && Array.isArray(pResponse.data)) setPlayers(pResponse.data);
                if (sRes.ok && sResponse.success) setIsWhitelistMode(sResponse.data.properties['white-list'] === 'true');
            } catch { /* ignore */ }
            finally {
                if (!cancelled && generationRef.current === myGen) setLoadingPlayers(false);
            }
        };
        setLoadingPlayers(true);
        fetchState();
        const interval = setInterval(fetchState, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [currentServerId]);

    const handleAction = async (action: PlayerActionType, payload?: string) => {
        if (!selectedPlayer || !currentServerId) return;
        // Refuse cross-server actions if user switched mid-modal.
        if (selectedPlayer.serverId !== currentServerId) {
            notify?.('You switched servers. Re-select the player to continue.', 'error');
            setSelectedPlayer(null);
            return;
        }
        if (action === 'ban' || action === 'kick') {
            const ok = await confirm({
                title: `${action === 'ban' ? 'Ban' : 'Kick'} ${selectedPlayer.name}?`,
                message: action === 'ban'
                    ? 'They will be disconnected and prevented from rejoining until pardoned.'
                    : 'They will be disconnected immediately. They can rejoin afterwards.',
                danger: action === 'ban',
                confirmLabel: action === 'ban' ? 'Ban' : 'Kick',
            });
            if (!ok) return;
        }
        setActionLoading(true);
        try {
            const res = await postScoped('/players/action', currentServerId, {
                uuid: selectedPlayer.uuid, name: selectedPlayer.name, action, payload,
            });
            const response = await res.json();
            if (res.ok && response.success) {
                notify?.(`Action '${action}' executed`, 'success');
                // Trigger an immediate refresh by bumping generation; the polling effect will refetch.
                generationRef.current++;
                if (action !== 'message') setSelectedPlayer(null);
                setMessageInput('');
            } else notify?.(response.error || 'Action failed', 'error');
        } catch { notify?.('Network error', 'error'); }
        setActionLoading(false);
    };

    const counts = {
        all: players.length,
        online: players.filter((p) => p.isOnline).length,
        banned: players.filter((p) => p.isBanned).length,
        whitelist: players.filter((p) => p.isWhitelisted).length,
    };

    const filteredPlayers = players.filter((p) => {
        if (currentTab === 'online') return p.isOnline;
        if (currentTab === 'banned') return p.isBanned;
        if (currentTab === 'whitelist') return p.isWhitelisted;
        return true;
    });

    const TabButton = ({ id, label, count }: { id: TabType; label: string; count: number }) => (
        <button
            onClick={() => setCurrentTab(id)}
            className={`px-4 h-9 rounded-md text-[13px] font-medium transition-colors ${
                currentTab === id
                    ? 'bg-[color:var(--color-ink)] text-[color:var(--color-on-dark)]'
                    : 'text-[color:var(--color-body)] hover:bg-[color:var(--color-surface-soft)]'
            }`}
        >
            {label} <span className="ml-1.5 text-[11px] opacity-70">({count})</span>
        </button>
    );

    return (
        <div>
            <SectionHeader
                eyebrow="Operations"
                title="Players"
                lead="Online presence, op grants, bans, and whitelist. Linked accounts surface external identifiers from your manager users."
                action={<Pill tone={isWhitelistMode ? 'primary' : 'neutral'}>{isWhitelistMode ? 'Whitelist mode' : 'Blacklist mode'}</Pill>}
            />

            <div className="flex gap-1 mb-6">
                <TabButton id="all" label="All" count={counts.all} />
                <TabButton id="online" label="Online" count={counts.online} />
                <TabButton id="whitelist" label="Whitelist" count={counts.whitelist} />
                <TabButton id="banned" label="Banned" count={counts.banned} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map((p) => (
                    <button
                        key={p.uuid}
                        onClick={() => currentServerId && setSelectedPlayer({ ...p, serverId: currentServerId })}
                        className="text-left p-5 rounded-lg bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]/30 transition-colors"
                    >
                        <div className="flex items-start gap-4">
                            <img
                                src={p.avatarUrl}
                                alt={p.name}
                                onError={(e) => ((e.target as HTMLImageElement).src = 'https://minotar.net/helm/MHF_Steve/100.png')}
                                className={`w-14 h-14 rounded-md ${!p.isOnline ? 'grayscale opacity-70' : ''}`}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[16px] text-[color:var(--color-ink)] font-medium truncate">{p.name}</h3>
                                    {p.isOp && <Crown size={14} className="text-[color:var(--color-accent-ochre)]" />}
                                </div>
                                <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1 truncate">{p.uuid.substring(0, 16)}…</div>
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {p.isOnline && <Pill tone="success">Online</Pill>}
                                    {p.isBanned && <Pill tone="error">Banned</Pill>}
                                    {p.isWhitelisted && <Pill tone="primary">Whitelist</Pill>}
                                    {p.linkedUser && <Pill tone="neutral">Linked</Pill>}
                                </div>
                                <div className="flex items-center gap-1 mt-3 text-[11px] text-[color:var(--color-muted)]">
                                    <Clock size={11} />
                                    {p.isOnline ? 'Online now' : new Date(p.lastLogin).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
                {filteredPlayers.length === 0 && (
                    <div className="col-span-full text-center py-16 text-[14px] text-[color:var(--color-muted)]">No players match this view.</div>
                )}
            </div>

            {selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[color:var(--color-ink)]/40" onClick={() => setSelectedPlayer(null)} />
                    <Card tone="canvas" padded={false} className="relative w-full max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-start justify-between p-6 border-b border-[color:var(--color-hairline)]">
                            <div className="flex items-start gap-4">
                                <img src={selectedPlayer.avatarUrl} alt={selectedPlayer.name} className={`w-14 h-14 rounded-md ${!selectedPlayer.isOnline ? 'grayscale opacity-70' : ''}`} />
                                <div>
                                    <h3 className="display-sm">{selectedPlayer.name}</h3>
                                    <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1 break-all">{selectedPlayer.uuid}</div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {selectedPlayer.isOp && <Pill tone="warning">OP</Pill>}
                                        {selectedPlayer.isBanned && <Pill tone="error">Banned</Pill>}
                                        {selectedPlayer.isWhitelisted && <Pill tone="primary">Whitelist</Pill>}
                                        {selectedPlayer.linkedUser && <Pill tone="neutral">Linked</Pill>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPlayer(null)} className="p-1 text-[color:var(--color-muted)]"><X size={16} /></button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            {selectedPlayer.linkedUser && Object.keys(selectedPlayer.linkedUser.externalIds).length > 0 && (
                                <Card tone="cream" padded className="mb-5">
                                    <Eyebrow className="mb-3 flex items-center gap-2"><LinkIcon size={11} /> Linked accounts</Eyebrow>
                                    <div className="space-y-2">
                                        {Object.entries(selectedPlayer.linkedUser.externalIds).map(([platform, id]) => (
                                            <div key={platform} className="flex items-center justify-between gap-3">
                                                <Pill tone="neutral">{platform}</Pill>
                                                <span className="font-mono text-[12px] text-[color:var(--color-ink)] flex-1 truncate">{id}</span>
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(String(id)); notify?.('Copied', 'info'); }}
                                                    className="p-1 text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            <Eyebrow className="mb-3">Actions</Eyebrow>
                            <div className="grid grid-cols-2 gap-2 mb-5">
                                {selectedPlayer.isOp ? (
                                    <Button variant="secondary" onClick={() => handleAction('deop')} disabled={actionLoading}><Shield size={14} /> Revoke OP</Button>
                                ) : (
                                    <Button variant="secondary" onClick={() => handleAction('op')} disabled={actionLoading}><Crown size={14} /> Grant OP</Button>
                                )}
                                {selectedPlayer.isBanned ? (
                                    <Button variant="secondary" onClick={() => handleAction('pardon')} disabled={actionLoading}><CheckCircle size={14} /> Unban</Button>
                                ) : (
                                    <Button variant="danger" onClick={() => handleAction('ban')} disabled={actionLoading}><Ban size={14} /> Ban</Button>
                                )}
                                <Button variant="secondary" onClick={() => handleAction('kick')} disabled={actionLoading || !selectedPlayer.isOnline}>
                                    <LogOut size={14} /> Kick
                                </Button>
                                {selectedPlayer.isWhitelisted ? (
                                    <Button variant="secondary" onClick={() => handleAction('whitelist_remove')} disabled={actionLoading}><UserX size={14} /> Un-whitelist</Button>
                                ) : (
                                    <Button variant="secondary" onClick={() => handleAction('whitelist_add')} disabled={actionLoading}><UserCheck size={14} /> Whitelist</Button>
                                )}
                            </div>

                            <Eyebrow className="mb-2 flex items-center gap-2"><MessageSquare size={11} /> Whisper</Eyebrow>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder={`Message ${selectedPlayer.name}…`}
                                    disabled={!selectedPlayer.isOnline}
                                    className="flex-1 h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] text-[14px] disabled:opacity-50"
                                />
                                <Button onClick={() => handleAction('message', messageInput)} disabled={!messageInput.trim() || !selectedPlayer.isOnline || actionLoading}>
                                    Send
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
