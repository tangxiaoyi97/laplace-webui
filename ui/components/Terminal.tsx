import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Send, WifiOff } from 'lucide-react';
import type { WSMessage, LogEntry } from '../types.ts';
import { getWebSocketProtocol, getWebSocketUrl } from '../lib/api.ts';

interface Props {
    serverRunning: boolean;
}

export default function Terminal({ serverRunning }: Props) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [connected, setConnected] = useState(false);
    
    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldScrollRef = useRef(true);

    const connect = () => {
        const wsProtocol = getWebSocketProtocol();
        if (!wsProtocol) {
            setConnected(false);
            return;
        }

        const ws = new WebSocket(getWebSocketUrl(), wsProtocol);
        
        ws.onopen = () => setConnected(true);
        
        ws.onmessage = (event) => {
            const msg: WSMessage = JSON.parse(event.data);
            if (msg.type === 'LOG') {
                setLogs(prev => {
                    const newLogs = [...prev, msg.payload];
                    // Limit client-side memory
                    if (newLogs.length > 500) return newLogs.slice(-500);
                    return newLogs;
                });
            }
        };

        ws.onclose = () => {
            setConnected(false);
            // Auto reconnect after 3s
            setTimeout(connect, 3000);
        };

        wsRef.current = ws;
    };

    useEffect(() => {
        connect();
        return () => wsRef.current?.close();
    }, []);

    // Smart Scroll: Only scroll if user was already at bottom
    useEffect(() => {
        if (shouldScrollRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        // 20px tolerance
        shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 20;
    };

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !wsRef.current) return;

        wsRef.current.send(JSON.stringify({ type: 'COMMAND', command: input }));
        setHistory(prev => [...prev, input]);
        setHistoryIndex(-1);
        setInput('');
        shouldScrollRef.current = true; // Force scroll on user action
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
        <div className="flex flex-col h-full bg-laplace-black rounded-2xl overflow-hidden border border-gray-800 shadow-inner font-mono text-sm relative">
            <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center space-x-2 text-gray-400">
                    <TerminalIcon size={14} />
                    <span className="text-xs font-bold tracking-wider">TERMINAL</span>
                </div>
                <div className="flex items-center space-x-2">
                    {!connected && <span className="text-[10px] text-red-500 flex items-center gap-1"><WifiOff size={10}/> DISCONNECTED</span>}
                    <div className={`w-2 h-2 rounded-full ${connected && serverRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                </div>
            </div>

            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            >
                {logs.map((log, i) => (
                    <div key={i} className="break-words leading-tight hover:bg-gray-800/50 rounded px-1">
                        <span className="text-gray-600 mr-3 select-none text-[10px] inline-block w-[70px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`${
                            log.type === 'error' ? 'text-red-400' : 
                            log.type === 'warn' ? 'text-yellow-400' :
                            log.message.startsWith('>') ? 'text-cyan-400 font-bold' : 
                            'text-gray-300'
                        }`}>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>

            <form onSubmit={send} className="bg-gray-900 p-2 flex relative border-t border-gray-800">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500 font-bold">{'>'}</span>
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!connected}
                    className="w-full bg-transparent text-gray-100 pl-6 pr-10 py-2 focus:outline-none placeholder:text-gray-700 disabled:cursor-not-allowed"
                    placeholder={!connected ? "Reconnecting..." : serverRunning ? "Enter command..." : "Start server to enable terminal"}
                />
            </form>
        </div>
    );
}
