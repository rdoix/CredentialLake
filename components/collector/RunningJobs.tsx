'use client';

import { ScanJob } from '@/types/collector';
import { Loader2, CheckCircle2, XCircle, Clock, FileText, Globe, Calendar, Zap, Trash2, MoreHorizontal, Info, Pause, Play, StopCircle } from 'lucide-react';
import { formatDistanceToNow, parseISO, differenceInSeconds } from 'date-fns';
import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { getApiUrl } from '@/lib/api-config';

const API_BASE_URL = getApiUrl();

// Helper function to format scan duration
const formatDuration = (start: Date, end: Date): string => {
  const seconds = differenceInSeconds(end, start);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

interface RunningJobsProps {
  jobs: ScanJob[];
  onJobsUpdated?: () => void;
}

export default function RunningJobs({ jobs, onJobsUpdated }: RunningJobsProps) {
  const { token } = useUser();
  const toast = useToast();
  const confirm = useConfirm();
  const [isClearing, setIsClearing] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState<string | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState<string | null>(null);
  const [isPausingJob, setIsPausingJob] = useState<string | null>(null);
  const [isResumingJob, setIsResumingJob] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Job credentials (max 20) state
  const [jobCreds, setJobCreds] = useState<any[]>([]);
  const [jobCredsTotal, setJobCredsTotal] = useState<number>(0);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);

  const handleClearAll = async () => {
    const accepted = await confirm({
      title: 'Clear All Jobs',
      message: 'This will permanently delete ALL jobs and cannot be undone.',
      confirmText: 'Delete All Jobs',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'text', expected: 'DELETE', label: 'Type "DELETE" to confirm' }
    });
    if (!accepted) return;

    setIsClearing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear jobs');
      }

      const result = await response.json();
      toast.success('Jobs Cleared', `Successfully deleted ${result.deleted_count} jobs`);

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (error) {
      console.error('Error clearing jobs:', error);
      toast.error('Clear Failed', 'Failed to clear jobs. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const accepted = await confirm({
      title: 'Delete Job',
      message: 'This will permanently delete the selected job.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'checkbox', label: 'I understand this action cannot be undone' }
    });
    if (!accepted) return;

    setIsDeletingJob(jobId);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Delete Failed', 'Failed to delete job. Please try again.');
    } finally {
      setIsDeletingJob(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    const accepted = await confirm({
      title: 'Cancel Job',
      message: 'This will stop the scanning progress for this job.',
      confirmText: 'Cancel Job',
      cancelText: 'Keep Running',
      variant: 'danger',
      challenge: { type: 'checkbox', label: 'I understand this will stop the scan' }
    });
    if (!accepted) return;

    setIsCancellingJob(jobId);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to cancel job');
      }

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error('Cancel Failed', `Failed to cancel job: ${error.message}`);
    } finally {
      setIsCancellingJob(null);
    }
  };

  const handlePauseJob = async (jobId: string) => {
    setIsPausingJob(jobId);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/pause`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to pause job');
      }

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (error: any) {
      console.error('Error pausing job:', error);
      toast.error('Pause Failed', `Failed to pause job: ${error.message}`);
    } finally {
      setIsPausingJob(null);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    setIsResumingJob(jobId);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to resume job');
      }

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (error: any) {
      console.error('Error resuming job:', error);
      toast.error('Resume Failed', `Failed to resume job: ${error.message}`);
    } finally {
      setIsResumingJob(null);
    }
  };

  // Open details modal and fetch job details
  const openJobDetails = async (jobId: string) => {
    // Logs to validate assumption that backend returns totals
    console.log('[RunningJobs] openJobDetails()', { jobId, ts: new Date().toISOString() });
    setIsDetailsOpen(true);
    setSelectedJobId(jobId);
    setJobDetails(null);
    setDetailsError(null);
    setIsLoadingDetails(true);

    // Reset credentials state
    setJobCreds([]);
    setJobCredsTotal(0);
    setCredsError(null);
    setIsLoadingCreds(true);

    try {
      // Fetch job details
      const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch job ${jobId}: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      console.log('[RunningJobs] fetched job details', {
        id: data?.id,
        status: data?.status,
        time_filter: data?.time_filter,
        total_raw: data?.total_raw,
        total_parsed: data?.total_parsed,
        total_new: data?.total_new,
        total_duplicates: data?.total_duplicates,
      });
      setJobDetails(data);
    } catch (err: any) {
      console.error('[RunningJobs] details fetch error', err);
      setDetailsError(err?.message || 'Failed to load job details');
    } finally {
      setIsLoadingDetails(false);
    }

    try {
      // Fetch associated credentials (max 20) via FastAPI [results.list_job_credentials()](backend/routes/results.py:73)
      const credsRes = await fetch(`${API_BASE_URL}/results/job/${jobId}?page=1&page_size=20`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!credsRes.ok) {
        throw new Error(`Failed to fetch job credentials ${jobId}: ${credsRes.status} ${credsRes.statusText}`);
      }
      const payload = await credsRes.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      console.log('[RunningJobs] fetched job credentials', {
        count: items.length,
        total: payload?.total,
        sample_is_new: items.length ? items[0]?.is_new : undefined,
      });
      setJobCreds(items);
      setJobCredsTotal(Number(payload?.total ?? items.length));
    } catch (err: any) {
      console.error('[RunningJobs] job credentials fetch error', err);
      setCredsError(err?.message || 'Failed to load credentials');
    } finally {
      setIsLoadingCreds(false);
    }
  };

  const closeJobDetails = () => {
    setIsDetailsOpen(false);
    setSelectedJobId(null);
    setJobDetails(null);
    setDetailsError(null);
    setIsLoadingDetails(false);

    // Reset credentials state on close
    setJobCreds([]);
    setJobCredsTotal(0);
    setCredsError(null);
    setIsLoadingCreds(false);
  };

  const getStatusIcon = (status: ScanJob['status']) => {
    // Diagnostic log to see actual status values from backend
    console.log('[RunningJobs] getStatusIcon called with status:', status);
    
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'collecting':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-accent" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-danger" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-warning" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-muted" />;
      default:
        // Log unhandled status
        console.warn('[RunningJobs] Unhandled status in getStatusIcon:', status);
        return <Clock className="w-5 h-5 text-muted" />;
    }
  };

  const getStatusBadge = (status: ScanJob['status']) => {
    // Diagnostic log to see actual status values from backend
    console.log('[RunningJobs] getStatusBadge called with status:', status);
    
    const styles = {
      running: 'bg-primary/10 text-primary',
      completed: 'bg-accent/10 text-accent',
      failed: 'bg-danger/10 text-danger',
      pending: 'bg-warning/10 text-warning',
      paused: 'bg-muted/10 text-muted',
      collecting: 'bg-primary/10 text-primary',
      parsing: 'bg-secondary/10 text-secondary',
      upserting: 'bg-accent/10 text-accent',
      cancelling: 'bg-danger/10 text-danger',
    };

    const style = styles[status as keyof typeof styles];
    if (!style) {
      console.warn('[RunningJobs] Unhandled status in getStatusBadge:', status);
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${style || 'bg-muted/10 text-muted'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeIcon = (type: ScanJob['type']) => {
    switch (type) {
      case 'single':
        return <Globe className="w-4 h-4" />;
      case 'bulk':
        return <Zap className="w-4 h-4" />;
      case 'file':
        return <FileText className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: ScanJob['type']) => {
    const colors = {
      single: 'text-primary',
      bulk: 'text-secondary',
      file: 'text-warning',
      scheduled: 'text-accent',
    };
    return colors[type];
  };

  // Map IntelX time filter code to human label
  const mapTimeFilterLabel = (code?: string): string => {
    switch (code) {
      case undefined:
      case '':
        return 'All Time';
      case 'D1':
        return '1 Day';
      case 'D7':
        return '7 Days';
      case 'D30':
        return '30 Days';
      case 'W1':
        return '1 Week';
      case 'W2':
        return '2 Weeks';
      case 'W4':
        return '4 Weeks';
      case 'M1':
        return '1 Month';
      case 'M3':
        return '3 Months';
      case 'M6':
        return '6 Months';
      case 'Y1':
        return '1 Year';
      default:
        return String(code);
    }
  };

  const calculateParseRate = (job: ScanJob) => {
    if (job.credentials.total === 0) return 0;
    // Ensure parse rate never exceeds 100% (can happen with malformed data)
    const rate = (job.credentials.parsed / job.credentials.total) * 100;
    return Math.min(100, rate).toFixed(1);
  };

  // Diagnostic log to see all job data from backend
  console.log('[RunningJobs] Rendering with jobs:', jobs.map(j => ({
    id: j.id,
    status: j.status,
    type: j.type,
    progress: j.progress,
    target: j.target
  })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Running Jobs</h3>
          <p className="text-sm text-muted">Monitor active and completed scan jobs</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            {jobs.filter(j => j.status === 'running').length} Running
          </div>
          <div className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium">
            {jobs.filter(j => j.status === 'completed').length} Completed
          </div>
          {jobs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isClearing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-muted mx-auto mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">No Active Jobs</h4>
          <p className="text-sm text-muted">Start a scan to see jobs appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`flex items-center gap-1 ${getTypeColor(job.type)}`}>
                        {getTypeIcon(job.type)}
                        <span className="text-xs font-medium uppercase">
                          {job.type}
                        </span>
                      </div>
                      <span className="text-muted">•</span>
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {job.target}
                      </h4>
                      <span className="text-muted">•</span>
                      <span className="text-xs text-muted">
                        Time Range: {mapTimeFilterLabel(job.timeFilter)}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Started {formatDistanceToNow(parseISO(job.startedAt), { addSuffix: true })}
                      {job.completedAt && ` • Completed ${formatDistanceToNow(parseISO(job.completedAt), { addSuffix: true })}`}
                      {job.completedAt && job.startedAt && (
                        <span className="ml-2">
                          • Duration: {formatDuration(parseISO(job.startedAt), parseISO(job.completedAt))}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(job.status)}

                  {/* Job control buttons */}
                  {(job.status === 'collecting' || job.status === 'running') && (
                    <>
                      {/* Pause only allowed in 'collecting' by backend policy */}
                      {job.status === 'collecting' && (
                        <button
                          onClick={() => handlePauseJob(job.id)}
                          disabled={isPausingJob === job.id}
                          className="p-2 hover:bg-warning/10 text-muted hover:text-warning rounded-lg transition-colors disabled:opacity-50"
                          aria-label="Pause job"
                          title="Pause"
                        >
                          {isPausingJob === job.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {/* Cancel allowed in both 'collecting' and (legacy) 'running' */}
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        disabled={isCancellingJob === job.id}
                        className="p-2 hover:bg-danger/10 text-muted hover:text-danger rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Cancel job"
                        title="Cancel"
                      >
                        {isCancellingJob === job.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <StopCircle className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}

                  {job.status === 'paused' && (
                    <button
                      onClick={() => handleResumeJob(job.id)}
                      disabled={isResumingJob === job.id}
                      className="p-2 hover:bg-accent/10 text-muted hover:text-accent rounded-lg transition-colors disabled:opacity-50"
                      aria-label="Resume job"
                      title="Resume"
                    >
                      {isResumingJob === job.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Details trigger: show full button for completed/failed; '...' for pending/running */}
                  {(job.status === 'completed' || job.status === 'failed') ? (
                    <button
                      onClick={() => openJobDetails(job.id)}
                      className="px-3 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg text-sm font-medium transition-colors"
                      aria-label="View details"
                      title="View details"
                    >
                      View Details
                    </button>
                  ) : (
                    <button
                      onClick={() => openJobDetails(job.id)}
                      className="p-2 hover:bg-card-hover text-muted hover:text-foreground rounded-lg transition-colors"
                      aria-label="More actions"
                      title="More"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    disabled={isDeletingJob === job.id}
                    className="p-2 hover:bg-danger/10 text-muted hover:text-danger rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Delete job"
                  >
                    {isDeletingJob === job.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {(job.status === 'running' || job.status === 'collecting') && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">Progress</span>
                    <span className="text-xs font-medium text-primary">{job.progress}%</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Credentials Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-background rounded-lg">
                <div>
                  <p className="text-xs text-muted mb-1">Total</p>
                  <p className="text-lg font-bold text-foreground">
                    {job.credentials.total.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Parsed</p>
                  <p className="text-lg font-bold text-accent">
                    {job.credentials.parsed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Unparsed</p>
                  <p className="text-lg font-bold text-warning">
                    {job.credentials.unparsed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">New</p>
                  <p className="text-lg font-bold text-secondary">
                    {(job.credentials.new ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Parse Rate</p>
                  <p className="text-lg font-bold text-secondary">
                    {calculateParseRate(job)}%
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {job.status === 'failed' && job.error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-danger">Error</p>
                      <p className="text-xs text-danger/80 mt-1">{job.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Job Details Modal */}
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeJobDetails} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                <h5 className="text-sm font-semibold text-foreground">Job Details</h5>
              </div>
              <button
                onClick={closeJobDetails}
                className="px-2 py-1 text-muted hover:text-foreground rounded-lg"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {isLoadingDetails && (
                <div className="flex items-center gap-2 text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading details...</span>
                </div>
              )}

              {!isLoadingDetails && detailsError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                  {detailsError}
                </div>
              )}

              {!isLoadingDetails && !detailsError && jobDetails && (
                <div className="space-y-4">
                  {/* Top summary */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted">Job ID</p>
                      <p className="text-sm font-mono text-foreground break-all">{jobDetails.id}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm text-muted">Type</p>
                      <p className="text-sm font-medium text-foreground">
                        {jobDetails.job_type === 'intelx_single' ? 'Single'
                          : jobDetails.job_type === 'intelx_bulk' ? 'Bulk'
                          : jobDetails.job_type === 'file_parse' ? 'File'
                          : jobDetails.job_type === 'scheduled' ? 'Scheduled'
                          : (jobDetails.job_type || '—')}
                      </p>
                      <p className="text-sm text-muted mt-2">Time Range</p>
                      <p className="text-sm text-foreground">{mapTimeFilterLabel(jobDetails.time_filter)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-xs text-muted mb-1">Query / Name</p>
                      <p className="text-sm text-foreground break-words">
                        {jobDetails.query || jobDetails.name || '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-xs text-muted mb-1">Status</p>
                      <div>
                        {/* Reuse badge styling visually */}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          jobDetails.status === 'running'
                            ? 'bg-primary/10 text-primary'
                            : jobDetails.status === 'completed'
                            ? 'bg-accent/10 text-accent'
                            : jobDetails.status === 'failed'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {String(jobDetails.status).charAt(0).toUpperCase() + String(jobDetails.status).slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-xs text-muted mb-1">Created</p>
                      <p className="text-sm text-foreground">{jobDetails.created_at || '—'}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-xs text-muted mb-1">Started</p>
                      <p className="text-sm text-foreground">{jobDetails.started_at || '—'}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-xs text-muted mb-1">Completed</p>
                      <p className="text-sm text-foreground">{jobDetails.completed_at || '—'}</p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-xs text-muted mb-1">Duration</p>
                    <p className="text-sm text-foreground">
                      {typeof jobDetails.duration_seconds === 'number'
                        ? `${Math.floor(jobDetails.duration_seconds / 60)}m ${Math.round(jobDetails.duration_seconds % 60)}s`
                        : '—'}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-background rounded-lg border border-border">
                    <div>
                      <p className="text-xs text-muted mb-1">Total Raw</p>
                      <p className="text-lg font-bold text-foreground">{(jobDetails.total_raw ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Parsed</p>
                      <p className="text-lg font-bold text-accent">{(jobDetails.total_parsed ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">New</p>
                      <p className="text-lg font-bold text-secondary">{(jobDetails.total_new ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Duplicates</p>
                      <p className="text-lg font-bold text-warning">{(jobDetails.total_duplicates ?? 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Completion highlight */}
                  {jobDetails.status === 'completed' && (
                    <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <p className="text-sm font-medium text-accent">Credentials parsed</p>
                      <p className="text-xs text-accent/80 mt-1">
                        Parsed {(jobDetails.total_parsed ?? 0).toLocaleString()} of {(jobDetails.total_raw ?? 0).toLocaleString()} items
                        {typeof jobDetails.total_raw === 'number' && jobDetails.total_raw > 0
                          ? ` (${((jobDetails.total_parsed / jobDetails.total_raw) * 100).toFixed(1)}%)`
                          : ''}
                      </p>
                    </div>
                  )}

                  {/* Credentials list (max 20) */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground">Credentials</p>
                      <p className="text-xs text-muted">
                        Showing up to 20 of {jobCredsTotal.toLocaleString()} items
                      </p>
                    </div>

                    {isLoadingCreds ? (
                      <div className="flex items-center gap-2 text-muted">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading credentials...</span>
                      </div>
                    ) : credsError ? (
                      <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                        {credsError}
                      </div>
                    ) : jobCreds.length === 0 ? (
                      <div className="p-3 bg-background border border-border rounded-lg text-sm text-muted">
                        No credentials found for this job.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="min-w-full text-sm">
                          <thead className="bg-card-hover">
                            <tr className="text-muted">
                              <th className="px-3 py-2 text-left">Username</th>
                              <th className="px-3 py-2 text-left">Domain</th>
                              <th className="px-3 py-2 text-left">Password</th>
                              <th className="px-3 py-2 text-left">URL</th>
                              <th className="px-3 py-2 text-left">Admin</th>
                              <th className="px-3 py-2 text-left">New</th>
                              <th className="px-3 py-2 text-left">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobCreds.map((c: any, i: number) => (
                              <tr key={c.id ?? i} className="border-t border-border">
                                <td className="px-3 py-2 text-foreground break-all">{c.username ?? '—'}</td>
                                <td className="px-3 py-2 text-foreground break-all">{c.domain ?? '—'}</td>
                                <td className="px-3 py-2 text-foreground break-all">{c.password ?? '—'}</td>
                                <td className="px-3 py-2 text-foreground break-all">
                                  {c.url ? (
                                    <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                      {c.url}
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {c.is_admin ? (
                                    <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-medium">Admin</span>
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {c.is_new ? (
                                    <span className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">New</span>
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted">
                                  {c.last_seen ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Error message if failed */}
                  {jobDetails.status === 'failed' && jobDetails.error_message && (
                    <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-danger">Error</p>
                          <p className="text-xs text-danger/80 mt-1">{jobDetails.error_message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
