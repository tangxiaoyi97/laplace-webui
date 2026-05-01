import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Eyebrow, SectionHeader } from '../components/primitives.tsx';
import type { SectionProps, SectionDescriptor } from './types.ts';

interface Props extends SectionProps {
    descriptor: SectionDescriptor;
}

/**
 * Renders a plugin-supplied section as a sandboxed iframe. The iframe loads
 * `descriptor.iframeUrl` (with `?serverId=...` appended when serverScoped),
 * gets standard sandbox flags, and is shown inside a Card to keep the visual
 * shell consistent. Plugin authors who want a borderless full-bleed canvas
 * can set their own background via the iframe's HTML.
 */
export function PluginSection({ descriptor, currentServerId, notify }: Props) {
    const src = useMemo(() => {
        if (!descriptor.iframeUrl) return null;
        if (!descriptor.serverScoped) return descriptor.iframeUrl;
        if (!currentServerId) return null;
        const sep = descriptor.iframeUrl.includes('?') ? '&' : '?';
        return `${descriptor.iframeUrl}${sep}serverId=${encodeURIComponent(currentServerId)}`;
    }, [descriptor.iframeUrl, descriptor.serverScoped, currentServerId]);

    if (!src) {
        return (
            <div>
                <SectionHeader
                    eyebrow={`Plugin · ${descriptor.pluginId || 'extension'}`}
                    title={descriptor.label}
                    lead={descriptor.serverScoped ? 'This plugin section needs a focused server. Pick one from the sidebar.' : 'Plugin did not provide a URL.'}
                />
            </div>
        );
    }

    const height = descriptor.iframeHeight || 720;

    return (
        <div>
            <SectionHeader
                eyebrow={`Plugin · ${descriptor.pluginId || 'extension'}`}
                title={descriptor.label}
                action={
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                    >
                        <ExternalLink size={12} /> Open in new tab
                    </a>
                }
            />
            <Card tone="canvas" padded={false} className="overflow-hidden">
                <iframe
                    src={src}
                    title={descriptor.label}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                    style={{ width: '100%', height: `${height}px`, border: 0, display: 'block', background: 'var(--color-canvas)' }}
                    referrerPolicy="same-origin"
                    loading="lazy"
                />
            </Card>
            <Eyebrow className="mt-3 text-[color:var(--color-muted-soft)]">{descriptor.iframeUrl}</Eyebrow>
        </div>
    );
}
