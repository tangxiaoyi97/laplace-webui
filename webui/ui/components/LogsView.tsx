import React, { useState, useEffect, useRef } from 'react';
import { FileText, RefreshCw, Download } from 'lucide-react';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function LogsView({ notify }: Props) {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('laplace_token') || '';
            const res = await fetch('http://localhost:11228/api/server/logs/history', {
                headers: { 'x-auth-token': `laplace@${token}` }
            });
            const response = await res.json();
            if (response.success && response.data) {
                setLogs(response.data.logs || 'No logs found.');
                // Scroll to bottom
                setTimeout(() => {
                    if (textRef.current) textRef.current.scrollTop = textRef.current.scrollHeight;
                }, 100);
            } else {
                setLogs('Failed to load logs.');
                notify?.('Failed to load logs', 'error');
            }
        } catch (e) {
            console.error(e);
            setLogs('Failed to load logs.');
            notify?.('Failed to load logs', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([logs], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "laplace-full.log";
        document.body.appendChild(element); 
        element.click();
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <div>
                    <h2 className="text-2xl font-bold text-laplace-darker flex items-center gap-2">
                        <FileText className="text-laplace-primary" /> Server History
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Full content of laplace.log</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={handleDownload} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" title="Download Log">
                        <Download size={20} />
                    </button>
                    <button onClick={fetchLogs} disabled={loading} className={`p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors ${loading ? 'animate-spin' : ''}`} title="Refresh">
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 bg-laplace-black p-4 overflow-hidden relative group">
                <textarea 
                    ref={textRef}
                    className="w-full h-full bg-transparent text-gray-300 font-mono text-xs resize-none focus:outline-none scrollbar-thin scrollbar-thumb-gray-700"
                    value={logs}
                    readOnly
                />
            </div>
        </div>
    );
}