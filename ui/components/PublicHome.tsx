import React, { useState, useEffect } from 'react';
import { Terminal, Users, Cpu, Activity, LogIn, Server } from 'lucide-react';
import type { PublicServerInfo } from '../types.ts';

export default function PublicHome() {
    const [info, setInfo] = useState<PublicServerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInfo = async () => {
        try {
            const res = await fetch('/api/public/info');
            if (res.ok) {
                const response = await res.json();
                if (response.success && response.data) {
                    setInfo(response.data);
                }
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchInfo();
        const interval = setInterval(fetchInfo, 5000);
        return () => clearInterval(interval);
    }, []);

    const goToLogin = () => {
        window.location.href = '/dashboard';
    };

    if (loading) return (
        <div className="min-h-screen bg-laplace-bg flex items-center justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-laplace-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-laplace-bg flex flex-col items-center p-4">
            
            <header className="w-full max-w-4xl flex justify-between items-center py-6 mb-12">
                <div className="flex items-center space-x-3 text-laplace-darker">
                    <div className="w-10 h-10 bg-laplace-darker text-white rounded-xl flex items-center justify-center shadow-lg">
                        <Terminal size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight tracking-tight">Laplace</h1>
                        <p className="text-[10px] text-gray-400 font-mono">PUBLIC ACCESS</p>
                    </div>
                </div>
                <button onClick={goToLogin} className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors font-bold text-sm">
                    <LogIn size={16} />
                    <span>Admin Login</span>
                </button>
            </header>

            <main className="w-full max-w-4xl space-y-6">
                
                {/* Status Hero */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full ${info?.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                        <div>
                            <h2 className="text-4xl font-black text-laplace-darker mb-2">{info?.name || 'Minecraft Server'}</h2>
                            <p className="text-gray-500 text-lg font-medium">{info?.motd}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-full font-bold text-sm mt-4 md:mt-0 flex items-center gap-2 ${info?.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            <Activity size={16} />
                            {info?.status || 'OFFLINE'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-xs font-bold uppercase block mb-1">Players</span>
                            <span className="text-2xl font-bold text-laplace-darker">{info?.players.online} / {info?.players.max}</span>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-xs font-bold uppercase block mb-1">Version</span>
                            <span className="text-2xl font-bold text-laplace-darker">{info?.version}</span>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-xs font-bold uppercase block mb-1">Core</span>
                            <span className="text-2xl font-bold text-laplace-darker">{info?.coreType}</span>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-xs font-bold uppercase block mb-1">Last Updated</span>
                            <span className="text-xs font-bold text-gray-500">{new Date(info?.lastUpdated || Date.now()).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>

                {/* Player List */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-laplace-darker mb-6 flex items-center gap-2">
                        <Users className="text-laplace-primary" /> Online Players
                    </h3>
                    
                    {info?.players.list && info.players.list.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {info.players.list.map((name, idx) => (
                                <div key={idx} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <img src={`https://minotar.net/helm/${name}/40.png`} className="w-8 h-8 rounded-lg" alt={name} />
                                    <span className="font-bold text-sm text-gray-700 truncate">{name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <Users size={48} className="mx-auto mb-2 opacity-20" />
                            <p>No players currently online.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-gray-400 text-xs py-6">
                    Powered by Laplace Control Panel
                </div>
            </main>
        </div>
    );
}