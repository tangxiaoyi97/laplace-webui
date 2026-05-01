import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, WifiOff } from 'lucide-react';
import type { WSMessage, LogEntry } from '../types.ts';
import { getWebSocketProtocol, getWebSocketUrl } from '../lib/api.ts';

interface Props {
    serverRunning: boolean;
    currentServerId: string | null;
}

export default function Terminal({ serverRunning, currentServerId }: Props) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [connected, setConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldScrollRef = useRef(true);
    const serverIdRef = useRef<string | null>(currentServerId);

    useEffect(() => {
        serverIdRef.current = currentServerId;
        // When the focused server changes, wipe the buffer so we don't mix logs from another server.
        setLogs([]);
    }, [currentServerId]);

    const sendFocus = (ws: WebSocket | null, id: string | null) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try { ws.send(JSON.stringify({ type: 'FOCUS', serverIds: id ? [id] : [] })); } catch { /* ignore */ }
    };

    const connect = () => {
        const wsProtocol = getWebSocketProtocol();
        if (!wsProtocol) { setConnected(false); return; }

        const ws = new WebSocket(getWebSocketUrl(), wsProtocol);
        ws.onopen = () => {
            setConnected(true);
            // Tell the server to only stream the focused server's events.
            sendFocus(ws, serverIdRef.current);
        };
        ws.onmessage = (event) => {
            const msg: WSMessage = JSON.parse(event.data);
            if (msg.type === 'LOG') {
                // Belt-and-braces: even if server-side filtering misses, drop foreign logs.
                if (msg.serverId && msg.serverId !== serverIdRef.current) return;
                setLogs((prev) => {
                    const next = [...prev, msg.payload];
                    if (next.length > 500) return next.slice(-500);
                    return next;
                });
            }
        };
        ws.onclose = () => {
            setConnected(false);
            setTimeout(connect, 3000);
        };
        wsRef.current = ws;
    };

    useEffect(() => {
        connect();
        return () => wsRef.current?.close();
    }, []);

    // Re-emit FOCUS whenever the active server changes.
    useEffect(() => {
        sendFocus(wsRef.current, currentServerId);
    }, [currentServerId]);

    useEffect(() => {
        if (shouldScrollRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 20;
    };

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !wsRef.current || !currentServerId) return;
        wsRef.current.send(JSON.stringify({ type: 'COMMAND', command: input, serverId: currentServerId }));
        setHistory((prev) => [...prev, input]);
        setHistoryIndex(-1);
        setInput('');
        shouldScrollRef.current = true;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = Math.min(history.length - 1, historyIndex + 1);
                setHistoryIndex(newIndex === history.length - 1 ? -1 : newIndex);
                setInput(newIndex === history.length - 1 ? '' : history[newIndex]);
            }
        }
    };

    return (
        <div className="flex flex-col h-[480px] font-mono text-[13px]">
            <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2 text-[color:var(--color-on-dark-soft)]">
                    <TerminalIcon size={13} />
                    <span className="eyebrow text-[10px] text-[color:var(--color-on-dark-soft)]">Console · {currentServerId || 'no server'}</span>
                </div>
                <div className="flex items-center gap-2 text-[color:var(--color-on-dark-soft)] text-[11px]">
                    {!connected && <span className="flex items-center gap-1 text-[color:var(--color-error)]"><WifiOff size={10} /> disconnected</span>}
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: connected && serverRunning ? 'var(--color-success)' : 'var(--color-error)' }} />
                </div>
            </div>

            <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                {logs.length === 0 ? (
                    <div className="text-[color:var(--color-on-dark-soft)] text-[12px] italic">Waiting for output…</div>
                ) : null}
                {logs.map((log, i) => {
                    const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
                    let color = 'var(--color-on-dark)';
                    if (log.type === 'error') color = '#e08487';
                    else if (log.type === 'warn') color = '#d8b16d';
                    else if (log.message.startsWith('>') || log.message.startsWith('[')) color = 'var(--color-accent-sage)';
                    return (
                        <div key={i} className="leading-snug break-words">
                            <span className="text-[color:var(--color-on-dark-soft)] mr-3 select-none text-[11px]">{time}</span>
                            <span style={{ color }}>{log.message}</span>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={send} className="px-5 py-3 border-t border-white/10 flex items-center gap-3">
                <span className="text-[color:var(--color-primary)]">›</span>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!connected || !serverRunning || !currentServerId}
                    className="flex-1 bg-transparent text-[color:var(--color-on-dark)] focus:outline-none placeholder:text-[color:var(--color-on-dark-soft)] disabled:cursor-not-allowed"
                    placeholder={!connected ? 'Reconnecting…' : !currentServerId ? 'Pick a server' : !serverRunning ? 'Start the server to enable terminal' : 'Enter command'}
                />
            </form>
        </div>
    );
}
