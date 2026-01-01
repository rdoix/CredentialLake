'use client';

import { useEffect, useState } from 'react';
import { Calendar, KeyRound, Shield } from 'lucide-react';
import { getApiUrl } from '@/lib/api-config';

type DomainDetails = {
  domain: string;
  total_credentials: number;
  admin_count: number;
  first_discovered: string | null;
  last_seen: string | null;
  total_occurrences: number;
};

interface DomainDetailsPanelProps {
  domain?: string | null;
}

const API_BASE_URL = getApiUrl();

export default function DomainDetailsPanel({ domain }: DomainDetailsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<DomainDetails | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDetails = async () => {
      if (!domain) {
        setDetails(null);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/dashboard/domain/${encodeURIComponent(domain)}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) {
          throw new Error(`Backend responded ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as DomainDetails;
        if (!cancelled) {
          setDetails(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load domain details');
          setDetails(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Domain Details</h3>
          <p className="text-sm text-muted">
            {domain ? `Breakdown for ${domain}` : 'Click a domain bar to view details'}
          </p>
        </div>
      </div>

      {!domain && (
        <div className="flex items-center justify-center h-[200px] text-muted">
          <p>No domain selected</p>
        </div>
      )}

      {domain && loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted/20 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-muted/20 rounded" />
            <div className="h-20 bg-muted/20 rounded" />
            <div className="h-20 bg-muted/20 rounded" />
            <div className="h-20 bg-muted/20 rounded" />
          </div>
        </div>
      )}

      {domain && !loading && error && (
        <div className="text-danger text-sm">{error}</div>
      )}

      {domain && !loading && !error && details && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <KeyRound className="w-4 h-4" />
                <span>Total Credentials (unique)</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {details.total_credentials.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <Shield className="w-4 h-4" />
                <span>Admin Accounts</span>
              </div>
              <div className="text-2xl font-semibold text-danger">
                {details.admin_count.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <Calendar className="w-4 h-4" />
                <span>First Discovered</span>
              </div>
              <div className="text-lg font-medium text-foreground">
                {fmtDate(details.first_discovered)}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <Calendar className="w-4 h-4" />
                <span>Last Seen</span>
              </div>
              <div className="text-lg font-medium text-foreground">
                {fmtDate(details.last_seen)}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted">
            Counts are aggregated by root domain and reflect unique credentials (deduplicated).
          </p>
        </div>
      )}
    </div>
  );
}