// Independent Type Definition for the Web UI Plugin
export interface Player {
  uuid: string;
  name: string;
  lastLogin: number;
  isOnline: boolean;
  isOp: boolean;
  isBanned: boolean;
  isWhitelisted: boolean;
  avatarUrl?: string;
  source: 'cache' | 'rcon' | 'ops' | 'whitelist';
  meta?: {
    firstSeen?: number;
    notes?: string;
  };
  linkedUser?: {
      id: string;
      username: string;
      externalIds: Record<string, string>;
  };
}

export interface ServerConfig {
  id: string;
  name: string;
  jarFile: string;
  javaArgs: {
    xmx: string;
    xms: string;
    args: string;
  };
  rconPort: number;
  rconPassword?: string;
  autoRestart: boolean;
  created: number;
}

export interface ServerCreationParams {
    name: string;
    sourceJarPath: string;
    port: number;
    maxPlayers: number;
    motd: string;
    xmx: string;
    xms: string;
    eulaAccepted: boolean;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'chat';
}

export const ViewState = {
  AUTH: 'AUTH',
  DASHBOARD: 'DASHBOARD',
  SERVER_WIZARD: 'SERVER_WIZARD',
  FILES: 'FILES',
  PLAYERS: 'PLAYERS',
  LOGS: 'LOGS',
  SETTINGS: 'SETTINGS',
  BACKUPS: 'BACKUPS',
};

export type ViewState = typeof ViewState[keyof typeof ViewState];

export interface ServerStatus {
    running: boolean;
    status: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'RESTARTING' | 'CRASHED';
    activeServerId: string | null;
    serverName?: string;
    startTime?: number;
}

export type WSMessage = 
  | { type: 'LOG', payload: LogEntry }
  | { type: 'STATUS', payload: ServerStatus }
  | { type: 'AUTH_REQUIRED' };

export type PlayerActionType = 'kick' | 'ban' | 'pardon' | 'op' | 'deop' | 'whitelist_add' | 'whitelist_remove' | 'message';

export interface ServerSettingsPayload {
    config: ServerConfig;
    properties: Record<string, string>;
}

export interface BackupItem {
    id: string;
    name: string;
    timestamp: number;
    size: number;
    path: string;
}

export interface PublicServerInfo {
    name: string;
    motd: string;
    status: ServerStatus['status'];
    version: string;
    coreType: string;
    players: {
        online: number;
        max: number;
        list: string[];
    };
    lastUpdated: number;
}