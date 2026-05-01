import React, { useState, useEffect } from 'react';
import { LogIn, ChevronRight } from 'lucide-react';
import type { PublicServerInfo } from '../types.ts';
import { Card, Eyebrow, StatusDot, Pill } from './primitives.tsx';

export default function PublicHome() {
    const [info, setInfo] = useState<PublicServerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInfo = async () => {
        try {
            const res = await fetch('/api/public/info');
            if (res.ok) {
                const response = await res.json();
                if (response.success && response.data) setInfo(response.data);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        fetchInfo();
        const interval = setInterval(fetchInfo, 5000);
        return () => clearInterval(interval);
    }, []);

    const goToLogin = () => { window.location.href = '/dashboard'; };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[color:var(--color-canvas)]">
                <div className="w-5 h-5 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[color:var(--color-canvas)] flex flex-col">
            <header className="w-full max-w-[1200px] mx-auto px-8 py-6 flex items-center justify-between">
                <div className="font-display text-[24px] tracking-[-0.6px] text-[color:var(--color-ink)]">laplace</div>
                <button
                    onClick={goToLogin}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[13px] text-[color:var(--color-ink)] border border-[color:var(--color-hairline)] hover:bg-[color:var(--color-surface-soft)]"
                >
                    <LogIn size={14} /> Admin sign in
                </button>
            </header>

            <main className="w-full max-w-[1200px] mx-auto px-8 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <section className="lg:col-span-7">
                    <Eyebrow className="mb-5">Public status</Eyebrow>
                    <h1 className="display-xl mb-5">{info?.name || 'Minecraft server'}.</h1>
                    <p className="text-[18px] text-[color:var(--color-body-strong)] max-w-[40ch] leading-snug mb-6">
                        {info?.motd || 'A self-hosted, plainly run Minecraft server.'}
                    </p>
                    <div className="flex items-center gap-4">
                        <StatusDot status={info?.status || 'OFFLINE'} />
                        <span className="text-[13px] text-[color:var(--color-muted)]">
                            Last polled {new Date(info?.lastUpdated || Date.now()).toLocaleTimeString()}
                        </span>
                    </div>
                </section>

                <aside className="lg:col-span-5">
                    <Card tone="card" padded>
                        <div className="grid grid-cols-2 gap-y-5">
                            <Stat label="Players" value={`${info?.players.online ?? 0} / ${info?.players.max ?? 0}`} />
                            <Stat label="Version" value={info?.version || '—'} />
                            <Stat label="Core" value={info?.coreType || '—'} />
                            <Stat label="Status" value={info?.status || 'OFFLINE'} />
                        </div>
                    </Card>
                </aside>
            </main>

            <section className="w-full max-w-[1200px] mx-auto px-8 pb-20">
                <Eyebrow className="mb-4">Online now</Eyebrow>
                {info?.players.list && info.players.list.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {info.players.list.map((name, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-3 rounded-md bg-[color:var(--color-surface-soft)] border border-[color:var(--color-hairline)]"
                            >
                                <img src={`https://minotar.net/helm/${name}/40.png`} className="w-7 h-7 rounded" alt={name} />
                                <span className="text-[13px] text-[color:var(--color-ink)] font-medium truncate">{name}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[14px] text-[color:var(--color-muted)]">No players are connected right now.</p>
                )}
            </section>

            <footer className="border-t border-[color:var(--color-hairline)] py-6">
                <div className="max-w-[1200px] mx-auto px-8 flex items-center justify-between text-[12px] text-[color:var(--color-muted)]">
                    <span>Laplace control panel · Raspberry edition</span>
                    <button onClick={goToLogin} className="inline-flex items-center gap-1 hover:text-[color:var(--color-ink)]">
                        Open admin <ChevronRight size={12} />
                    </button>
                </div>
            </footer>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <Pill tone="neutral">{label}</Pill>
            <div className="font-display text-[28px] leading-tight tracking-[-0.4px] text-[color:var(--color-ink)] mt-2">{value}</div>
        </div>
    );
}
