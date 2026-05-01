import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Card, Eyebrow } from './primitives.tsx';

export interface ConfirmOptions {
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** When true, the confirm button uses the danger variant. */
    danger?: boolean;
    /**
     * Optional typed-confirmation gate. When set, the user must type this exact
     * string into a small input before the confirm button enables. Used for
     * destructive actions (e.g. delete server, drop all backups).
     */
    typeToConfirm?: string;
}

interface PendingRequest extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<PendingRequest | null>(null);
    const [typed, setTyped] = useState('');

    const confirm = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setTyped('');
            setPending({ ...opts, resolve });
        });
    }, []);

    const close = (result: boolean) => {
        if (!pending) return;
        pending.resolve(result);
        setPending(null);
        setTyped('');
    };

    // Esc to cancel, Enter to confirm (when not gated by typeToConfirm).
    useEffect(() => {
        if (!pending) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); close(false); }
            else if (e.key === 'Enter' && (!pending.typeToConfirm || typed === pending.typeToConfirm)) {
                e.preventDefault();
                close(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, typed]);

    const gateOk = !pending?.typeToConfirm || typed === pending.typeToConfirm;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-[color:var(--color-ink)]/40"
                        onClick={() => close(false)}
                        aria-hidden
                    />
                    <Card tone="canvas" padded className="relative w-full max-w-[460px]">
                        {pending.danger ? (
                            <div className="flex items-center gap-2 mb-3 text-[color:var(--color-error)]">
                                <AlertTriangle size={16} />
                                <Eyebrow className="text-[color:var(--color-error)]">Destructive action</Eyebrow>
                            </div>
                        ) : (
                            <Eyebrow className="mb-3">Confirm</Eyebrow>
                        )}
                        <h3 className="display-sm mb-3">{pending.title}</h3>
                        {pending.message ? (
                            <div className="text-[14px] text-[color:var(--color-body)] leading-snug mb-5">{pending.message}</div>
                        ) : null}
                        {pending.typeToConfirm ? (
                            <label className="block mb-5">
                                <span className="block text-[12px] text-[color:var(--color-muted)] mb-1.5">
                                    Type <span className="font-mono text-[color:var(--color-ink)]">{pending.typeToConfirm}</span> to continue
                                </span>
                                <input
                                    type="text"
                                    value={typed}
                                    onChange={(e) => setTyped(e.target.value)}
                                    autoFocus
                                    autoComplete="off"
                                    className="w-full h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] text-[14px] font-mono"
                                />
                            </label>
                        ) : null}
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => close(false)}>
                                {pending.cancelLabel || 'Cancel'}
                            </Button>
                            <Button
                                variant={pending.danger ? 'danger' : 'primary'}
                                onClick={() => close(true)}
                                disabled={!gateOk}
                            >
                                {pending.confirmLabel || (pending.danger ? 'Delete' : 'Confirm')}
                            </Button>
                        </div>
                    </Card>
                </div>
            ) : null}
        </ConfirmContext.Provider>
    );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Fallback to native confirm so views still work outside the provider.
        return async (opts: ConfirmOptions) => window.confirm(opts.title);
    }
    return ctx;
}
