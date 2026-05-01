import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { fetchScoped } from '../lib/api.ts';
import { Button, Card, SectionHeader } from './primitives.tsx';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
}

export default function LogsView({ notify, currentServerId }: Props) {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const generationRef = useRef(0);

    useEffect(() => { setLogs(''); }, [currentServerId]);

    const fetchLogs = async () => {
        if (!currentServerId) return;
        const myGen = ++generationRef.current;
        setLoading(true);
        try {
            const res = await fetchScoped('/server/logs/history?lines=1200', currentServerId);
            const response = await res.json();
            if (generationRef.current !== myGen) return;
            if (response.success && response.data) {
                setLogs(response.data.logs || 'No logs found.');
                setTimeout(() => { if (textRef.current) textRef.current.scrollTop = textRef.current.scrollHeight; }, 100);
            } else {
                setLogs('Failed to load logs.');
                notify?.('Failed to load logs', 'error');
            }
        } catch {
            if (generationRef.current === myGen) {
                setLogs('Failed to load logs.');
                notify?.('Failed to load logs', 'error');
            }
        } finally {
            if (generationRef.current === myGen) setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [currentServerId]);

    const handleDownload = () => {
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'laplace-full.log';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <SectionHeader
                eyebrow="History"
                title="Console logs"
                lead="The persisted contents of laplace.log for the active server. Rolls over at 5 MB; the most recent five files are kept on disk."
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" size="md" onClick={handleDownload}><Download size={14} /> Export</Button>
                        <Button size="md" onClick={fetchLogs} loading={loading}><RefreshCw size={14} /> Refresh</Button>
                    </div>
                }
            />
            <Card tone="dark" padded={false} className="overflow-hidden">
                <textarea
                    ref={textRef}
                    className="w-full h-[640px] bg-transparent text-[color:var(--color-on-dark)] font-mono text-[12.5px] leading-relaxed resize-none focus:outline-none p-6"
                    value={logs}
                    readOnly
                />
            </Card>
        </div>
    );
}
