export interface AppConfig {
  panelPort: number;
  activeServer: string | null;
  theme: string;
}

export interface TuiInterface {
  registerCommand(command: string, description: string, handler: (args: string[]) => Promise<void> | void): void;
  addHeaderInfo(label: string, value: string): void;
  log(msg: string, color?: string): void;
}

export interface PluginRuntimeContext {
  pluginId: string;
  pluginRoot: string;
  pluginDataDir: string;
  server: any;
  users: any;
  tui: TuiInterface;
  wss: any;
  appRoot: string;
  dataRoot: string;
  getConfig: () => AppConfig;
  updateConfig: (updater: (config: AppConfig) => AppConfig | void | Promise<AppConfig | void>) => Promise<AppConfig>;
  logger: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  createRouter: () => any;
  mountRouter: (mountPath: string, router: any) => void;
  mountStatic: (mountPath: string, directory: string, options?: { index?: boolean; maxAge?: number }) => void;
  registerCommand: (command: string, description: string, handler: (args: string[]) => Promise<void> | void) => void;
  addHeaderInfo: (label: string, value: string) => void;
}

export interface LaplacePlugin {
  onLoad(ctx: PluginRuntimeContext): void | Promise<void>;
  onUnload?(ctx: PluginRuntimeContext): void | Promise<void>;
}
