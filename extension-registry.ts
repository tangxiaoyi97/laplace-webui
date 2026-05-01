import type {
  SectionRegistration,
  StylesheetRegistration,
  TileRegistration,
  WebuiExtensionApi,
  WebuiExtensionsManifest,
} from './extension-api.ts';

/**
 * In-memory store for plugin-registered UI extensions. Lives for the lifetime
 * of the webui plugin's onLoad. Bumps `revision` on every change so the
 * frontend can short-circuit when nothing has changed.
 */
export class WebuiExtensionRegistry implements WebuiExtensionApi {
  private revision = 0;
  private readonly sections = new Map<string, SectionRegistration>();
  private readonly tiles = new Map<string, TileRegistration>();
  private readonly stylesheets = new Map<string, StylesheetRegistration>();

  constructor(private readonly logger: (msg: string, type?: 'info' | 'warn' | 'error') => void = () => {}) {}

  public registerSection(section: SectionRegistration): () => void {
    const validated = this.validateSection(section);
    this.sections.set(validated.id, validated);
    this.bump(`section '${validated.id}' registered (plugin=${validated.pluginId || '?'})`);
    return () => {
      if (this.sections.delete(validated.id)) this.bump(`section '${validated.id}' unregistered`);
    };
  }

  public registerTile(tile: TileRegistration): () => void {
    const validated = this.validateTile(tile);
    this.tiles.set(validated.id, validated);
    this.bump(`tile '${validated.id}' registered (plugin=${validated.pluginId || '?'})`);
    return () => {
      if (this.tiles.delete(validated.id)) this.bump(`tile '${validated.id}' unregistered`);
    };
  }

  public registerStylesheet(stylesheet: StylesheetRegistration): () => void {
    const validated = this.validateStylesheet(stylesheet);
    this.stylesheets.set(validated.id, validated);
    this.bump(`stylesheet '${validated.id}' registered (plugin=${validated.pluginId || '?'})`);
    return () => {
      if (this.stylesheets.delete(validated.id)) this.bump(`stylesheet '${validated.id}' unregistered`);
    };
  }

  public snapshot(): WebuiExtensionsManifest {
    return {
      revision: this.revision,
      sections: Array.from(this.sections.values()).sort(this.byOrderThenId),
      tiles: Array.from(this.tiles.values()).sort(this.byOrderThenId),
      stylesheets: Array.from(this.stylesheets.values()),
    };
  }

  /** Returns a wrapper that auto-stamps `pluginId` on every registration. */
  public scopedFor(pluginId: string): WebuiExtensionApi {
    return {
      registerSection: (s) => this.registerSection({ ...s, pluginId }),
      registerTile: (t) => this.registerTile({ ...t, pluginId }),
      registerStylesheet: (s) => this.registerStylesheet({ ...s, pluginId }),
      snapshot: () => this.snapshot(),
    };
  }

  private bump(reason: string) {
    this.revision++;
    this.logger(`[WebuiExtensions] ${reason} (rev=${this.revision})`);
  }

  private byOrderThenId = (a: { order?: number; id: string }, b: { order?: number; id: string }) => {
    const oa = a.order ?? 100;
    const ob = b.order ?? 100;
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  };

  private validateSection(input: SectionRegistration): SectionRegistration {
    if (!input || typeof input !== 'object') throw new Error('Section registration must be an object.');
    if (!this.isValidId(input.id)) throw new Error(`Invalid section id: ${input.id}`);
    if (!input.label || typeof input.label !== 'string') throw new Error('Section label is required.');
    if (!this.isSafeUrl(input.iframeUrl)) throw new Error(`Invalid iframeUrl: ${input.iframeUrl}`);
    return {
      id: input.id.trim(),
      label: input.label.trim().slice(0, 80),
      group: input.group || 'plugin',
      icon: typeof input.icon === 'string' ? input.icon.slice(0, 40) : undefined,
      order: typeof input.order === 'number' ? input.order : 200,
      iframeUrl: input.iframeUrl.trim(),
      height: typeof input.height === 'number' ? Math.max(120, Math.min(2400, input.height)) : undefined,
      serverScoped: !!input.serverScoped,
      pluginId: input.pluginId,
    };
  }

  private validateTile(input: TileRegistration): TileRegistration {
    if (!input || typeof input !== 'object') throw new Error('Tile registration must be an object.');
    if (!this.isValidId(input.id)) throw new Error(`Invalid tile id: ${input.id}`);
    if (!input.label) throw new Error('Tile label is required.');
    if (input.kind !== 'stat' && input.kind !== 'iframe') throw new Error(`Tile kind must be 'stat' or 'iframe'.`);
    if (input.kind === 'iframe' && !this.isSafeUrl(input.iframeUrl || '')) throw new Error('iframe tiles need iframeUrl.');
    return {
      id: input.id.trim(),
      label: input.label.trim().slice(0, 80),
      placement: input.placement || 'plugins-overview',
      order: typeof input.order === 'number' ? input.order : 100,
      kind: input.kind,
      value: typeof input.value === 'string' ? input.value.slice(0, 200) : undefined,
      hint: typeof input.hint === 'string' ? input.hint.slice(0, 200) : undefined,
      iframeUrl: typeof input.iframeUrl === 'string' ? input.iframeUrl.trim() : undefined,
      height: typeof input.height === 'number' ? Math.max(60, Math.min(800, input.height)) : undefined,
      href: typeof input.href === 'string' && this.isSafeUrl(input.href) ? input.href.trim() : undefined,
      icon: typeof input.icon === 'string' ? input.icon.slice(0, 40) : undefined,
      pluginId: input.pluginId,
    };
  }

  private validateStylesheet(input: StylesheetRegistration): StylesheetRegistration {
    if (!input || typeof input !== 'object') throw new Error('Stylesheet registration must be an object.');
    if (!this.isValidId(input.id)) throw new Error(`Invalid stylesheet id: ${input.id}`);
    if (!this.isSafeUrl(input.url)) throw new Error(`Invalid stylesheet url: ${input.url}`);
    return {
      id: input.id.trim(),
      url: input.url.trim(),
      role: input.role === 'override' ? 'override' : 'preset',
      pluginId: input.pluginId,
    };
  }

  private isValidId(id: unknown): id is string {
    return typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/.test(id);
  }

  /** Allow same-origin paths and explicit http(s) URLs only. */
  private isSafeUrl(url: string | undefined): boolean {
    if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
    if (url.startsWith('/')) return !url.startsWith('//'); // protocol-relative is risky
    return /^https?:\/\//i.test(url);
  }
}
