import { Settings } from '@/types/settings';

export const getDefaultSettings = (): Settings => {
  return {
    apiKeys: {
      intelx: '',
      nvd: '',
      telegram: '',
      telegramChatId: '',
      slack: '',
      teams: '',
    },
    notifications: {
      telegram: {
        enabled: false,
        botToken: '',
        chatId: '',
      },
      slack: {
        enabled: false,
        webhookUrl: '',
        channel: '#security-alerts',
      },
      teams: {
        enabled: false,
        webhookUrl: '',
      },
    },
    notificationTriggers: {
      onScanComplete: true,
      onScanFailed: true,
      onAdminFound: true,
      onWeakPasswordFound: false,
      dailySummary: true,
    },
    preferences: {
      theme: 'dark',
      timezone: 'Asia/Jakarta', // GMT+7
      pageSize: 25,
      autoRefresh: false,
      refreshInterval: 60,
      showPasswordsByDefault: false,
      exportFormat: 'csv',
    },
    system: {
      maxConcurrentScans: 5,
      scanTimeout: 300,
      retryAttempts: 3,
      dataRetentionDays: 90,
      enableAuditLog: true,
      enableTwoFactor: false,
      // Parallelism tunables exposed in Settings UI
      // - rqWorkers: number of RQ worker processes (job-level concurrency)
      // - parallelDomainWorkers: per-job ThreadPool workers for multi-domain scans
      // - domainScanDelay: delay between domain requests in seconds
      rqWorkers: 5,
      parallelDomainWorkers: 20,
      domainScanDelay: 0.1,
    },
  };
};