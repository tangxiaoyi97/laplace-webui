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

export interface CrashPolicy {
  maxRestarts: number;
  restartDelayMs: number;
  resetAfterMs: number;
}

export interface BackupSchedule {
  enabled: boolean;
  intervalMinutes: number;
  retainCount: number;
  retainAgeDays?: number;
  namePrefix: string;
  requireOffline: boolean;
  stopRestartIfOnline: boolean;
  lastRunAt?: number;
  lastRunStatus?: 'ok' | 'skipped' | 'error';
  lastRunMessage?: string;
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
  crashPolicy?: CrashPolicy;
  backupSchedule?: BackupSchedule;
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
  SERVERS_OVERVIEW: 'SERVERS_OVERVIEW',
  SERVER_WIZARD: 'SERVER_WIZARD',
  FILES: 'FILES',
  PLAYERS: 'PLAYERS',
  LOGS: 'LOGS',
  SETTINGS: 'SETTINGS',
  BACKUPS: 'BACKUPS',
  BACKUP_SCHEDULE: 'BACKUP_SCHEDULE',
};

export type ViewState = typeof ViewState[keyof typeof ViewState];

export interface ServerStatus {
    running: boolean;
    status: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'RESTARTING' | 'CRASHED';
    activeServerId: string | null;
    serverName?: string;
    startTime?: number;
    busy?: boolean;
    busyScopes?: string[];
}

export type WSMessage =
  | { type: 'LOG', serverId?: string, payload: LogEntry }
  | { type: 'STATUS', serverId?: string, payload: ServerStatus }
  | { type: 'AUTH_REQUIRED' }
  | { type: 'BACKUP_SCHEDULE', payload: any }
  | { type: 'ERROR', payload: { message: string } };

export interface ServerSummary {
  id: string;
  name: string;
  port: number | null;
  status: ServerStatus['status'];
  running: boolean;
  startTime?: number;
}

export interface ServersResponse {
  activeServer: string | null;
  servers: ServerSummary[];
  runningIds: string[];
}

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
