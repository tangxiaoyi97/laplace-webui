import React, { useState, useEffect } from 'react';
import { Archive, Plus, Trash2, RotateCw, RotateCcw, Clock, HardDrive, AlertTriangle, Lock, Download } from 'lucide-react';
import type { BackupItem } from '../types.ts';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function BackupManager({ notify }: Props) {
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [status, setStatus] = useState<string>('OFFLINE');

    const getTokenHeader = () => `laplace@${localStorage.getItem('laplace_token') || ''}`;

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, sRes] = await Promise.all([
                fetch('http://localhost:11228/api/backups', { headers: { 'x-auth-token': getTokenHeader() } }),
                fetch('http://localhost:11228/api/server/status', { headers: { 'x-auth-token': getTokenHeader() } })
            ]);

            const bData = await bRes.json();
            const sData = await sRes.json();

            if (bRes.ok && bData.success && Array.isArray(bData.data)) setBackups(bData.data);
            if (sRes.ok && sData.success) {
                setStatus(sData.data.status);
            }
        } catch (e) {
            console.error(e);
            notify?.('Failed to load backup data', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreate = async () => {
        if (status !== 'OFFLINE') {
            notify?.('Server must be OFFLINE to create a backup.', 'error');
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('http://localhost:11228/api/backups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getTokenHeader() },
                body: JSON.stringify({}) // Can add name support later
            });
            const response = await res.json();
            if (res.ok && response.success) {
                notify?.('Backup created successfully', 'success');
                fetchData();
            } else {
                notify?.(response.error || 'Failed to create backup', 'error');
            }
        } catch (e) {
            notify?.('Network error', 'error');
        }
        setCreating(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this backup?')) return;
        try {
            const res = await fetch('http://localhost:11228/api/backups/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getTokenHeader() },
                body: JSON.stringify({ id })
            });
            const response = await res.json();
            if (res.ok && response.success) {
                fetchData();
                notify?.('Backup deleted', 'success');
            } else {
                notify?.(response.error || 'Delete failed', 'error');
            }
        } catch (e) {
            notify?.('Delete error', 'error');
        }
    };

    const handleRestore = async (id: string) => {
        // Double Check Client Side
        if (status !== 'OFFLINE') {
            notify?.('Action Blocked: Server must be OFFLINE to restore.', 'error');
            return;
        }
        if (!confirm('WARNING: This will overwrite your current server files. Are you sure?')) return;
        
        try {
            notify?.('Restore started. Please wait...', 'info');
            const res = await fetch('http://localhost:11228/api/backups/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getTokenHeader() },
                body: JSON.stringify({ id })
            });
            const response = await res.json();
            if (res.ok && response.success) {
                notify?.('Server restored successfully', 'success');
            } else {
                notify?.(response.error || 'Restore failed', 'error');
            }
        } catch (e) {
            notify?.('Restore error', 'error');
        }
    };

    const handleDownload = (id: string) => {
        // Direct browser download via new tab using cookie for auth
        window.open(`http://localhost:11228/api/backups/download?id=${id}`, '_blank');
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const isLocked = status !== 'OFFLINE';

    return (
        <div className="h-full flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div>
                    <h2 className="text-2xl font-bold text-laplace-darker flex items-center gap-2">
                        <Archive className="text-laplace-primary" /> System Backups
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Manage snapshots and restore points.</p>
                </div>
                <div>
                    <button 
                        onClick={handleCreate} 
                        disabled={creating || isLocked}
                        className="px-6 py-2 bg-laplace-primary text-white rounded-xl font-bold flex items-center space-x-2 hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isLocked ? "Server must be offline to create backup" : ""}
                    >
                        {creating ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> : <Plus size={18} />}
                        <span>Create Backup</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {backups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Archive size={48} className="mb-4 opacity-20" />
                        <p>No backups available.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {backups.map(backup => (
                            <div key={backup.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-white rounded-xl border border-gray-200">
                                        <HardDrive className="text-gray-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-laplace-darker text-sm">{backup.name}</h3>
                                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Clock size={12}/> {new Date(backup.timestamp).toLocaleString()}</span>
                                            <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded">{formatSize(backup.size)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => handleRestore(backup.id)}
                                        disabled={isLocked}
                                        className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 border rounded-xl text-xs font-bold transition-colors 
                                            ${isLocked 
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                                : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700'
                                            }`}
                                        title={isLocked ? "Cannot restore while server is online" : "Restore this backup"}
                                    >
                                        {isLocked ? <Lock size={14} /> : <RotateCcw size={14} />}
                                        <span>Restore</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleDownload(backup.id)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                                        title="Download (Feature limited to Single File backups)"
                                    >
                                        <Download size={18} />
                                    </button>

                                    <button 
                                        onClick={() => handleDelete(backup.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

             {/* Footer Warning */}
            <div className={`p-4 border-t text-xs flex items-center gap-2 ${isLocked ? 'bg-red-50 border-red-100 text-red-700' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
                {isLocked ? <Lock size={16}/> : <AlertTriangle size={16} />}
                <span>
                    {isLocked 
                        ? "Backup creation and restoration are disabled because the server is currently online. Please stop the server first." 
                        : "Restoring a backup will overwrite your current server files."}
                </span>
            </div>
        </div>
    );
}