import React from 'react';
import { ExternalLink, Puzzle } from 'lucide-react';
import { Card, Eyebrow, Pill, SectionHeader } from '../components/primitives.tsx';
import type { TileRegistration } from '../lib/extensions.ts';

interface Props {
    tiles: TileRegistration[];
    sectionsCount: number;
    stylesheetsCount: number;
}

export function PluginsOverview({ tiles, sectionsCount, stylesheetsCount }: Props) {
    return (
        <div>
            <SectionHeader
                eyebrow="Plugins"
                title="Extensions"
                lead="Tiles, sections and stylesheets contributed by other plugins. Each plugin namespaces its registrations and can be inspected with `webui ext list` in the TUI."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <SummaryStat label="Sections" value={sectionsCount} hint="In the sidebar" />
                <SummaryStat label="Tiles" value={tiles.length} hint="Cards on this page" />
                <SummaryStat label="Stylesheets" value={stylesheetsCount} hint="Injected into <head>" />
            </div>

            {tiles.length === 0 ? (
                <Card tone="cream" padded className="text-center py-12">
                    <Puzzle size={28} className="mx-auto mb-3 text-[color:var(--color-muted)]" />
                    <h3 className="display-sm mb-2">No tiles registered yet.</h3>
                    <p className="text-[14px] text-[color:var(--color-muted)] max-w-md mx-auto">
                        Plugins can add cards here by calling <span className="font-mono">ctx.services.get('webui:extensions').registerTile(...)</span>.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tiles.map((tile) => (
                        <PluginTile key={tile.id} tile={tile} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SummaryStat({ label, value, hint }: { label: string; value: number; hint: string }) {
    return (
        <Card tone="card" padded>
            <Eyebrow className="mb-2">{label}</Eyebrow>
            <div className="display-md mb-1">{value}</div>
            <div className="text-[12px] text-[color:var(--color-muted)]">{hint}</div>
        </Card>
    );
}

export function PluginTile({ tile }: { tile: TileRegistration }) {
    if (tile.kind === 'iframe' && tile.iframeUrl) {
        return (
            <Card tone="canvas" padded={false} className="overflow-hidden">
                <div className="px-5 pt-4 pb-2 border-b border-[color:var(--color-hairline)]">
                    <Eyebrow>{tile.pluginId ? `${tile.pluginId} · ${tile.label}` : tile.label}</Eyebrow>
                </div>
                <iframe
                    src={tile.iframeUrl}
                    title={tile.label}
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    style={{ width: '100%', height: `${tile.height ?? 140}px`, border: 0, display: 'block', background: 'var(--color-canvas)' }}
                    referrerPolicy="same-origin"
                    loading="lazy"
                />
            </Card>
        );
    }

    const inner = (
        <Card tone="canvas" padded className="h-full">
            <div className="flex items-start justify-between gap-3 mb-3">
                <Eyebrow>{tile.label}</Eyebrow>
                {tile.pluginId ? <Pill tone="neutral">{tile.pluginId}</Pill> : null}
            </div>
            <div className="display-md mb-1 truncate" title={tile.value}>{tile.value || '—'}</div>
            {tile.hint ? <div className="text-[12px] text-[color:var(--color-muted)]">{tile.hint}</div> : null}
            {tile.href ? (
                <div className="mt-3 inline-flex items-center gap-1 text-[12px] text-[color:var(--color-primary)]">
                    Open <ExternalLink size={11} />
                </div>
            ) : null}
        </Card>
    );

    if (tile.href) {
        return (
            <a href={tile.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                {inner}
            </a>
        );
    }
    return inner;
}
