import React, { useState } from 'react';
import { Upload, FileText, Settings as SettingsIcon, Tag, Check, ArrowRight, ArrowLeft, Loader2, Info, AlertCircle } from 'lucide-react';
import { ViewState } from '../types.ts';
import { getAuthHeaders } from '../lib/api.ts';

interface Props {
  onViewChange: (view: ViewState) => void;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const Steps = [
  { id: 1, title: 'Upload Core', icon: Upload },
  { id: 2, title: 'EULA', icon: FileText },
  { id: 3, title: 'Configuration', icon: SettingsIcon },
  { id: 4, title: 'Identity', icon: Tag },
];

export default function ServerWizard({ onViewChange, notify }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [formData, setFormData] = useState({
    file: null as File | null,
    eulaAccepted: false,
    xmx: '4G',
    xms: '1G',
    port: '25565',
    maxPlayers: '20',
    motd: 'A Minecraft Server',
    serverName: 'newserver',
  });

  const validateName = (name: string): boolean => {
      if (!name) return false;
      if (!/^[a-z0-9]+$/.test(name)) {
          setNameError('Name must only contain lowercase letters and numbers (a-z, 0-9). No spaces or symbols.');
          return false;
      }
      setNameError('');
      return true;
  };

  const handleNext = async () => {
    if (step < 4) {
        setStep(step + 1);
    } else {
        // Validate before submit
        if (!validateName(formData.serverName)) {
            return;
        }

        // Submit
        setSubmitting(true);
        try {
            const data = new FormData();
            if (formData.file) data.append('core', formData.file);
            data.append('name', formData.serverName);
            data.append('eulaAccepted', formData.eulaAccepted.toString());
            data.append('xmx', formData.xmx);
            data.append('xms', formData.xms);
            data.append('port', formData.port);
            data.append('maxPlayers', formData.maxPlayers);
            data.append('motd', formData.motd);
            
            const res = await fetch('/api/server/create', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: data
            });
            const response = await res.json();
            
            if (res.ok && response.success) {
                notify?.('Server created successfully', 'success');
                onViewChange(ViewState.DASHBOARD);
            } else {
                notify?.(response.error || 'Failed to create server', 'error');
            }
        } catch (e) {
            console.error(e);
            notify?.('Error connecting to backend', 'error');
        }
        setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-laplace-darker">Deploy Server</h2>
            <p className="text-gray-400 mt-2">Configure and launch your Minecraft instance</p>
        </div>

        <div className="flex justify-between mb-10 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
          <div className="absolute top-1/2 left-0 h-1 bg-laplace-primary -z-10 -translate-y-1/2 rounded-full transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
          
          {Steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center bg-laplace-bg px-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step >= s.id 
                    ? 'bg-laplace-primary border-laplace-primary text-white shadow-lg shadow-laplace-primary/30' 
                    : 'bg-white border-gray-200 text-gray-400'
                }`}
              >
                <s.icon size={18} />
              </div>
              <span className={`text-xs font-semibold mt-2 ${step >= s.id ? 'text-laplace-darker' : 'text-gray-400'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 min-h-[400px] flex flex-col border border-gray-100 relative overflow-hidden">
          
          <div className="flex-1">
            {step === 1 && (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-laplace-accent/10 hover:border-laplace-primary transition-colors cursor-pointer group p-10 relative">
                 <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-laplace-primary mb-4 group-hover:scale-110 transition-transform">
                     <Upload size={32} />
                 </div>
                 <h3 className="text-lg font-bold text-laplace-darker">Drop Server Jar</h3>
                 <p className="text-sm text-gray-400 mt-1">Select the main server file (e.g. server.jar, spigot.jar)</p>
                 <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFormData({...formData, file: e.target.files ? e.target.files[0] : null})} />
                 {formData.file && (
                     <div className="mt-4 bg-laplace-primary/10 text-laplace-primary px-3 py-1 rounded-full text-sm font-medium z-10 flex items-center">
                         <Check size={14} className="mr-1"/> {formData.file.name}
                     </div>
                 )}
              </div>
            )}

            {step === 2 && (
              <div className="h-full flex flex-col justify-center">
                 <div className="bg-gray-900 text-gray-300 p-6 rounded-xl font-mono text-xs h-64 overflow-y-auto mb-6">
                     <p>MINECRAFT END USER LICENSE AGREEMENT</p>
                     <br/>
                     <p>By checking the box below, you indicate that you have read and agree to the Minecraft EULA (https://account.mojang.com/documents/minecraft_eula).</p>
                 </div>
                 <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.eulaAccepted ? 'bg-laplace-primary border-laplace-primary' : 'border-gray-300'}`}>
                         {formData.eulaAccepted && <Check size={12} className="text-white" />}
                     </div>
                     <input type="checkbox" className="hidden" checked={formData.eulaAccepted} onChange={(e) => setFormData({...formData, eulaAccepted: e.target.checked})} />
                     <span className="text-sm font-medium text-laplace-darker">I agree to the Minecraft EULA</span>
                 </label>
              </div>
            )}

            {step === 3 && (
              <div className="h-full flex flex-col justify-center space-y-4 overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Max RAM (Xmx)</label>
                         <input 
                            type="text" 
                            value={formData.xmx} 
                            onChange={e => setFormData({...formData, xmx: e.target.value})}
                            className="w-full bg-laplace-bg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-laplace-primary transition-colors text-laplace-darker font-medium" 
                         />
                         <p className="text-[10px] text-gray-400 mt-1">E.g. 4G. Rec: 4G+</p>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Startup RAM (Xms)</label>
                         <input 
                            type="text" 
                            value={formData.xms} 
                            onChange={e => setFormData({...formData, xms: e.target.value})}
                            className="w-full bg-laplace-bg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-laplace-primary transition-colors text-laplace-darker font-medium" 
                         />
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Server Port</label>
                         <input 
                            type="text" 
                            value={formData.port} 
                            onChange={e => setFormData({...formData, port: e.target.value})}
                            className="w-full bg-laplace-bg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-laplace-primary transition-colors text-laplace-darker font-medium" 
                         />
                         <p className="text-[10px] text-gray-400 mt-1">Default: 25565</p>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Max Players</label>
                         <input 
                            type="number" 
                            value={formData.maxPlayers} 
                            onChange={e => setFormData({...formData, maxPlayers: e.target.value})}
                            className="w-full bg-laplace-bg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-laplace-primary transition-colors text-laplace-darker font-medium" 
                         />
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Server Description (MOTD)</label>
                     <input 
                        type="text" 
                        value={formData.motd} 
                        onChange={e => setFormData({...formData, motd: e.target.value})}
                        className="w-full bg-laplace-bg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-laplace-primary transition-colors text-laplace-darker font-medium" 
                     />
                 </div>
              </div>
            )}

            {step === 4 && (
              <div className="h-full flex flex-col justify-center">
                  <div className="text-center mb-6">
                      <div className="inline-flex p-4 bg-laplace-accent rounded-full text-laplace-primary mb-4">
                          <Tag size={32} />
                      </div>
                      <h3 className="text-lg font-bold">Name your Server</h3>
                      <p className="text-sm text-gray-400">Unique identifier for this instance.</p>
                  </div>
                   <input 
                        type="text" 
                        value={formData.serverName} 
                        onChange={e => {
                            setFormData({...formData, serverName: e.target.value});
                            validateName(e.target.value);
                        }}
                        placeholder="e.g. survival1"
                        className={`w-full text-center text-xl font-bold bg-transparent border-b-2 py-3 focus:outline-none transition-colors placeholder:text-gray-300
                            ${nameError ? 'border-red-400 text-red-500' : 'border-gray-200 focus:border-laplace-primary'}
                        `}
                     />
                     {nameError ? (
                        <div className="mt-3 flex items-center justify-center space-x-2 text-red-500 text-xs font-bold animate-fade-in">
                            <AlertCircle size={14} />
                            <span>{nameError}</span>
                        </div>
                     ) : (
                         <p className="mt-3 text-center text-xs text-gray-400">Lowercase letters and numbers only.</p>
                     )}
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button 
                onClick={handleBack} 
                disabled={step === 1 || submitting}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                <ArrowLeft size={18} />
                <span>Back</span>
            </button>

            <button 
                onClick={handleNext}
                disabled={(step === 2 && !formData.eulaAccepted) || (step === 4 && !!nameError) || submitting}
                className="flex items-center space-x-2 px-8 py-3 bg-laplace-darker text-white rounded-xl shadow-lg shadow-gray-900/10 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <span>{step === 4 ? 'Deploy' : 'Next Step'}</span>}
                {!submitting && <ArrowRight size={18} />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
