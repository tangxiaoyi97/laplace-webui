import React, { useState } from 'react';
import { Upload, Check, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { ViewState } from '../types.ts';
import { fetchAuthed } from '../lib/api.ts';
import { Button, Card, Eyebrow, Input } from './primitives.tsx';

interface Props {
    onViewChange: (view: ViewState) => void;
    notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    currentServerId?: string | null;
    refreshServers?: () => Promise<void> | void;
}

const STEPS = ['Pick a core', 'Accept EULA', 'Configure', 'Name'];

export default function ServerWizard({ onViewChange, notify, refreshServers }: Props) {
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
        if (!name) { setNameError('Required'); return false; }
        if (!/^[a-z0-9-]{3,32}$/.test(name)) {
            setNameError('Lowercase letters, digits, hyphens — between 3 and 32 chars.');
            return false;
        }
        setNameError('');
        return true;
    };

    const handleNext = async () => {
        if (step < 4) { setStep(step + 1); return; }
        if (!validateName(formData.serverName)) return;

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

            const res = await fetchAuthed('/server/create', { method: 'POST', body: data });
            const response = await res.json();
            if (res.ok && response.success) {
                notify?.(`Server '${response.data?.serverId || formData.serverName}' created`, 'success');
                if (refreshServers) await refreshServers();
                onViewChange(ViewState.SERVERS_OVERVIEW);
            } else {
                notify?.(response.error || 'Failed to create server', 'error');
            }
        } catch {
            notify?.('Network error', 'error');
        }
        setSubmitting(false);
    };

    return (
        <div className="max-w-[640px] mx-auto">
            <Eyebrow className="mb-4">Setup wizard</Eyebrow>
            <h1 className="display-lg mb-3">Deploy a server.</h1>
            <p className="text-[15px] text-[color:var(--color-body)] mb-8 max-w-[40ch]">
                Four steps. The wizard writes <span className="font-mono text-[13px]">server.properties</span> and a runtime config for you.
            </p>

            <div className="flex items-center gap-3 mb-8">
                {STEPS.map((label, i) => (
                    <React.Fragment key={label}>
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium ${
                                    step > i + 1
                                        ? 'bg-[color:var(--color-primary)] text-white'
                                        : step === i + 1
                                            ? 'bg-[color:var(--color-ink)] text-white'
                                            : 'bg-[color:var(--color-surface-card)] text-[color:var(--color-muted)]'
                                }`}
                            >
                                {step > i + 1 ? <Check size={12} /> : i + 1}
                            </span>
                            <span className={`text-[12px] ${step === i + 1 ? 'text-[color:var(--color-ink)] font-medium' : 'text-[color:var(--color-muted)]'}`}>{label}</span>
                        </div>
                        {i < STEPS.length - 1 ? <div className="flex-1 h-px bg-[color:var(--color-hairline)]" /> : null}
                    </React.Fragment>
                ))}
            </div>

            <Card tone="canvas" padded className="mb-6 min-h-[260px]">
                {step === 1 && (
                    <div className="relative border border-dashed border-[color:var(--color-hairline)] rounded-md py-12 text-center bg-[color:var(--color-surface-soft)]">
                        <input
                            type="file"
                            accept=".jar"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => setFormData({ ...formData, file: e.target.files ? e.target.files[0] : null })}
                        />
                        <Upload size={28} className="mx-auto mb-3 text-[color:var(--color-muted)]" />
                        <div className="text-[15px] text-[color:var(--color-ink)] font-medium mb-1">Drop a .jar here</div>
                        <div className="text-[12.5px] text-[color:var(--color-muted)]">Vanilla, Paper, Forge, Fabric — all accepted.</div>
                        {formData.file ? (
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] text-[12px]">
                                <Check size={12} /> {formData.file.name}
                            </div>
                        ) : null}
                    </div>
                )}

                {step === 2 && (
                    <div>
                        <div className="rounded-md bg-[color:var(--color-surface-dark)] text-[color:var(--color-on-dark)] p-5 font-mono text-[12px] leading-relaxed h-48 overflow-auto mb-5">
                            <p className="font-display text-[color:var(--color-on-dark)] text-[18px] mb-3">MINECRAFT END USER LICENSE AGREEMENT</p>
                            <p>Operating a Minecraft server means agreeing to the Minecraft EULA at https://account.mojang.com/documents/minecraft_eula.</p>
                            <p className="mt-3">By checking the box you acknowledge that you have read it and accept the terms.</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <span
                                className={`w-5 h-5 rounded border flex items-center justify-center ${formData.eulaAccepted ? 'bg-[color:var(--color-primary)] border-[color:var(--color-primary)]' : 'border-[color:var(--color-hairline)]'}`}
                            >
                                {formData.eulaAccepted ? <Check size={12} className="text-white" /> : null}
                            </span>
                            <input type="checkbox" className="hidden" checked={formData.eulaAccepted} onChange={(e) => setFormData({ ...formData, eulaAccepted: e.target.checked })} />
                            <span className="text-[14px] text-[color:var(--color-ink)]">I agree to the Minecraft EULA.</span>
                        </label>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Max RAM (Xmx)" value={formData.xmx} onChange={(e) => setFormData({ ...formData, xmx: e.target.value })} helper="e.g. 4G" />
                            <Input label="Initial RAM (Xms)" value={formData.xms} onChange={(e) => setFormData({ ...formData, xms: e.target.value })} helper="e.g. 1G" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Server port" value={formData.port} onChange={(e) => setFormData({ ...formData, port: e.target.value })} helper="Default: 25565" />
                            <Input label="Max players" type="number" value={formData.maxPlayers} onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })} />
                        </div>
                        <Input label="MOTD" value={formData.motd} onChange={(e) => setFormData({ ...formData, motd: e.target.value })} />
                    </div>
                )}

                {step === 4 && (
                    <div className="text-center py-6">
                        <Eyebrow className="mb-3">Identifier</Eyebrow>
                        <input
                            type="text"
                            value={formData.serverName}
                            onChange={(e) => { setFormData({ ...formData, serverName: e.target.value }); validateName(e.target.value); }}
                            placeholder="survival"
                            className="w-full text-center font-display text-[36px] tracking-[-0.5px] text-[color:var(--color-ink)] bg-transparent border-0 border-b-2 py-2 focus:outline-none placeholder:text-[color:var(--color-muted-soft)]"
                            style={{ borderColor: nameError ? 'var(--color-error)' : 'var(--color-hairline)' }}
                        />
                        {nameError ? (
                            <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-[color:var(--color-error)]">
                                <AlertCircle size={12} /> {nameError}
                            </div>
                        ) : (
                            <p className="mt-3 text-[12px] text-[color:var(--color-muted)]">Lowercase, digits, hyphens. 3–32 chars.</p>
                        )}
                    </div>
                )}
            </Card>

            <div className="flex justify-between">
                <Button variant="ghost" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1 || submitting}>
                    <ArrowLeft size={14} /> Back
                </Button>
                <Button
                    onClick={handleNext}
                    disabled={(step === 1 && !formData.file) || (step === 2 && !formData.eulaAccepted) || (step === 4 && !!nameError) || submitting}
                    loading={submitting}
                >
                    {step === 4 ? 'Deploy' : 'Next'} <ArrowRight size={14} />
                </Button>
            </div>
        </div>
    );
}
