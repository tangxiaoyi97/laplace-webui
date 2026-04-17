import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, FolderOpen, Users, Server, LogOut, Terminal, FileText, XCircle, CheckCircle, AlertCircle, Settings, Archive } from 'lucide-react';
import Dashboard from './components/Dashboard.tsx';
import ServerWizard from './components/ServerWizard.tsx';
import FileManager from './components/FileManager.tsx';
import PlayerManager from './components/PlayerManager.tsx';
import LogsView from './components/LogsView.tsx';
import ServerSettings from './components/ServerSettings.tsx';
import BackupManager from './components/BackupManager.tsx';
import PublicHome from './components/PublicHome.tsx';
import { ViewState } from './types.ts';
import { clearStoredToken, fetchAuthed, getStoredToken, setStoredToken } from './lib/api.ts';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
      const handlePopState = () => setCurrentPath(window.location.pathname);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/' || currentPath === '/index') return <PublicHome />;
  if (currentPath.startsWith('/dashboard')) return <AdminPanel />;
  return <PublicHome />;
}

function AdminPanel() {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasServer, setHasServer] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tokenInput, setTokenInput] = useState('');

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const readTokenFromLocation = (): string | null => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      return hashParams.get('token');
  };

  // 1. Initial Token Check
  useEffect(() => {
    const urlToken = readTokenFromLocation();
    
    if (urlToken) {
      setStoredToken(urlToken);
      window.history.replaceState({}, '', '/dashboard');
    }

    const storedToken = getStoredToken();
    if (storedToken) {
        verifyToken();
    } else {
        setLoading(false);
    }
  }, []);

  // 2. Server Status Polling
  useEffect(() => {
      if (!auth) return;

      checkServerStatus();

      const interval = setInterval(() => {
          checkServerStatus();
      }, 10000);

      return () => clearInterval(interval);
  }, [auth]);

  const verifyToken = async () => {
      try {
          const res = await fetchAuthed('/auth/check');
          
          if (res.ok) {
              setAuth(true);
          } else {
              cleanupAuth();
          }
      } catch (e) { 
          console.error("Auth check failed", e);
          cleanupAuth();
      } finally {
          setLoading(false);
      }
  };

  const cleanupAuth = () => {
      clearStoredToken();
      setAuth(false);
      setTokenInput('');
  };

  const checkServerStatus = async () => {
      try {
          const res = await fetchAuthed('/server/status');
          const response = await res.json();
          if (response.success && response.data) {
              const active = !!response.data.activeServerId;
              setHasServer(active);
              if (!active && view !== ViewState.DASHBOARD && view !== ViewState.SERVER_WIZARD) {
                  setView(ViewState.DASHBOARD);
              }
          }
      } catch (e) { }
  }

  const handleLogout = () => {
    cleanupAuth();
    window.location.href='/';
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-laplace-bg">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-laplace-primary"></div>
    </div>
  );

  if (!auth) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-laplace-bg p-4 relative overflow-hidden">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-laplace-primary/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>

              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-laplace-primary mb-6 shadow-soft z-10">
                  <Terminal size={40} />
              </div>
              <h1 className="text-3xl font-black text-laplace-darker mb-2 z-10">Access Restricted</h1>
              <p className="text-gray-400 text-center max-w-sm mb-6 z-10">Security Checkpoint. Use the token provided in your server console.</p>
              <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-4 mb-4 z-10 shadow-soft">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.trim())}
                    placeholder="Paste admin token"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-laplace-primary text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!tokenInput) return;
                      setStoredToken(tokenInput);
                      await verifyToken();
                    }}
                    className="w-full mt-3 px-4 py-2 rounded-xl bg-laplace-primary text-white text-sm font-bold hover:bg-opacity-90 transition-all"
                  >
                    Verify Token
                  </button>
              </div>
              <button onClick={() => window.location.href = '/'} className="px-6 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:text-laplace-primary hover:border-laplace-primary/30 transition-all z-10">
                  Return Home
              </button>
          </div>
      );
  }

  const NavItem = ({ v, icon: Icon, label, disabled }: any) => (
      <button 
        onClick={() => !disabled && setView(v)}
        disabled={disabled}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group
            ${view === v 
                ? 'bg-laplace-primary text-white shadow-lg shadow-laplace-primary/30' 
                : 'text-gray-500 hover:bg-white hover:shadow-soft hover:text-laplace-darker'}
            ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        `}
      >
          <Icon size={20} className={view === v ? 'text-white' : 'text-gray-400 group-hover:text-laplace-primary transition-colors'} />
          <span className="font-semibold text-sm tracking-tight">{label}</span>
      </button>
  );

  const renderView = () => {
      const props = { notify };
      switch (view) {
          case ViewState.DASHBOARD: return <Dashboard onNavigate={setView} {...props} />;
          case ViewState.SERVER_WIZARD: return <ServerWizard onViewChange={(v) => { setHasServer(true); setView(v); }} {...props} />;
          case ViewState.FILES: return <FileManager {...props} />;
          case ViewState.PLAYERS: return <PlayerManager {...props} />;
          case ViewState.LOGS: return <LogsView {...props} />;
          case ViewState.SETTINGS: return <ServerSettings {...props} />;
          case ViewState.BACKUPS: return <BackupManager {...props} />;
          default: return <Dashboard onNavigate={setView} {...props} />;
      }
  };

  return (
    <div className="flex h-screen bg-laplace-bg p-2 sm:p-4 overflow-hidden relative font-sans">
        <div className="fixed top-6 right-6 z-50 flex flex-col space-y-3 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto flex items-center space-x-3 bg-white px-4 py-3 rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100 animate-fade-in min-w-[300px]">
                    {toast.type === 'success' && <div className="p-1 rounded-full bg-green-100 text-green-600"><CheckCircle size={16} /></div>}
                    {toast.type === 'error' && <div className="p-1 rounded-full bg-red-100 text-red-600"><XCircle size={16} /></div>}
                    {toast.type === 'info' && <div className="p-1 rounded-full bg-blue-100 text-blue-600"><AlertCircle size={16} /></div>}
                    <span className="text-sm font-semibold text-gray-700">{toast.message}</span>
                </div>
            ))}
        </div>

        <div className="w-64 flex flex-col pr-4 hidden md:flex">
            <div className="px-4 py-6 mb-4">
                <div className="flex items-center space-x-3 text-laplace-darker">
                    <div className="w-10 h-10 bg-gradient-to-br from-laplace-darker to-gray-800 text-white rounded-xl flex items-center justify-center shadow-lg shadow-gray-900/20">
                        <Terminal size={20} />
                    </div>
                    <div>
                        <h1 className="font-black text-lg leading-tight tracking-tight">Laplace</h1>
                        <p className="text-[10px] text-gray-400 font-mono bg-gray-200/50 px-1.5 py-0.5 rounded-md inline-block mt-1">v15.2</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 space-y-1.5">
                <NavItem v={ViewState.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
                <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Management</div>
                <NavItem v={ViewState.FILES} icon={FolderOpen} label="File System" disabled={!hasServer} />
                <NavItem v={ViewState.PLAYERS} icon={Users} label="Player Base" disabled={!hasServer} />
                <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">System</div>
                <NavItem v={ViewState.BACKUPS} icon={Archive} label="Snapshots" disabled={!hasServer} />
                <NavItem v={ViewState.LOGS} icon={FileText} label="Console Logs" disabled={!hasServer} />
                <NavItem v={ViewState.SETTINGS} icon={Settings} label="Configuration" disabled={!hasServer} />
                {!hasServer && <NavItem v={ViewState.SERVER_WIZARD} icon={Server} label="Setup Wizard" />}
            </nav>

            <div className="mt-auto pt-4 border-t border-laplace-border">
                <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors group"
                >
                    <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold text-sm">Disconnect</span>
                </button>
            </div>
        </div>

        <main className="flex-1 bg-white/60 backdrop-blur-xl rounded-[2rem] shadow-soft border border-white p-6 overflow-hidden relative flex flex-col">
            {renderView()}
        </main>
    </div>
  );
}
