'use client';

import { useEffect, useState } from 'react';
import { ScheduledJob } from '@/types/collector';
import { Calendar, Play, Pause, Trash2, Plus, Bell, Zap, Edit2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import TagInput from './TagInput';
import { getApiUrl } from '@/lib/api-config';
import { useUser } from '@/contexts/UserContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';

// NOTE: Avoid manual timezone offsets; normalize ISO and ensure UTC for robust parsing across browsers.
const parseIsoSafe = (iso?: string | null) => {
  if (!iso) return undefined;
  try {
    let s = String(iso).trim();

    // Ensure a timezone designator exists; if missing, assume UTC
    const hasTz = /([Zz]|[+\-]\d{2}:?\d{2})$/.test(s);
    if (!hasTz) {
      s += 'Z';
    }

    // Normalize fractional seconds to a maximum of 3 digits (millisecond precision)
    // Some engines misparse >3 fractional digits
    s = s.replace(/(\.\d{3})\d+([Zz]|[+\-]\d{2}:?\d{2})$/, '$1$2');

    // Primary: native Date parsing (handles timezone properly)
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d;
    }

    // Fallback: date-fns parseISO
    const d2 = parseISO(s);
    if (!isNaN(d2.getTime())) {
      return d2;
    }

    // Final fallback: original input
    const d3 = new Date(iso as string);
    return isNaN(d3.getTime()) ? undefined : d3;
  } catch {
    // Fallback for non-standard strings
    const d = new Date(iso as string);
    return isNaN(d.getTime()) ? undefined : d;
  }
};

// Compute a reasonable "next run" fallback locally for common cron patterns
// If the backend hasn't populated next_run yet, we avoid "less than a minute ago"
// by predicting the next occurrence at :00 for supported schedules.
const computeNextRunFromCron = (cron: string, now: Date = new Date()): Date | undefined => {
  const c = cron.trim();
  const current = new Date(now);

  // Every hour at minute 0
  if (c === '0 * * * *') {
    const next = new Date(current);
    next.setHours(current.getHours() + 1, 0, 0, 0);
    return next;
  }

  // Daily at 6:00 AM
  if (c === '0 6 * * *') {
    const next = new Date(current);
    next.setHours(6, 0, 0, 0);
    // If it's already past 06:00 today, roll to tomorrow 06:00
    if (current.getTime() >= next.getTime()) {
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
    }
    return next;
  }

  // Daily at midnight
  if (c === '0 0 * * *') {
    const next = new Date(current);
    // next day 00:00 local
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Weekly on Sunday at 00:00
  if (c === '0 0 * * 0') {
    const next = new Date(current);
    const day = next.getDay(); // 0=Sunday
    const daysUntilSunday = (7 - day) % 7 || 7; // if today is Sunday, schedule next Sunday
    next.setDate(next.getDate() + daysUntilSunday);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Monthly on 1st at 00:00
  if (c === '0 0 1 * *') {
    const next = new Date(current);
    // first of next month
    next.setMonth(next.getMonth() + 1, 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Unknown pattern: return undefined to let UI render "N/A"
  return undefined;
};

interface JobSchedulerProps {
  jobs: ScheduledJob[];
}

const apiBase = getApiUrl();

// Map backend ScheduledJobResponse (snake_case) to UI ScheduledJob (camelCase)
function mapApiJob(j: any): ScheduledJob {
  const predictedNext = j.next_run
    ? j.next_run
    : computeNextRunFromCron(j.schedule)?.toISOString();

  return {
    id: j.id,
    name: j.name,
    keywords: j.keywords ?? [],
    schedule: j.schedule,
    // FastAPI enum string (e.g., 'D1','D7','D30','W1','M3','Y1')
    timeFilter: typeof j.time_filter === 'string' ? j.time_filter : undefined,
    lastRun: j.last_run ?? undefined,
    // Avoid misleading "less than a minute ago" by not defaulting to now.
    nextRun: predictedNext ?? undefined,
    status: j.is_active ? 'active' : 'paused',
    notifications: {
      telegram: !!j.notify_telegram,
      slack: !!j.notify_slack,
      teams: !!j.notify_teams,
    },
    stats: {
      totalRuns: j.total_runs ?? 0,
      successfulRuns: j.successful_runs ?? 0,
      lastCredentials: j.last_credentials ?? 0,
    },
  };
}

export default function JobScheduler({ jobs: initialJobs }: JobSchedulerProps) {
  const { token } = useUser();
  const confirm = useConfirm();
  const toast = useToast();
  const [jobs, setJobs] = useState(initialJobs ?? []);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Live phase map: scheduled_job_id -> latest scan phase (queued/collecting/parsing/upserting/completed/failed/cancelling/cancelled)
  const [latestPhase, setLatestPhase] = useState<Record<string, string>>({});

  // Controlled form state
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [schedule, setSchedule] = useState('0 6 * * *'); // default Daily 06:00
  const [timeFilter, setTimeFilter] = useState('24h');   // default yesterday
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifySlack, setNotifySlack] = useState(false);
  const [notifyTeams, setNotifyTeams] = useState(false);
  const [runImmediately, setRunImmediately] = useState(false);

  // Load jobs from backend on mount
  useEffect(() => {
    // Fetch from backend
    (async () => {
      try {
        const res = await fetch(`${apiBase}/scheduler/jobs`, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) return;
        const data = await res.json();
        const mapped = Array.isArray(data) ? data.map(mapApiJob) : [];
        // Diagnostics: confirm data flows into UI state
        console.log('[JobScheduler] fetched scheduler jobs', {
          rawCount: Array.isArray(data) ? data.length : 0,
          mappedCount: mapped.length,
          sample: mapped[0],
        });
        setJobs(mapped);
        console.log('[JobScheduler] setJobs called', { mappedCount: mapped.length });

        // Debug: log raw and parsed times to verify timezone handling
        try {
          // Browser tz offset in minutes (e.g., -420 for UTC+7)
          // Negative means the locale is ahead of UTC.
          // eslint-disable-next-line no-console
          console.group('JobScheduler time debug');
          // eslint-disable-next-line no-console
          console.log('Browser timezone offset (minutes):', new Date().getTimezoneOffset());
          mapped.forEach((j) => {
            const parsedLast = j.lastRun ? parseIsoSafe(j.lastRun) : null;
            const parsedNext = j.nextRun ? parseIsoSafe(j.nextRun) : null;
            // eslint-disable-next-line no-console
            console.log('job:', j.name, {
              lastRun_raw: j.lastRun,
              nextRun_raw: j.nextRun,
              lastRun_parsed: parsedLast,
              nextRun_parsed: parsedNext,
            });
          });
          // eslint-disable-next-line no-console
          console.groupEnd();
        } catch {
          // ignore logging errors
        }
      } catch {
        // ignore errors; UI will still work locally
      }
    })();
  }, [initialJobs]);

  // Diagnostics: log when jobs state updates
  useEffect(() => {
    console.log('[JobScheduler] jobs state length', jobs.length);
  }, [jobs]);

  // Prefer backend nextRun when it's clearly in the future; otherwise predict next :00 boundary from cron.
  const getEffectiveNextRun = (job: ScheduledJob): Date | undefined => {
    // When paused, suppress next run display to avoid implying it will run
    if (job.status === 'paused') return undefined;
    const now = new Date();
    const parsed = parseIsoSafe(job.nextRun ?? null);
    if (parsed && parsed.getTime() > now.getTime() + 30_000) {
      return parsed;
    }
    return computeNextRunFromCron(job.schedule, now);
  };

  const toggleJobStatus = async (id: string) => {
    const target = jobs.find(j => j.id === id);
    if (!target) return;
    try {
      // Decide endpoint based on current state
      const action = target.status === 'active' ? 'pause' : 'resume';
      // eslint-disable-next-line no-console
      console.log('[JobScheduler] toggleJobStatus()', { id, prev: target.status, action, ts: new Date().toISOString() });
      const res = await fetch(`${apiBase}/scheduler/jobs/${id}/${action}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        toast.error('Action Failed', `Failed to ${action} job: ${res.status} ${res.statusText}\n${txt}`);
        return;
      }
      const updated = await res.json();
      const uiJob = mapApiJob(updated);
      setJobs(prev => prev.map(j => (j.id === id ? uiJob : j)));
      // On pause, clear any remembered live phase; on resume, will refresh via polling
      setLatestPhase(prev => {
        const copy = { ...prev };
        if (action === 'pause') delete copy[id];
        return copy;
      });
    } catch (e) {
      toast.error('Network Error', 'Network error while toggling job status.');
    }
  };

  const deleteJob = async (id: string) => {
    const accepted = await confirm({
      title: 'Delete Scheduled Job',
      message: 'This will permanently delete the scheduled job and cannot be undone.',
      confirmText: 'Delete Job',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'checkbox', label: 'I understand this action cannot be undone' }
    });
    if (!accepted) return;

    try {
      await fetch(`${apiBase}/scheduler/jobs/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch { /* ignore */ }
    setJobs(prev => prev.filter(job => job.id !== id));
  };

  const getStatusBadge = (status: ScheduledJob['status']) => {
    const styles = {
      active: 'bg-accent/10 text-accent',
      paused: 'bg-warning/10 text-warning',
      error: 'bg-danger/10 text-danger',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Badge for latest scan phase derived from history
  const getPhaseBadge = (phase?: string) => {
    if (!phase) return null;
    const p = phase.toLowerCase();
    const style =
      p === 'completed' ? 'bg-accent/10 text-accent' :
      p === 'failed' ? 'bg-danger/10 text-danger' :
      p === 'queued' || p === 'pending' ? 'bg-warning/10 text-warning' :
      p === 'cancelling' || p === 'cancelled' ? 'bg-warning/10 text-warning' :
      // collecting/parsing/upserting -> running-like
      'bg-primary/10 text-primary';
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${style}`}>{label}</span>;
  };

  const parseCronSchedule = (cron: string): string => {
    const patterns: Record<string, string> = {
      '0 * * * *': 'Every hour',
      '0 0 * * *': 'Daily at midnight',
      '0 6 * * *': 'Daily at 6:00 AM',
      '0 0 * * 0': 'Weekly on Sunday',
      '0 0 1 * *': 'Monthly on 1st',
    };
    return patterns[cron] || cron;
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

  const openEditForm = (job: ScheduledJob) => {
    setShowEditForm(job.id);
    setName(job.name);
    setKeywords(job.keywords);
    setSchedule(job.schedule);
    // Map backend timeFilter code to UI select values ('24h','7d','30d')
    {
      const tf = job.timeFilter;
      const uiTf = tf === 'D1' ? '24h' : tf === 'D7' ? '7d' : tf === 'D30' ? '30d' : '24h';
      setTimeFilter(uiTf);
    }
    setNotifyTelegram(job.notifications.telegram || false);
    setNotifySlack(job.notifications.slack || false);
    setNotifyTeams(job.notifications.teams || false);
  };

  const closeEditForm = () => {
    setShowEditForm(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setKeywords([]);
    setSchedule('0 6 * * *');
    setTimeFilter('24h');
    setNotifyTelegram(false);
    setNotifySlack(false);
    setNotifyTeams(false);
    setRunImmediately(false);
  };

  const onSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || keywords.length === 0) {
      toast.warning('Missing Information', 'Please provide a job name and at least one keyword.');
      return;
    }

    const payload = {
      name,
      keywords,
      time_filter: timeFilter,             // UI code; gateway normalizes to FastAPI code
      schedule,
      timezone: 'Asia/Jakarta',
      notify_telegram: notifyTelegram,
      notify_slack: notifySlack,
      notify_teams: notifyTeams,
      run_immediately: runImmediately,
    };

    try {
      const res = await fetch(`${apiBase}/scheduler/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        toast.error('Create Failed', `Failed to create job: ${res.status} ${res.statusText}\n${t}`);
        return;
      }
      const created = await res.json();
      const uiJob = mapApiJob(created);
      setJobs([uiJob, ...jobs]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      toast.error('Network Error', 'Failed to create job (network error).');
    }
  };

  const onSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || keywords.length === 0 || !showEditForm) {
      toast.warning('Missing Information', 'Please provide a job name and at least one keyword.');
      return;
    }

    const payload = {
      name,
      keywords,
      time_filter: timeFilter,
      schedule,
      timezone: 'Asia/Jakarta',
      notify_telegram: notifyTelegram,
      notify_slack: notifySlack,
      notify_teams: notifyTeams,
    };

    try {
      const res = await fetch(`${apiBase}/scheduler/jobs/${showEditForm}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        toast.error('Update Failed', `Failed to update job: ${res.status} ${res.statusText}\n${t}`);
        return;
      }
      const updated = await res.json();
      const uiJob = mapApiJob(updated);
      setJobs(jobs.map(j => j.id === showEditForm ? uiJob : j));
      closeEditForm();
    } catch (err) {
      toast.error('Network Error', 'Failed to update job (network error).');
    }
  };

  const viewHistory = async (jobId: string) => {
    setShowHistory(jobId);
    setIsLoadingHistory(true);
    setHistoryData([]);
    
    try {
      const res = await fetch(`${apiBase}/scheduler/jobs/${jobId}/history`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch history');
      }
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistoryData([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const closeHistory = () => {
    setShowHistory(null);
    setHistoryData([]);
  };

  // Poll latest phase for each active job (every 15s)
  useEffect(() => {
    let cancelled = false;

    const fetchLatestForJobs = async () => {
      // Throttle: only poll active jobs
      const activeJobs = jobs.filter(j => j.status === 'active');
      await Promise.all(
        activeJobs.map(async (j) => {
          try {
            const res = await fetch(`${apiBase}/scheduler/jobs/${j.id}/history`, {
              headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
            if (!res.ok) return;
            const data = await res.json();
            const history = Array.isArray(data?.history) ? data.history : [];
            const latest = history[0];
            const phase: string | undefined = latest?.status;
            if (!cancelled && phase) {
              setLatestPhase(prev => (prev[j.id] === phase ? prev : { ...prev, [j.id]: phase }));
            }
          } catch {
            // ignore network errors
          }
        })
      );
    };

    // Initial fetch and interval
    fetchLatestForJobs();
    const t = setInterval(fetchLatestForJobs, 15000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Job Scheduler</h3>
          <p className="text-sm text-muted">Automate credential scanning with scheduled jobs</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Scheduled Job
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h4 className="text-md font-semibold text-foreground mb-4">New Scheduled Job</h4>
          <form className="space-y-4" onSubmit={onSubmitCreate}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Job Name</label>
              <input
                type="text"
                placeholder="e.g., Daily Banking Scan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Keywords / Domains</label>
              <TagInput
                tags={keywords}
                onChange={setKeywords}
                placeholder="Enter domains or keywords (e.g., bank.com, finance.org)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Schedule</label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="0 * * * *">Every hour</option>
                  <option value="0 0 * * *">Daily at midnight</option>
                  <option value="0 6 * * *">Daily at 6:00 AM</option>
                  <option value="0 0 * * 0">Weekly on Sunday</option>
                  <option value="0 0 1 * *">Monthly on 1st</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Time Range</label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="24h">Yesterday (00:00–23:59)</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notifications</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTelegram}
                    onChange={(e) => setNotifyTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Telegram</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifySlack}
                    onChange={(e) => setNotifySlack(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Slack</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTeams}
                    onChange={(e) => setNotifyTeams(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Microsoft Teams</span>
                </label>
              </div>
            </div>
 
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runImmediately}
                  onChange={(e) => setRunImmediately(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm text-foreground">Run Immediately (trigger now)</span>
              </label>
            </div>
 
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
              >
                Create Job
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeEditForm} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl" role="dialog" aria-modal="true" aria-label="Edit Scheduled Job">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h5 className="text-sm font-semibold text-foreground">Edit Scheduled Job</h5>
              <button
                onClick={closeEditForm}
                className="px-2 py-1 text-muted hover:text-foreground rounded-lg"
                aria-label="Close edit"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={onSubmitEdit}>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Job Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Daily Banking Scan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Keywords / Domains</label>
                  <TagInput
                    tags={keywords}
                    onChange={setKeywords}
                    placeholder="Enter domains or keywords (e.g., bank.com, finance.org)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Schedule</label>
                    <select
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="0 * * * *">Every hour</option>
                      <option value="0 0 * * *">Daily at midnight</option>
                      <option value="0 6 * * *">Daily at 6:00 AM</option>
                      <option value="0 0 * * 0">Weekly on Sunday</option>
                      <option value="0 0 1 * *">Monthly on 1st</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Time Range</label>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="24h">Yesterday (00:00–23:59)</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Notifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyTelegram}
                        onChange={(e) => setNotifyTelegram(e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm text-foreground">Telegram</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifySlack}
                        onChange={(e) => setNotifySlack(e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm text-foreground">Slack</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyTeams}
                        onChange={(e) => setNotifyTeams(e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm text-foreground">Microsoft Teams</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
                  >
                    Update Job
                  </button>
                  <button
                    type="button"
                    onClick={closeEditForm}
                    className="px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h4 className="text-lg font-semibold text-foreground">{job.name}</h4>
                  {getStatusBadge(job.status)}
                  {/* Live latest phase badge */}
                  {getPhaseBadge(latestPhase[job.id])}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span>{parseCronSchedule(job.schedule)}</span>
                  <span>•</span>
                  <span>Time: {mapTimeFilterLabel(job.timeFilter)}</span>
                  <span>•</span>
                  <span>{job.keywords.length} keywords</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditForm(job)}
                  className="p-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
                  title="Edit job"
                  aria-label="Edit job"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleJobStatus(job.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    job.status === 'active'
                      ? 'bg-warning/10 hover:bg-warning/20 text-warning'
                      : 'bg-accent/10 hover:bg-accent/20 text-accent'
                  }`}
                  title={job.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
                  aria-label={job.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
                >
                  {job.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={async () => { try { await fetch(`${apiBase}/scheduler/jobs/${job.id}/run-now`, { method: 'POST', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); } catch {} }}
                  className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                  title="Run once now"
                  aria-label="Run once now"
                >
                  <Zap className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteJob(job.id)}
                  className="p-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg transition-colors"
                  title="Delete job"
                  aria-label="Delete job"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Keywords */}
            <div className="flex flex-wrap gap-2 mb-4">
              {job.keywords.map((keyword, i) => (
                <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                  {keyword}
                </span>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-background rounded-lg mb-4">
              <div>
                <p className="text-xs text-muted mb-1">Total Runs</p>
                <p className="text-lg font-bold text-foreground">{job.stats.totalRuns}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Success Rate</p>
                <p className="text-lg font-bold text-accent">
                  {job.stats.totalRuns > 0
                    ? `${((job.stats.successfulRuns / job.stats.totalRuns) * 100).toFixed(0)}%`
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Last Run</p>
                <p className="text-sm font-medium text-foreground">
                  {job.lastRun ? formatDistanceToNow(parseIsoSafe(job.lastRun)!, { addSuffix: true }) : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Next Run</p>
                <p className="text-sm font-medium text-primary">
                  {(() => {
                    const next = getEffectiveNextRun(job);
                    return next ? formatDistanceToNow(next, { addSuffix: true }) : 'N/A';
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Last Credentials</p>
                <p className="text-lg font-bold text-secondary">
                  {job.stats.lastCredentials.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => viewHistory(job.id)}
                className="text-sm text-primary hover:underline"
              >
                View Run History →
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-4">
              <Bell className="w-4 h-4 text-muted" />
              <div className="flex gap-2">
                {job.notifications.telegram && (
                  <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-xs">Telegram</span>
                )}
                {job.notifications.slack && (
                  <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-xs">Slack</span>
                )}
                {job.notifications.teams && (
                  <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-xs">Teams</span>
                )}
                {!job.notifications.telegram && !job.notifications.slack && !job.notifications.teams && (
                  <span className="text-xs text-muted">No notifications configured</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && !showCreateForm && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-muted mx-auto mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">No Scheduled Jobs</h4>
          <p className="text-sm text-muted mb-4">Create your first automated scan job</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
          >
            Create Job
          </button>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeHistory} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h5 className="text-sm font-semibold text-foreground">Run History</h5>
              <button
                onClick={closeHistory}
                className="px-2 py-1 text-muted hover:text-foreground rounded-lg"
                aria-label="Close history"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted">Loading history...</div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted">No run history available</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((run: any) => (
                    <div key={run.id} className="p-4 bg-background border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            run.status === 'completed' ? 'bg-accent/10 text-accent' :
                            run.status === 'failed' ? 'bg-danger/10 text-danger' :
                            run.status === 'running' ? 'bg-primary/10 text-primary' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {run.status}
                          </span>
                          <span className="text-sm text-muted">{run.query}</span>
                          <span className="text-xs text-muted">• Time: {mapTimeFilterLabel(run.time_filter)}</span>
                        </div>
                        <span className="text-xs text-muted">
                          {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted">Raw</p>
                          <p className="font-medium text-foreground">{run.total_raw || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Parsed</p>
                          <p className="font-medium text-accent">{run.total_parsed || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">New</p>
                          <p className="font-medium text-secondary">{run.total_new || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Duplicates</p>
                          <p className="font-medium text-warning">{run.total_duplicates || 0}</p>
                        </div>
                      </div>
                      {run.error_message && (
                        <div className="mt-2 p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
                          {run.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
