'use client';

import { useState, useEffect } from 'react';
import { ScanSearch, Upload, ListChecks, Calendar } from 'lucide-react';
import SingleScan from '@/components/collector/SingleScan';
import MultipleScan from '@/components/collector/MultipleScan';
import FileUpload from '@/components/collector/FileUpload';
import RunningJobs from '@/components/collector/RunningJobs';
import JobScheduler from '@/components/collector/JobScheduler';
import { useUser } from '@/contexts/UserContext';
import { ScanJob, ScheduledJob } from '@/types/collector';
import { getApiUrl } from '@/lib/api-config';

type Tab = 'scanner' | 'upload' | 'jobs' | 'scheduler';

const API_BASE_URL = getApiUrl();

export default function Collector() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [runningJobs, setRunningJobs] = useState<ScanJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useUser();

  const tabs = [
    { id: 'scanner' as Tab, label: 'Active Scanner', icon: ScanSearch },
    { id: 'upload' as Tab, label: 'File Upload', icon: Upload },
    { id: 'jobs' as Tab, label: 'Running Jobs', icon: ListChecks },
    { id: 'scheduler' as Tab, label: 'Job Scheduler', icon: Calendar },
  ];

  const scheduledJobs: ScheduledJob[] = [];

  // Fetch real jobs from API
  const fetchJobs = async () => {
    // Fetch real jobs
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();

      const raw = Array.isArray(data) ? data : [];
      // Diagnostics: log job count and a sample payload
      console.group('[Collector] jobs fetch result');
      console.log('count', raw.length);
      console.log('sample', raw[0]);
      console.groupEnd();

      // Transform API response to match ScanJob type
      const transformedJobs: ScanJob[] = raw.map((job: any) => {
        // Map backend statuses to frontend statuses with proper progress calculation
        let status: ScanJob['status'];
        let progress: number;
        
        // Preserve backend phases so UI can apply correct controls (pause/cancel only in collecting)
        switch (job.status) {
          case 'queued':
            status = 'pending';
            progress = 0;
            break;
          case 'collecting':
            status = 'collecting';
            progress = 25;
            break;
          case 'parsing':
            status = 'parsing';
            progress = 60;
            break;
          case 'upserting':
            status = 'upserting';
            progress = 85;
            break;
          case 'paused':
            status = 'paused';
            progress = 0;
            break;
          case 'cancelling':
            status = 'cancelling';
            progress = 0;
            break;
          case 'cancelled':
            status = 'cancelled';
            progress = 0;
            break;
          case 'completed':
            status = 'completed';
            progress = 100;
            break;
          case 'failed':
            status = 'failed';
            progress = 0;
            break;
          default:
            console.warn('[Collector] Unknown job status:', job.status);
            status = 'pending';
            progress = 0;
        }
        
        return {
          id: job.id,
          type: job.job_type === 'intelx_single' ? 'single' :
                job.job_type === 'intelx_bulk' ? 'bulk' :
                job.job_type === 'file_parse' ? 'file' : 'scheduled',
          target: job.query || job.name,
          // IntelX time range code (e.g., 'D1','D7','D30'); undefined/empty => All Time
          timeFilter: job.time_filter || undefined,
          status,
          progress,
          credentials: {
            total: job.total_raw || 0,
            parsed: job.total_parsed || 0,
            // Ensure unparsed is never negative (can happen with malformed data)
            unparsed: Math.max(0, (job.total_raw || 0) - (job.total_parsed || 0)),
            new: job.total_new || 0,
          },
          startedAt: job.started_at || job.created_at,
          completedAt: job.completed_at,
          error: job.error_message,
        };
      });

      setRunningJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      // Fallback to empty array on error
      setRunningJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchJobs, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Collector</h1>
        <p className="text-muted">Manage credential collection and scanning jobs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3 font-medium transition-all whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-foreground'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SingleScan />
            <MultipleScan />
          </div>
        )}

        {activeTab === 'upload' && <FileUpload />}

        {activeTab === 'jobs' && <RunningJobs jobs={runningJobs} onJobsUpdated={fetchJobs} />}

        {activeTab === 'scheduler' && <JobScheduler jobs={scheduledJobs} />}
      </div>
    </div>
  );
}
