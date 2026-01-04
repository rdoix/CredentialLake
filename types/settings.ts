export interface ApiKeys {
  intelx: string;
  nvd: string;
  telegram: string;
  slack: string;
  teams: string;
}

export interface NotificationConfig {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
  teams: {
    enabled: boolean;
    webhookUrl: string;
  };
}

export interface NotificationTriggers {
  onScanComplete: boolean;
  onScanFailed: boolean;
  onAdminFound: boolean;
  onWeakPasswordFound: boolean;
  dailySummary: boolean;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'auto';
  timezone: string; // e.g., 'Asia/Jakarta' (GMT+7)
  pageSize: number;
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
  showPasswordsByDefault: boolean;
  exportFormat: 'csv' | 'json' | 'xlsx';
}

export interface SystemSettings {
  maxConcurrentScans: number;
  scanTimeout: number; // in seconds
  retryAttempts: number;
  dataRetentionDays: number;
  enableAuditLog: boolean;
  enableTwoFactor: boolean;

  // Runtime tunables for parallelism (exposed in Settings UI)
  // - rqWorkers: number of RQ worker processes (job-level concurrency)
  // - parallelDomainWorkers: per-job ThreadPool workers for multi-domain scans
  // - domainScanDelay: delay between domain requests in seconds
  rqWorkers: number;
  parallelDomainWorkers: number;
  domainScanDelay: number;
}

export interface Settings {
  apiKeys: ApiKeys;
  notifications: NotificationConfig;
  notificationTriggers: NotificationTriggers;
  preferences: UserPreferences;
  system: SystemSettings;
}
