'use client';

import { useState } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiUrl } from '@/lib/api-config';

const API_BASE_URL = getApiUrl();

const TIME_FILTERS = [
  { value: '', label: 'All Time' },
  { value: 'D1', label: '1 Day' },
  { value: 'D7', label: '7 Days' },
  { value: 'D30', label: '30 Days' },
  { value: 'W1', label: '1 Week' },
  { value: 'W2', label: '2 Weeks' },
  { value: 'W4', label: '4 Weeks' },
  { value: 'M1', label: '1 Month' },
  { value: 'M3', label: '3 Months' },
  { value: 'M6', label: '6 Months' },
  { value: 'Y1', label: '1 Year' },
];

export default function SingleScan() {
  const [keyword, setKeyword] = useState('');
  const [maxResults, setMaxResults] = useState('1000');
  const [displayLimit, setDisplayLimit] = useState('50');
  const [timeFilter, setTimeFilter] = useState('');
  const [sendAlert, setSendAlert] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { token } = useUser();
  const toast = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();


    // Real mode - call API
    setIsScanning(true);

    try {
      const payload: any = {
        query: keyword,
        name: `Scan: ${keyword}`,
        max_results: parseInt(maxResults),
        display_limit: parseInt(displayLimit),
        send_alert: sendAlert,
      };

      if (timeFilter) {
        payload.time_filter = timeFilter;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // Optionally include IntelX key if stored locally and not masked
      try {
        const saved = localStorage.getItem('intelx_scanner_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          const key: string | undefined = parsed?.apiKeys?.intelx;
          if (typeof key === 'string' && key.length > 0 && !key.includes('*')) {
            headers['X-Intelx-Key'] = key;
          }
        }
      } catch {
        // ignore localStorage parsing issues
      }
      const response = await fetch(`${API_BASE_URL}/scan/intelx/single`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Scan Started Successfully!', `Job ID: ${data.job_id}\n\nCheck the "Running Jobs" tab to monitor progress.`);
        setKeyword('');
      } else {
        toast.error('Scan Failed', data.detail || 'Failed to start scan');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Connection Error', error instanceof Error ? error.message : 'Failed to connect to server');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Single Domain/Keyword Scan</h3>
        <p className="text-sm text-muted">Search IntelX for credentials related to a specific domain or keyword</p>
      </div>

      <form onSubmit={handleScan} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Domain or Keyword *
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="example.com or keyword"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          />
          <p className="mt-1 text-xs text-muted">Enter a domain name or search keyword</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Max Results
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              placeholder="1000"
              min="1"
              max="10000"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Time Filter
            </label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {TIME_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          Advanced Options
        </button>

        {/* Advanced Options Panel */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-background border border-border rounded-lg">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Display Limit
              </label>
              <input
                type="number"
                value={displayLimit}
                onChange={(e) => setDisplayLimit(e.target.value)}
                placeholder="50"
                min="1"
                max="1000"
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-muted">Number of results to display (1-1000)</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sendAlert"
                checked={sendAlert}
                onChange={(e) => setSendAlert(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="sendAlert" className="text-sm text-foreground cursor-pointer">
                Send alert notification when scan completes
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isScanning || !keyword}
          className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting Scan...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Start Single Scan
            </>
          )}
        </button>

        <div className="text-xs text-muted space-y-1">
          <p>• Searches IntelX database for leaked credentials</p>
          <p>• Results are processed and stored in the database</p>
          <p>• Admin accounts are automatically flagged</p>
        </div>
      </form>
    </div>
  );
}
