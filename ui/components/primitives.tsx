import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'on-dark';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonProps) {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[color:var(--color-primary)]/40';
    const sizes: Record<Size, string> = {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
    };
    const variants: Record<Variant, string> = {
        primary: 'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] hover:bg-[color:var(--color-primary-active)] active:bg-[color:var(--color-primary-active)]',
        secondary: 'bg-[color:var(--color-canvas)] text-[color:var(--color-ink)] border border-[color:var(--color-hairline)] hover:bg-[color:var(--color-surface-soft)]',
        ghost: 'bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-soft)]',
        danger: 'bg-transparent text-[color:var(--color-error)] border border-[color:var(--color-error)]/40 hover:bg-[color:var(--color-error)]/10',
        'on-dark': 'bg-[color:var(--color-on-dark)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-soft)]',
    };
    return (
        <button
            className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <span className="inline-block w-3 h-3 rounded-full border border-current border-r-transparent animate-spin" aria-hidden /> : null}
            {children}
        </button>
    );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    tone?: 'cream' | 'card' | 'dark' | 'canvas';
    padded?: boolean;
}

export function Card({ tone = 'canvas', padded = true, className = '', children, ...props }: CardProps) {
    const tones: Record<NonNullable<CardProps['tone']>, string> = {
        canvas: 'bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)]',
        cream: 'bg-[color:var(--color-surface-soft)]',
        card: 'bg-[color:var(--color-surface-card)]',
        dark: 'bg-[color:var(--color-surface-dark)] text-[color:var(--color-on-dark)]',
    };
    return (
        <div className={`rounded-xl ${tones[tone]} ${padded ? 'p-6' : ''} ${className}`} {...props}>
            {children}
        </div>
    );
}

export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`eyebrow ${className}`}>{children}</div>;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helper?: string;
    error?: string;
}

export function Input({ label, helper, error, className = '', ...props }: InputProps) {
    return (
        <label className="block">
            {label ? <span className="block text-[12px] font-medium text-[color:var(--color-ink)] mb-1.5">{label}</span> : null}
            <input
                className={`w-full h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] text-[14px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-muted-soft)] ${error ? 'border-[color:var(--color-error)]' : ''} ${className}`}
                {...props}
            />
            {helper && !error ? <span className="block text-[11px] text-[color:var(--color-muted)] mt-1.5">{helper}</span> : null}
            {error ? <span className="block text-[11px] text-[color:var(--color-error)] mt-1.5">{error}</span> : null}
        </label>
    );
}

export function StatusDot({ status }: { status: string }) {
    const map: Record<string, { color: string; label: string }> = {
        ONLINE: { color: 'var(--color-success)', label: 'Online' },
        STARTING: { color: 'var(--color-accent-ochre)', label: 'Starting' },
        STOPPING: { color: 'var(--color-accent-ochre)', label: 'Stopping' },
        RESTARTING: { color: 'var(--color-accent-ochre)', label: 'Restarting' },
        OFFLINE: { color: 'var(--color-muted-soft)', label: 'Offline' },
        CRASHED: { color: 'var(--color-error)', label: 'Crashed' },
    };
    const meta = map[status] || { color: 'var(--color-muted-soft)', label: status };
    return (
        <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[color:var(--color-ink)]">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: meta.color }} aria-hidden />
            {meta.label}
        </span>
    );
}

export function SectionHeader({ eyebrow, title, lead, action }: {
    eyebrow?: string;
    title: string;
    lead?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-end justify-between gap-6 mb-8">
            <div>
                {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
                <h2 className="display-md mb-2">{title}</h2>
                {lead ? <p className="text-[15px] text-[color:var(--color-body)] max-w-xl">{lead}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'on-dark' }) {
    const tones = {
        neutral: 'bg-[color:var(--color-surface-card)] text-[color:var(--color-ink)]',
        primary: 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]',
        success: 'bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]',
        warning: 'bg-[color:var(--color-warning)]/12 text-[color:var(--color-warning)]',
        error: 'bg-[color:var(--color-error)]/12 text-[color:var(--color-error)]',
        'on-dark': 'bg-white/10 text-[color:var(--color-on-dark)]',
    } as const;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium tracking-[1.4px] uppercase ${tones[tone]}`}>
            {children}
        </span>
    );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label?: string; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={checked}
        >
            <span
                className="relative inline-block w-9 h-5 rounded-full transition-colors"
                style={{ background: checked ? 'var(--color-primary)' : 'var(--color-surface-strong)' }}
            >
                <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
                />
            </span>
            {label ? <span className="text-[13px] text-[color:var(--color-ink)]">{label}</span> : null}
        </button>
    );
}

export function NumberField({ label, value, onChange, min, max, step = 1, helper, suffix }: {
    label: string;
    value: number;
    onChange: (next: number) => void;
    min?: number;
    max?: number;
    step?: number;
    helper?: string;
    suffix?: string;
}) {
    return (
        <label className="block">
            <span className="block text-[12px] font-medium text-[color:var(--color-ink)] mb-1.5">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={Number.isFinite(value) ? value : ''}
                    onChange={(e) => onChange(Number(e.target.value))}
                    min={min}
                    max={max}
                    step={step}
                    className="w-full h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] text-[14px] text-[color:var(--color-ink)]"
                />
                {suffix ? <span className="text-[12px] text-[color:var(--color-muted)] whitespace-nowrap">{suffix}</span> : null}
            </div>
            {helper ? <span className="block text-[11px] text-[color:var(--color-muted)] mt-1.5">{helper}</span> : null}
        </label>
    );
}
