import React, { useState, useEffect } from 'react';
import type { Player, PlayerActionType } from '../types.ts';
import { 
    Clock, Shield, Ban, Star, MessageSquare, LogOut, Trash2, 
    MoreHorizontal, X, User, Crown, AlertTriangle, CheckCircle, List, UserCheck, UserX, Link as LinkIcon,
    Copy
} from 'lucide-react';

interface Props {
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type TabType = 'all' | 'online' | 'banned' | 'whitelist';

export default function PlayerManager({ notify }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  
  // UI State
  const [currentTab, setCurrentTab] = useState<TabType>('all');
  const [isWhitelistMode, setIsWhitelistMode] = useState(false); // Default assumes false until fetched

  const getTokenHeader = () => `laplace@${localStorage.getItem('laplace_token') || ''}`;

  const fetchState = async () => {
      try {
          // Fetch Players
          const pRes = await fetch('http://localhost:11228/api/players', {
              headers: { 'x-auth-token': getTokenHeader() }
          });
          const pResponse = await pRes.json();
          if (pResponse.success && Array.isArray(pResponse.data)) {
              setPlayers(pResponse.data);
          }

          // Fetch Settings to determine mode
          const sRes = await fetch('http://localhost:11228/api/server/settings', {
              headers: { 'x-auth-token': getTokenHeader() }
          });
          const sResponse = await sRes.json();
          if (sRes.ok && sResponse.success) {
              const sData = sResponse.data;
              setIsWhitelistMode(sData.properties['white-list'] === 'true');
          }

      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
      fetchState();
      const interval = setInterval(fetchState, 5000);
      return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: PlayerActionType, payload?: string) => {
      if (!selectedPlayer) return;
      setActionLoading(true);
      try {
          const res = await fetch('http://localhost:11228/api/players/action', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'x-auth-token': getTokenHeader() 
              },
              body: JSON.stringify({
                  uuid: selectedPlayer.uuid,
                  name: selectedPlayer.name,
                  action,
                  payload
              })
          });
          
          const response = await res.json();
          if (res.ok && response.success) {
              notify?.(`Action '${action}' executed successfully`, 'success');
              fetchState(); 
              if (action !== 'message') setSelectedPlayer(null);
              setMessageInput('');
          } else {
              notify?.(response.error || 'Action failed', 'error');
          }
      } catch (e) {
          notify?.('Network error executing action', 'error');
      }
      setActionLoading(false);
  };

  const filteredPlayers = players.filter(p => {
      if (currentTab === 'online') return p.isOnline;
      if (currentTab === 'banned') return p.isBanned;
      if (currentTab === 'whitelist') return p.isWhitelisted;
      return true;
  });

  const TabButton = ({ id, label, icon: Icon, count }: any) => (
      <button 
        onClick={() => setCurrentTab(id)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
            ${currentTab === id ? 'bg-laplace-primary text-white shadow-lg shadow-laplace-primary/30' : 'bg-white text-gray-500 hover:bg-gray-50'}
        `}
      >
          <Icon size={16} />
          <span>{label}</span>
          {count !== undefined && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${currentTab === id ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>}
      </button>
  );

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
                <h2 className="text-3xl font-bold text-laplace-darker">Player Base</h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-400 text-sm">Manage permissions and access.</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${isWhitelistMode ? 'text-green-600 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                        {isWhitelistMode ? 'Whitelist Mode' : 'Blacklist Mode'}
                    </span>
                </div>
            </div>
          </div>
          
          <div className="flex space-x-3 overflow-x-auto pb-2">
            <TabButton id="all" label="All Players" icon={List} count={players.length} />
            <TabButton id="online" label="Online" icon={User} count={players.filter(p => p.isOnline).length} />
            {isWhitelistMode ? (
                 <TabButton id="whitelist" label="Whitelisted" icon={CheckCircle} count={players.filter(p => p.isWhitelisted).length} />
            ) : (
                 <TabButton id="banned" label="Banned" icon={Ban} count={players.filter(p => p.isBanned).length} />
            )}
            {isWhitelistMode && <TabButton id="banned" label="Banned" icon={Ban} count={players.filter(p => p.isBanned).length} />}
            {!isWhitelistMode && <TabButton id="whitelist" label="Whitelist" icon={CheckCircle} count={players.filter(p => p.isWhitelisted).length} />}
          </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-4">
        {filteredPlayers.map((p) => (
            <div 
                key={p.uuid} 
                onClick={() => setSelectedPlayer(p)}
                className={`group relative bg-white rounded-2xl p-6 shadow-sm border-2 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md
                    ${p.isOp ? 'border-amber-200 shadow-amber-50' : p.isBanned ? 'border-red-100 bg-red-50/30' : 'border-transparent hover:border-gray-100'}
                `}
            >
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 flex space-x-2 z-10">
                     {p.isBanned && <Ban size={16} className="text-red-500" />}
                     {p.isOp && <Crown size={16} className="text-amber-500 fill-amber-500" />}
                     {p.isWhitelisted && isWhitelistMode && <CheckCircle size={16} className="text-green-500" />}
                     {p.isOnline && <div className="w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                
                <div className="flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-4 bg-gray-100 relative ${!p.isOnline ? 'grayscale opacity-75' : ''}`}>
                        <img 
                            src={p.avatarUrl} 
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => (e.target as HTMLImageElement).src = 'https://minotar.net/helm/MHF_Steve/100.png'}
                        />
                        {/* Linked Account Badge */}
                        {p.linkedUser && (
                            <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-tl-lg shadow-sm" title="Linked to Manager Account">
                                <LinkIcon size={12} />
                            </div>
                        )}
                    </div>
                    
                    <h3 className="font-bold text-lg text-laplace-darker mb-1 flex items-center">
                        {p.name}
                    </h3>

                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-mono">
                            {p.uuid.substring(0,8)}...
                        </span>
                    </div>
                    
                    {/* External IDs Display in Card */}
                    {p.linkedUser && Object.keys(p.linkedUser.externalIds).length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1 mb-3">
                            {Object.keys(p.linkedUser.externalIds).slice(0, 3).map((platform) => (
                                <span key={platform} className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">
                                    {platform}
                                </span>
                            ))}
                            {Object.keys(p.linkedUser.externalIds).length > 3 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] text-gray-400 bg-gray-50 border border-gray-100">
                                    +{Object.keys(p.linkedUser.externalIds).length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="w-full border-t border-gray-100 pt-4 flex justify-between items-center text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                            <Clock size={12} />
                            <span>{p.isOnline ? 'Online Now' : new Date(p.lastLogin).toLocaleDateString()}</span>
                        </div>
                        <MoreHorizontal size={16} className="text-gray-300 group-hover:text-laplace-primary transition-colors"/>
                    </div>
                </div>
            </div>
        ))}
        {filteredPlayers.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                <User size={48} className="mb-4 opacity-20" />
                <p>No players found in this list.</p>
             </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedPlayer && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}></div>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden animate-fade-in border border-gray-100 flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="bg-laplace-bg p-6 flex items-start justify-between shrink-0">
                      <div className="flex items-center space-x-4">
                          <img src={selectedPlayer.avatarUrl} className={`w-16 h-16 rounded-xl shadow-sm bg-white ${!selectedPlayer.isOnline ? 'grayscale opacity-75' : ''}`} />
                          <div>
                              <h3 className="text-2xl font-bold text-laplace-darker flex items-center gap-2">
                                  {selectedPlayer.name}
                                  {selectedPlayer.isOp && <Crown size={18} className="text-amber-500 fill-amber-500" />}
                              </h3>
                              <p className="text-xs font-mono text-gray-400">{selectedPlayer.uuid}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {selectedPlayer.isBanned && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full flex items-center gap-1"><Ban size={10}/> BANNED</span>}
                                  {selectedPlayer.isWhitelisted && <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle size={10}/> WHITELISTED</span>}
                                  {selectedPlayer.linkedUser && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-full flex items-center gap-1"><LinkIcon size={10}/> LINKED</span>}
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setSelectedPlayer(null)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400">
                          <X size={20} />
                      </button>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 overflow-y-auto">
                      
                      {/* Linked Identities Section */}
                      {selectedPlayer.linkedUser && (
                          <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                              <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                      <LinkIcon size={14} className="text-blue-500"/> 
                                      Linked Accounts
                                  </h4>
                                  <span className="text-xs font-mono text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                                      @{selectedPlayer.linkedUser.username}
                                  </span>
                              </div>
                              <div className="p-4">
                                   {selectedPlayer.linkedUser.externalIds && Object.keys(selectedPlayer.linkedUser.externalIds).length > 0 ? (
                                      <div className="grid grid-cols-1 gap-2">
                                          {Object.entries(selectedPlayer.linkedUser.externalIds).map(([platform, id]) => (
                                              <div key={platform} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 group hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                                   <div className="flex items-center gap-3">
                                                       <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded uppercase w-16 text-center">{platform}</span>
                                                       <span className="font-mono text-xs text-gray-700 select-all">{id}</span>
                                                   </div>
                                                   <button 
                                                        onClick={() => {navigator.clipboard.writeText(String(id)); notify?.('ID Copied', 'info');}}
                                                        className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Copy ID"
                                                   >
                                                       <Copy size={12} />
                                                   </button>
                                              </div>
                                          ))}
                                      </div>
                                   ) : (
                                      <p className="text-xs text-gray-400 italic text-center py-2">No external IDs connected.</p>
                                   )}
                              </div>
                          </div>
                      )}

                      {/* Actions Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                          {selectedPlayer.isOp ? (
                              <button onClick={() => handleAction('deop')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                                  <Shield size={18} className="text-gray-400" />
                                  <span>Revoke OP</span>
                              </button>
                          ) : (
                              <button onClick={() => handleAction('op')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors">
                                  <Crown size={18} />
                                  <span>Grant OP</span>
                              </button>
                          )}

                          {selectedPlayer.isBanned ? (
                              <button onClick={() => handleAction('pardon')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-medium transition-colors">
                                  <CheckCircle size={18} />
                                  <span>Unban</span>
                              </button>
                          ) : (
                              <button onClick={() => handleAction('ban')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 font-medium transition-colors">
                                  <Ban size={18} />
                                  <span>Ban Player</span>
                              </button>
                          )}
                          
                          <button onClick={() => handleAction('kick')} disabled={actionLoading || !selectedPlayer.isOnline} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium transition-colors disabled:opacity-50">
                              <LogOut size={18} />
                              <span>Kick</span>
                          </button>

                           {isWhitelistMode && (
                               selectedPlayer.isWhitelisted ? (
                                  <button onClick={() => handleAction('whitelist_remove')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                                      <UserX size={18} />
                                      <span>Un-Whitelist</span>
                                  </button>
                              ) : (
                                  <button onClick={() => handleAction('whitelist_add')} disabled={actionLoading} className="flex items-center justify-center space-x-2 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                                      <UserCheck size={18} />
                                      <span>Whitelist</span>
                                  </button>
                              )
                           )}
                      </div>

                      {/* Messaging */}
                      <div className="bg-gray-50 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 mb-2 text-sm font-bold text-gray-500">
                              <MessageSquare size={16} />
                              <span>Direct Message / Whisper</span>
                          </div>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={messageInput}
                                  onChange={(e) => setMessageInput(e.target.value)}
                                  placeholder={`Message ${selectedPlayer.name}...`}
                                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-laplace-primary"
                                  disabled={!selectedPlayer.isOnline}
                              />
                              <button 
                                  onClick={() => handleAction('message', messageInput)}
                                  disabled={!messageInput.trim() || !selectedPlayer.isOnline || actionLoading}
                                  className="px-4 py-2 bg-laplace-primary text-white rounded-xl font-medium text-sm disabled:opacity-50 hover:bg-opacity-90 transition-opacity"
                              >
                                  Send
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}