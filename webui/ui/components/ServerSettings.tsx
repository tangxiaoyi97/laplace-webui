import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Cpu, Layers, Shield, Globe, Terminal, Info } from 'lucide-react';
import type { ServerConfig, ServerSettingsPayload } from '../types.ts';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ServerSettings({ notify }: Props) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<ServerConfig | null>(null);
    const [properties, setProperties] = useState<Record<string, string>>({});
    
    // Quick Settings State
    const [quickSettings, setQuickSettings] = useState({
        motd: '',
        maxPlayers: '20',
        port: '25565',
        whitelist: false,
        viewDistance: '10'
    });

    const getTokenHeader = () => `laplace@${localStorage.getItem('laplace_token') || ''}`;

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:11228/api/server/settings', {
                headers: { 'x-auth-token': getTokenHeader() }
            });
            const response = await res.json();
            
            if (res.ok && response.success) {
                const data: ServerSettingsPayload = response.data;
                setConfig(data.config);
                setProperties(data.properties);
                
                // Map to quick settings
                setQuickSettings({
                    motd: data.properties['motd'] || '',
                    maxPlayers: data.properties['max-players'] || '20',
                    port: data.properties['server-port'] || '25565',
                    whitelist: data.properties['white-list'] === 'true',
                    viewDistance: data.properties['view-distance'] || '10'
                });
            } else {
                notify?.('Failed to load settings', 'error');
            }
        } catch (e) {
            notify?.('Network error', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        
        // Merge quick settings back into properties
        const updatedProperties = { ...properties };
        updatedProperties['motd'] = quickSettings.motd;
        updatedProperties['max-players'] = quickSettings.maxPlayers;
        updatedProperties['server-port'] = quickSettings.port;
        updatedProperties['white-list'] = quickSettings.whitelist ? 'true' : 'false';
        updatedProperties['view-distance'] = quickSettings.viewDistance;

        try {
            const res = await fetch('http://localhost:11228/api/server/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-token': getTokenHeader() 
                },
                body: JSON.stringify({
                    config: config,
                    properties: updatedProperties
                })
            });
            const response = await res.json();

            if (res.ok && response.success) {
                notify?.('Settings saved. Restart server to apply.', 'success');
                // Refresh to ensure sync
                fetchSettings();
            } else {
                notify?.(response.error || 'Failed to save settings', 'error');
            }
        } catch (e) {
            notify?.('Network error saving settings', 'error');
        }
        setSaving(false);
    };

    const handleRawPropertyChange = (key: string, value: string) => {
        setProperties(prev => ({ ...prev, [key]: value }));
    };

    const handleConfigChange = (section: keyof ServerConfig['javaArgs'], value: string) => {
        if (!config) return;
        setConfig({
            ...config,
            javaArgs: {
                ...config.javaArgs,
                [section]: value
            }
        });
    };

    if (loading) return (
        <div className="h-full flex items-center justify-center text-gray-400">
            <RefreshCw className="animate-spin mr-2" /> Loading settings...
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
            
            {/* Header / Actions */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div>
                    <h2 className="text-2xl font-bold text-laplace-darker flex items-center gap-2">
                        <Settings className="text-laplace-primary" /> Server Configuration
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Manage gameplay settings and startup parameters.</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={fetchSettings} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" title="Reload">
                        <RefreshCw size={20} />
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="px-6 py-2 bg-laplace-primary text-white rounded-xl font-bold flex items-center space-x-2 hover:bg-opacity-90 transition-all disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        <span>Save Changes</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* 1. Startup Logic */}
                <section>
                    <div className="flex items-center gap-2 mb-4 text-laplace-darker font-bold">
                        <Terminal size={18} />
                        <h3>Startup Parameters</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Max RAM (Xmx)</label>
                            <input 
                                type="text" 
                                value={config?.javaArgs.xmx || ''} 
                                onChange={(e) => handleConfigChange('xmx', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Start RAM (Xms)</label>
                            <input 
                                type="text" 
                                value={config?.javaArgs.xms || ''} 
                                onChange={(e) => handleConfigChange('xms', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                         <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Java Flags</label>
                            <input 
                                type="text" 
                                value={config?.javaArgs.args || ''} 
                                onChange={(e) => handleConfigChange('args', e.target.value)}
                                placeholder="-XX:+UseG1GC..."
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                    </div>
                </section>

                {/* 2. Common Properties */}
                <section>
                    <div className="flex items-center gap-2 mb-4 text-laplace-darker font-bold">
                        <Globe size={18} />
                        <h3>Gameplay Settings</h3>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Whitelist Toggle */}
                        <div className="flex items-center justify-between col-span-full pb-6 border-b border-gray-200">
                            <div>
                                <h4 className="font-bold text-gray-700">Access Mode</h4>
                                <p className="text-xs text-gray-400 mt-1">Determines who can join the server.</p>
                            </div>
                            <div className="flex items-center bg-gray-200 rounded-lg p-1">
                                <button 
                                    onClick={() => setQuickSettings({...quickSettings, whitelist: false})}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${!quickSettings.whitelist ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
                                >
                                    Blacklist Mode
                                </button>
                                <button 
                                    onClick={() => setQuickSettings({...quickSettings, whitelist: true})}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${quickSettings.whitelist ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}
                                >
                                    Whitelist Mode
                                </button>
                            </div>
                        </div>

                        {/* Fields */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Server Name (MOTD)</label>
                            <input 
                                type="text" 
                                value={quickSettings.motd} 
                                onChange={(e) => setQuickSettings({...quickSettings, motd: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Max Players</label>
                            <input 
                                type="number" 
                                value={quickSettings.maxPlayers} 
                                onChange={(e) => setQuickSettings({...quickSettings, maxPlayers: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">View Distance</label>
                            <input 
                                type="number" 
                                value={quickSettings.viewDistance} 
                                onChange={(e) => setQuickSettings({...quickSettings, viewDistance: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-laplace-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Server Port</label>
                            <input 
                                type="text" 
                                value={quickSettings.port} 
                                disabled
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Port changes require manual property file editing.</p>
                        </div>

                    </div>
                </section>

                {/* 3. Raw Editor */}
                <section>
                     <div className="flex items-center gap-2 mb-4 text-laplace-darker font-bold">
                        <Layers size={18} />
                        <h3>Advanced Properties</h3>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-800">
                                    <th className="py-2 w-1/3">Property Key</th>
                                    <th className="py-2">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(properties).map(([key, value]) => (
                                    <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                        <td className="py-2 text-blue-400 pr-4">{key}</td>
                                        <td className="py-2">
                                            <input 
                                                type="text" 
                                                value={value} 
                                                onChange={(e) => handleRawPropertyChange(key, e.target.value)}
                                                className="bg-transparent text-gray-300 w-full focus:outline-none focus:text-white"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>
        </div>
    );
}