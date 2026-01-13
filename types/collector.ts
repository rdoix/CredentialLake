export interface ScanJob {
  id: string;
  type: 'single' | 'bulk' | 'file' | 'scheduled';
  target: string;
  // IntelX time range code (e.g., 'D1','D7','D30','W1','M3','Y1'); empty/undefined = All Time
  timeFilter?: string;
  batchId?: string;
  batchSize?: number;
  batchQueries?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'queued' | 'collecting' | 'parsing' | 'upserting' | 'cancelling' | 'cancelled' | 'paused';
  progress: number;
  credentials: {
    total: number;
    parsed: number;
    unparsed: number;
    new: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  keywords: string[];
  schedule: string; // cron expression
  // IntelX time range code (FastAPI enum string, e.g., 'D1','D7','D30','W1','M3','Y1')
  timeFilter?: string;
  lastRun?: string;
  // nextRun may be absent while backend computes or when paused; UI predicts from cron if needed
  nextRun?: string;
  status: 'active' | 'paused' | 'error';
  notifications: {
    telegram?: boolean;
    slack?: boolean;
    teams?: boolean;
  };
  stats: {
    totalRuns: number;
    successfulRuns: number;
    lastCredentials: number;
  };
}

export interface FileUpload {
  id: string;
  filename: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  credentialsFound: number;
  uploadedAt: string;
}

export type ScanTarget = {
  keyword: string;
  maxResults?: number;
};
