import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Play, Save, AlertTriangle } from 'lucide-react';
import { fetchScoped, postScoped } from '../lib/api.ts';
import type { BackupSchedule } from '../types.ts';
import { Button, Card, Eyebrow, NumberField, SectionHeader, Toggle, Pill } from './primitives.tsx';
import { useConfirm } from './confirm.tsx';

interface Props {
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;
    currentServerId: string | null;
}

const DEFAULT_SCHEDULE: BackupSchedule = {
    enabled: false,
    intervalMinutes: 360,
    retainCount: 7,
    retainAgeDays: undefined,
    namePrefix: 'auto',
    requireOffline: false,
    stopRestartIfOnline: true,
};

export default function BackupScheduleView({ notify, currentServerId }: Props) {
    const confirm = useConfirm();
    const [serverId, setServerId] = useState<string>('');
    const [schedule, setSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE);
    const [originalSchedule, setOriginalSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const generationRef = useRef(0);

    useEffect(() => {
        // Reset to defaults so we don't briefly show the previous server's schedule.
        setSchedule(DEFAULT_SCHEDULE);
        setOriginalSchedule(DEFAULT_SCHEDULE);
        load();
    }, [currentServerId]);

    async function load() {
        if (!currentServerId) { setLoading(false); return; }
        const myGen = ++generationRef.current;
        setLoading(true);
        try {
            const res = await fetchScoped('/backups/schedule', currentServerId);
            const json = await res.json();
            if (generationRef.current !== myGen) return;
            if (json.success) {
                setServerId(json.data.serverId);
                setSchedule(json.data.schedule);
                setOriginalSchedule(json.data.schedule);
            } else {
                notify(json.error || 'Could not load schedule', 'error');
            }
        } catch (e: any) {
            if (generationRef.current === myGen) notify(e.message || 'Network error', 'error');
        } finally {
            if (generationRef.current === myGen) setLoading(false);
        }
    }

    async function save() {
        if (!currentServerId) return;
        setSaving(true);
        try {
            const res = await postScoped('/backups/schedule', currentServerId, { schedule });
            const json = await res.json();
            if (json.success) {
                notify('Schedule saved', 'success');
                setSchedule(json.data.schedule);
                setOriginalSchedule(json.data.schedule);
            } else {
                notify(json.error || 'Save failed', 'error');
            }
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setSaving(false);
        }
    }

    async function runNow() {
        if (!currentServerId) return;
        const willStopRestart = schedule.requireOffline && schedule.stopRestartIfOnline;
        const ok = await confirm({
            title: 'Run a backup right now?',
            message: willStopRestart
                ? 'If the server is currently online, the scheduler will stop it, snapshot the world, and restart it. Connected players will be disconnected.'
                : 'A snapshot of the current world directory will be created.',
            confirmLabel: 'Run backup',
        });
        if (!ok) return;
        setRunning(true);
        try {
            const res = await postScoped('/backups/schedule/run', currentServerId, {});
            const json = await res.json();
            if (json.success) {
                const result = json.data.result;
                if (result.status === 'ok') notify(result.message, 'success');
                else if (result.status === 'skipped') notify(result.message, 'info');
                else notify(result.message, 'error');
                load();
            } else {
                notify(json.error || 'Run failed', 'error');
            }
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setRunning(false);
        }
    }

    const dirty = JSON.stringify(schedule) !== JSON.stringify(originalSchedule);
    const lastRun = schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : '—';
    const nextRunMs = schedule.lastRunAt ? schedule.lastRunAt + schedule.intervalMinutes * 60_000 - Date.now() : 0;
    const nextRunLabel = !schedule.enabled
        ? '(disabled)'
        : !schedule.lastRunAt
            ? 'within 1 minute'
            : nextRunMs <= 0
                ? 'within 1 minute'
                : `~${formatDuration(nextRunMs)}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-5 h-5 rounded-full border-2 border-[color:var(--color-primary)] border-r-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <SectionHeader
                eyebrow="Snapshots"
                title="Scheduled backups"
                lead="Take periodic offline-safe snapshots of the active server. Disabled by default — toggle on after you're happy with the timing and retention policy."
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" size="md" onClick={runNow} loading={running}>
                            <Play size={14} /> Run now
                        </Button>
                        <Button size="md" onClick={save} disabled={!dirty} loading={saving}>
                            <Save size={14} /> {dirty ? 'Save changes' : 'Saved'}
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                <Card tone="card" padded>
                    <Eyebrow className="mb-3">Status</Eyebrow>
                    <div className="display-sm mb-3">{schedule.enabled ? 'Active' : 'Paused'}</div>
                    <Toggle
                        checked={schedule.enabled}
                        onChange={(next) => setSchedule({ ...schedule, enabled: next })}
                        label={schedule.enabled ? 'Scheduler will run' : 'Scheduler will not run'}
                    />
                </Card>
                <Card tone="cream" padded>
                    <Eyebrow className="mb-3">Last run</Eyebrow>
                    <div className="text-[15px] text-[color:var(--color-ink)]">{lastRun}</div>
                    <div className="mt-2">
                        {schedule.lastRunStatus === 'ok' && <Pill tone="success">Ok</Pill>}
                        {schedule.lastRunStatus === 'skipped' && <Pill tone="warning">Skipped</Pill>}
                        {schedule.lastRunStatus === 'error' && <Pill tone="error">Error</Pill>}
                        {!schedule.lastRunStatus && <Pill tone="neutral">Never</Pill>}
                    </div>
                    {schedule.lastRunMessage ? (
                        <p className="text-[12px] text-[color:var(--color-muted)] mt-3 leading-snug">{schedule.lastRunMessage}</p>
                    ) : null}
                </Card>
                <Card tone="dark" padded>
                    <Eyebrow className="mb-3 text-[color:var(--color-on-dark-soft)]">Next run</Eyebrow>
                    <div className="display-sm mb-3" style={{ color: 'var(--color-on-dark)' }}>{nextRunLabel}</div>
                    <p className="text-[13px] text-[color:var(--color-on-dark-soft)] leading-snug">
                        Server: <span className="text-[color:var(--color-on-dark)] font-mono">{serverId || '—'}</span>
                    </p>
                </Card>
            </div>

            <Card tone="canvas" padded className="mb-6">
                <Eyebrow className="mb-4">Cadence</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <NumberField
                        label="Interval"
                        value={schedule.intervalMinutes}
                        onChange={(n) => setSchedule({ ...schedule, intervalMinutes: n })}
                        min={5}
                        max={60 * 24 * 30}
                        suffix="minutes"
                        helper="Between 5 minutes and 30 days."
                    />
                    <NumberField
                        label="Retain count"
                        value={schedule.retainCount}
                        onChange={(n) => setSchedule({ ...schedule, retainCount: n })}
                        min={1}
                        max={200}
                        suffix="snapshots"
                        helper="Older auto-snapshots are pruned."
                    />
                    <NumberField
                        label="Retain age (optional)"
                        value={schedule.retainAgeDays ?? 0}
                        onChange={(n) => setSchedule({ ...schedule, retainAgeDays: n > 0 ? n : undefined })}
                        min={0}
                        max={365 * 5}
                        suffix="days"
                        helper="0 disables age-based pruning."
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                    <label className="block">
                        <span className="block text-[12px] font-medium text-[color:var(--color-ink)] mb-1.5">Filename prefix</span>
                        <input
                            type="text"
                            value={schedule.namePrefix}
                            onChange={(e) => setSchedule({ ...schedule, namePrefix: e.target.value })}
                            placeholder="auto"
                            className="w-full h-10 px-3 rounded-md bg-[color:var(--color-canvas)] border border-[color:var(--color-hairline)] text-[14px] text-[color:var(--color-ink)] font-mono"
                        />
                        <span className="block text-[11px] text-[color:var(--color-muted)] mt-1.5">
                            Snapshot names look like <span className="font-mono">{schedule.namePrefix || 'auto'}-2026-05-01T08-00-00.000Z</span>
                        </span>
                    </label>
                </div>
            </Card>

            <Card tone="canvas" padded>
                <Eyebrow className="mb-4">Live-server policy</Eyebrow>
                <p className="text-[14px] text-[color:var(--color-body)] mb-5 max-w-2xl">
                    Minecraft world data is unsafe to copy while the server is running. Decide what should happen if the schedule fires while it's online.
                </p>
                <div className="space-y-4">
                    <PolicyOption
                        label="Stop server, snapshot, restart"
                        helper="Recommended. The scheduler stops the server, takes the snapshot, then brings it back up."
                        active={schedule.requireOffline && schedule.stopRestartIfOnline}
                        onClick={() => setSchedule({ ...schedule, requireOffline: true, stopRestartIfOnline: true })}
                    />
                    <PolicyOption
                        label="Skip if online"
                        helper="Only run when the server is already offline. Misses snapshots if the server runs continuously."
                        active={schedule.requireOffline && !schedule.stopRestartIfOnline}
                        onClick={() => setSchedule({ ...schedule, requireOffline: true, stopRestartIfOnline: false })}
                    />
                    <PolicyOption
                        label="Hot snapshot (advanced)"
                        helper="Copy world files while the server is running. Faster, but risks corrupted region files."
                        active={!schedule.requireOffline}
                        onClick={() => setSchedule({ ...schedule, requireOffline: false, stopRestartIfOnline: false })}
                    />
                </div>
                {!schedule.requireOffline ? (
                    <div className="mt-5 flex items-start gap-3 p-4 rounded-md bg-[color:var(--color-warning)]/10">
                        <AlertTriangle size={16} className="text-[color:var(--color-warning)] mt-0.5 shrink-0" />
                        <div className="text-[13px] text-[color:var(--color-ink)] leading-snug">
                            Hot snapshots can produce corrupted region files. Only use this if you accept the risk and have a way to recover.
                        </div>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}

function PolicyOption({ label, helper, active, onClick }: { label: string; helper: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
                active
                    ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5'
                    : 'border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)] hover:bg-[color:var(--color-surface-soft)]'
            }`}
        >
            <div className="flex items-start gap-3">
                <span
                    className={`mt-1 inline-block w-3.5 h-3.5 rounded-full border-2 ${
                        active
                            ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]'
                            : 'border-[color:var(--color-hairline)]'
                    }`}
                />
                <div className="flex-1">
                    <div className={`text-[14px] font-medium ${active ? 'text-[color:var(--color-ink)]' : 'text-[color:var(--color-body-strong)]'}`}>{label}</div>
                    <div className="text-[12.5px] text-[color:var(--color-muted)] mt-0.5 leading-snug">{helper}</div>
                </div>
            </div>
        </button>
    );
}

function formatDuration(ms: number): string {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} hr`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
}
