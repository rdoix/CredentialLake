'use client';

import { Shield, AlertTriangle, TrendingUp, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CVE, CVEStats } from '@/types/cve';
import { getApiUrl } from '@/lib/api-config';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';

const API_BASE_URL = getApiUrl();

export default function CVEFeedCard() {
  const router = useRouter();
  const { token } = useUser();
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };
  const [stats, setStats] = useState<CVEStats | null>(null);
  const [recentCVEs, setRecentCVEs] = useState<CVE[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [hasNvdKey, setHasNvdKey] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedCVE, setSelectedCVE] = useState<CVE | null>(null);

  // Format last sync with explicit Jakarta timezone using Intl API (robust across browsers)
  const formatJakarta = (iso: string | null) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d) + ' WIB';
    } catch {
      // Fallback if Intl fails
      return d.toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
      }) + ' WIB';
    }
  };

  useEffect(() => {
    const fetchCVEData = async () => {
      try {
        const [statsRes, recentRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/cve/stats/?days=90`, { headers: buildHeaders() }),
          // Request a larger window, then client-filter and cap to 5 so we avoid "empty" when top 5 are rejected
          fetch(`${API_BASE_URL}/cve/recent/?limit=25&days=90`, { headers: buildHeaders() }),
          fetch(`${API_BASE_URL}/settings/`, { headers: buildHeaders() })
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (recentRes.ok) {
          const recentData = await recentRes.json();
          const filtered = Array.isArray(recentData) ? recentData.filter((c: any) => !c?.is_rejected).slice(0, 5) : [];
          setRecentCVEs(filtered);
        }
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setLastSyncAt(settingsData?.last_cve_sync_at ?? null);
          setHasNvdKey(!!settingsData?.nvd_api_key);
        }
      } catch (error) {
        console.error('Error fetching CVE data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCVEData();
  }, []);
  
  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      // Trigger incremental sync; backend uses last_cve_sync_at or falls back to 1 day
      let lastSyncFromResp: string | null = null;
      try {
        const syncRes = await fetch(`${API_BASE_URL}/cve/sync-incremental/`, {
          method: 'POST',
          headers: buildHeaders(),
        });
        if (syncRes.ok) {
          const body = await syncRes.json().catch(() => null);
          lastSyncFromResp = body?.last_sync_at ?? null;
          // update immediately so user sees correct time without waiting for settings refresh
          if (lastSyncFromResp) {
            setLastSyncAt(lastSyncFromResp);
          }
        }
      } catch {
        // ignore sync error, still try to refresh current data
      }

      // Refresh card data
      const [statsRes, recentRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cve/stats/?days=90`, { headers: buildHeaders() }),
        fetch(`${API_BASE_URL}/cve/recent/?limit=25&days=90`, { headers: buildHeaders() }),
        fetch(`${API_BASE_URL}/settings/`, { headers: buildHeaders() }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const filtered = Array.isArray(recent) ? recent.filter((c: any) => !c?.is_rejected).slice(0, 5) : [];
        setRecentCVEs(filtered);
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        // Prefer server settings timestamp if present; otherwise keep the one from sync response
        setLastSyncAt(s?.last_cve_sync_at ?? lastSyncFromResp ?? null);
        setHasNvdKey(!!s?.nvd_api_key);
      } else if (lastSyncFromResp) {
        setLastSyncAt(lastSyncFromResp);
      }
    } catch (e) {
      console.error('Sync now failed:', e);
    } finally {
      setSyncing(false);
    }
  };
  
  // (duplicate handleSyncNow removed)

  const getSeverityColor = (severity: string | null) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'HIGH':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'LOW':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getSeverityIcon = (severity: string | null) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            CVE Feed (Last 90 Days)
          </h3>
          <p className="text-sm text-muted">Latest security vulnerabilities from the past 90 days</p>
        </div>
        <div className="text-right">
          <button
            onClick={() => router.push('/cve')}
            className="text-sm text-primary hover:underline flex items-center gap-1 justify-end cursor-pointer"
          >
            View All
            <ExternalLink className="w-3 h-3" />
          </button>
          <div className="text-xs text-muted mt-1">
            Last sync: {formatJakarta(lastSyncAt)}
          </div>
          <div className="mt-2 flex items-center gap-2 justify-end">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-3 py-1 text-xs bg-background border border-border rounded hover:bg-card-hover transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowTooltip(!showTooltip)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-background border border-border rounded cursor-help hover:bg-card-hover transition-colors"
              >
                ?
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50 text-left">
                  <h4 className="text-sm font-semibold text-foreground mb-2">CVE Sync Tips</h4>
                  <ul className="space-y-2 text-xs text-muted">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Auto-sync:</strong> Runs daily at 2:00 AM Jakarta time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>API Key Status:</strong> {hasNvdKey ? 'Configured ✓' : 'Not set — add in Settings for faster sync'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Without API key:</strong> ~5 requests/30s, ~7s delay, ~300 CVEs per run</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>With API key:</strong> 50 requests/30s, ~1s delay, up to ~2000 CVEs per run</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Data is automatically deduplicated by CVE ID</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Incremental sync only fetches new CVEs since last sync</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</div>
            <div className="text-xs text-muted">CVEs (90 Days)</div>
          </div>
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-foreground flex items-center gap-1">
              {stats.recent_7days}
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div className="text-xs text-muted">Last 7 Days</div>
          </div>
        </div>
      )}

      {/* Severity Distribution */}
      {stats && (
        <div className="mb-6">
          <div className="text-xs font-medium text-muted mb-2">By Severity</div>
          <div className="grid grid-cols-5 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{stats.by_severity.CRITICAL}</div>
              <div className="text-xs text-muted">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-500">{stats.by_severity.HIGH}</div>
              <div className="text-xs text-muted">High</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-500">{stats.by_severity.MEDIUM}</div>
              <div className="text-xs text-muted">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">{stats.by_severity.LOW}</div>
              <div className="text-xs text-muted">Low</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-400">{(stats.by_severity as any).UNASSIGNED ?? 0}</div>
              <div className="text-xs text-muted">Unassigned</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent CVEs */}
      <div>
        <div className="text-xs font-medium text-muted mb-3">Recent Vulnerabilities</div>
        {recentCVEs.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No CVE data available</p>
            <p className="text-xs mt-1">Sync CVEs from NVD to see data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCVEs.map((cve) => (
              <div
                key={cve.id}
                onClick={() => setSelectedCVE(cve)}
                className="bg-background/50 border border-border rounded-lg p-3 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-mono font-semibold text-primary">
                      {cve.cve_id}
                    </span>
                    {cve.is_rejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-500/10 border-gray-500/20 text-gray-500">
                        Rejected
                      </span>
                    )}
                    {cve.severity && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(
                          cve.severity
                        )}`}
                      >
                        {getSeverityIcon(cve.severity)}
                        {cve.severity}
                      </span>
                    )}
                  </div>
                  {cve.cvss_v3_score && (
                    <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
                      {cve.cvss_v3_score.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground mb-1 line-clamp-1">{cve.title}</p>
                <p className="text-xs text-muted line-clamp-2">{cve.description}</p>
                <div className="text-xs text-muted/70 mt-2">
                  {new Date(cve.published_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => router.push('/cve')}
          className="block w-full text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
        >
          Explore All CVEs →
        </button>
      </div>

      {/* CVE Detail Modal */}
      {selectedCVE && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCVE(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">{selectedCVE.cve_id}</h2>
              <button
                onClick={() => setSelectedCVE(null)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedCVE.severity && (
              <div className="mb-4">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${getSeverityColor(
                    selectedCVE.severity
                  )}`}
                >
                  {getSeverityIcon(selectedCVE.severity)}
                  {selectedCVE.severity} Severity
                </span>
              </div>
            )}

            <div className="space-y-4">
              {selectedCVE.is_rejected && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-500 font-medium">
                    ⚠️ This CVE has been rejected and is not a valid vulnerability.
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-muted mb-2">Title</h3>
                <p className="text-base font-semibold text-foreground">{selectedCVE.title}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted mb-2">Description</h3>
                <p className="text-sm text-foreground">{selectedCVE.description}</p>
              </div>

              {selectedCVE.cvss_v3_score && (
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">CVSS v3 Score</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-foreground">
                      {selectedCVE.cvss_v3_score.toFixed(1)}
                    </span>
                    {selectedCVE.cvss_v3_vector && (
                      <code className="text-xs bg-background px-3 py-1 rounded border border-border">
                        {selectedCVE.cvss_v3_vector}
                      </code>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">Published</h3>
                  <p className="text-sm text-foreground">
                    {new Date(selectedCVE.published_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">Last Modified</h3>
                  <p className="text-sm text-foreground">
                    {new Date(selectedCVE.last_modified_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {selectedCVE.cwe_id && (
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">CWE (Weakness Type)</h3>
                  <span className="inline-block px-3 py-1 bg-background rounded border border-border text-sm">
                    {selectedCVE.cwe_id}
                  </span>
                </div>
              )}

              {selectedCVE.references && selectedCVE.references !== 'null' && (
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">Patches & Advisories</h3>
                  <div className="space-y-2">
                    {(() => {
                      try {
                        const refs = JSON.parse(selectedCVE.references.replace(/'/g, '"'));
                        return refs.slice(0, 5).map((ref: string, idx: number) => (
                          <a
                            key={idx}
                            href={ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary hover:underline truncate"
                          >
                            🔗 {ref}
                          </a>
                        ));
                      } catch {
                        return <p className="text-sm text-muted">No references available</p>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {selectedCVE.affected_products && selectedCVE.affected_products !== 'null' && (
                <div>
                  <h3 className="text-sm font-semibold text-muted mb-2">Affected Products</h3>
                  <div className="text-sm text-foreground bg-background rounded border border-border p-3 max-h-40 overflow-y-auto">
                    {(() => {
                      try {
                        const products = JSON.parse(selectedCVE.affected_products.replace(/'/g, '"'));
                        return products.slice(0, 10).map((product: string, idx: number) => (
                          <div key={idx} className="py-1 text-xs font-mono">
                            • {product}
                          </div>
                        ));
                      } catch {
                        return <p className="text-muted">No product information available</p>;
                      }
                    })()}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => router.push('/cve')}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  View in CVE Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}