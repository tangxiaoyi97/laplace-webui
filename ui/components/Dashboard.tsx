import React, { useEffect, useState } from 'react';
import { Power, StopCircle, Plus, RotateCw } from 'lucide-react';
import { ViewState } from '../types.ts';
import type { ServerStatus } from '../types.ts';
import Terminal from './Terminal.tsx';
import { getAuthHeaders } from '../lib/api.ts';

const API_URL = '/api';

interface Props {
    onNavigate?: (view: ViewState) => void;
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({ onNavigate, notify }: Props) {
  const [status, setStatus] = useState<ServerStatus>({ running: false, activeServerId: null, status: 'OFFLINE' });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const poll = async () => {
        try {
            const res = await fetch(`${API_URL}/server/status`, { headers: getAuthHeaders() });
            if (res.ok) {
                const response = await res.json();
                if (response.success && response.data) {
                    const data = response.data;
                    setStatus(data);
                    if (data.status === 'ONLINE' || data.status === 'OFFLINE' || data.status === 'CRASHED') {
                        setProcessing(false);
                    } else {
                        setProcessing(true);
                    }
                }
            }
        } catch (e) { console.error("Poll failed", e); }
    };
    poll();
    const interval = setInterval(poll, 3000); 
    return () => clearInterval(interval);
  }, []);

  const isBusy = processing || Boolean(status.busy) || ['STARTING', 'STOPPING', 'RESTARTING'].includes(status.status);
  const busyLabel = status.busyScopes?.length ? status.busyScopes.join(', ') : 'panel-runtime';

  const handlePower = async (action: 'start' | 'stop' | 'restart') => {
      if (isBusy) return;
      if (action === 'start' && status.running) { notify?.('Server is already running', 'error'); return; }
      if (action === 'stop' && !status.running) { notify?.('Server is not running', 'error'); return; }

      setProcessing(true);
      try {
          const res = await fetch(`${API_URL}/server/${action}`, {
              method: 'POST',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' })
          });
          const response = await res.json();
          if (res.ok && response.success) {
              notify?.(`Server ${action} command sent`, 'success');
          } else {
              notify?.(response.error || 'Action failed', 'error');
              setProcessing(false);
          }
      } catch (e: any) { 
          notify?.('Connection failed', 'error');
          setProcessing(false);
          console.error(e); 
      }
  };

  if (!status.activeServerId && status.activeServerId !== undefined) {
      return (
          <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-laplace-accent rounded-full flex items-center justify-center text-laplace-primary mb-6 animate-bounce">
                  <Power size={48} />
              </div>
              <h2 className="text-3xl font-bold text-laplace-darker mb-2">Welcome to Laplace</h2>
              <p className="text-gray-400 max-w-md mb-8">No active server detected. Please deploy a core to begin.</p>
               <button 
                onClick={() => onNavigate?.(ViewState.SERVER_WIZARD)}
                className="flex items-center gap-2 px-8 py-4 bg-laplace-primary text-white rounded-2xl shadow-glow hover:scale-105 transition-transform font-bold"
               >
                   <Plus size={20} /> <span>Deploy New Server</span>
               </button>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-laplace-darker tracking-tight">{status.serverName || 'Dashboard'}</h2>
          <div className="flex items-center space-x-2 mt-1">
              <div className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.running ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${status.running ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </div>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-wide">{status.status}</p>
          </div>
        </div>
        <div className="flex space-x-3">
           {!status.running ? (
               <button 
                onClick={() => handlePower('start')} 
                disabled={isBusy}
                className="flex items-center space-x-2 px-6 py-3 bg-laplace-darker text-white rounded-xl shadow-lg shadow-gray-900/20 hover:bg-black transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
               >
                   <Power size={18} /> <span>{isBusy ? 'Working...' : 'Start Server'}</span>
               </button>
           ) : (
               <>
                   <button 
                    onClick={() => handlePower('restart')} 
                    disabled={isBusy}
                    className="flex items-center space-x-2 px-4 py-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                   >
                       <RotateCw size={18} /> <span>Restart</span>
                   </button>
                   <button 
                    onClick={() => handlePower('stop')} 
                    disabled={isBusy}
                    className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                   >
                       <StopCircle size={18} /> <span>Stop</span>
                   </button>
               </>
           )}
        </div>
      </div>

      {status.busy && (
        <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          Runtime operation in progress: {busyLabel}. Control actions are temporarily locked.
        </div>
      )}

      <div className="flex-1 bg-laplace-darker rounded-3xl p-1.5 overflow-hidden shadow-inner border border-gray-800 flex flex-col relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50"></div>
          <Terminal serverRunning={status.running} />
      </div>
    </div>
  );
}
