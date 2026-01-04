'use client';

import { useState, useEffect } from 'react';
import { Shield, Search, Filter, Download, ExternalLink, AlertTriangle, Info } from 'lucide-react';
import { CVE, CVEListResponse, CVEFilters } from '@/types/cve';
import { getApiUrl } from '@/lib/api-config';
import { useUser } from '@/contexts/UserContext';
import DateTimeRangePicker, { DateTimeRange } from '@/components/DateTimeRangePicker';

const API_BASE_URL = getApiUrl();

export default function CVEPage() {
  const { token } = useUser();
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };
  const [cves, setCves] = useState<CVE[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCVE, setSelectedCVE] = useState<CVE | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<CVEFilters>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hideRejected, setHideRejected] = useState(true); // Hide rejected CVEs by default
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Generate year options (1999 to current year + 1)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1998 }, (_, i) => currentYear + 1 - i);

  useEffect(() => {
    fetchCVEs();
  }, [searchKeyword, selectedYear, selectedSeverities, startDate, endDate, page, hideRejected]);

  const fetchCVEs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (searchKeyword) params.append('keyword', searchKeyword);
      if (selectedYear) params.append('year', selectedYear.toString());
      
      // Handle multiple severities
      if (selectedSeverities.length > 0) {
        selectedSeverities.forEach(sev => params.append('severity', sev));
      }
      
      // Handle date range
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      // Let backend perform rejected filtering and return correct total
      params.append('hide_rejected', String(hideRejected));
      
      params.append('limit', pageSize.toString());
      params.append('offset', ((page - 1) * pageSize).toString());

      const response = await fetch(`${API_BASE_URL}/cve/search/?${params}`, {
        headers: buildHeaders()
      });

      if (response.ok) {
        const data: CVEListResponse = await response.json();
        // Use server-provided items and total to avoid per-page client-side skew
        setCves(data.items);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching CVEs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchKeyword('');
    setSelectedYear(undefined);
    setSelectedSeverities([]);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
    setPage(1);
  };

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

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          CVE Database
        </h1>
        <p className="text-muted">
          Common Vulnerabilities and Exposures - Browse and search security vulnerabilities
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              About CVE Data
            </h3>
            <p className="text-sm text-muted">
              CVE data is sourced from the National Vulnerability Database (NVD). 
              Use the sync feature in settings to fetch the latest vulnerabilities.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Search & Filter</h3>
        </div>

        <div className="space-y-4">
          {/* Row 1: Keyword Search */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Keyword Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="Search CVE ID or description..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Row 2: Date Range and Year */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Published Date Range
              </label>
              <DateTimeRangePicker
                value={{
                  from: startDate,
                  to: endDate
                }}
                onChange={(range: DateTimeRange) => {
                  setStartDate(range.from || '');
                  setEndDate(range.to || '');
                  setPage(1);
                }}
                placeholder="Select published date range"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Year
              </label>
              <select
                value={selectedYear || ''}
                onChange={(e) => {
                  setSelectedYear(e.target.value ? parseInt(e.target.value) : undefined);
                  setPage(1);
                }}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Severity Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Severity (Multiple Selection)
            </label>
            <div className="flex flex-wrap gap-3">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNASSIGNED'].map((severity) => (
                <label
                  key={severity}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg cursor-pointer hover:bg-card-hover transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSeverities.includes(severity)}
                    onChange={() => toggleSeverity(severity)}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{severity.charAt(0) + severity.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Row 4: Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg cursor-pointer hover:bg-card-hover transition-colors">
              <input
                type="checkbox"
                checked={hideRejected}
                onChange={(e) => {
                  setHideRejected(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm text-foreground">Hide Rejected CVEs</span>
            </label>
            
            <button
              onClick={handleClearFilters}
              className="px-6 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">
          Showing {cves.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)} of {total.toLocaleString()} CVEs
          {hideRejected && <span className="ml-2 text-primary">(Rejected CVEs hidden)</span>}
        </div>
        <button
          onClick={() => {/* Export functionality */}}
          className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* CVE List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : cves.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No CVEs Found</h3>
          <p className="text-muted">
            Try adjusting your filters or sync CVE data from NVD
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {cves.map((cve) => (
            <div
              key={cve.id}
              onClick={() => setSelectedCVE(cve)}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-mono font-bold text-primary">
                      {cve.cve_id}
                    </span>
                    {cve.is_rejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-500/10 border-gray-500/20 text-gray-500">
                        Rejected
                      </span>
                    )}
                    {cve.severity && (
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(
                          cve.severity
                        )}`}
                      >
                        {getSeverityIcon(cve.severity)}
                        {cve.severity}
                      </span>
                    )}
                    {!cve.severity && !cve.is_rejected && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border bg-gray-500/10 border-gray-500/20 text-gray-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {cve.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {cve.cvss_v3_score && (
                    <div className="text-center">
                      <div className="text-xs text-muted mb-1">CVSS v3</div>
                      <div className="text-lg font-bold text-foreground bg-muted px-3 py-1 rounded">
                        {cve.cvss_v3_score.toFixed(1)}
                      </div>
                    </div>
                  )}
                  <ExternalLink className="w-5 h-5 text-muted" />
                </div>
              </div>

              <p className="text-sm text-muted mb-3 line-clamp-2">
                {cve.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted">
                <span>
                  Published: {new Date(cve.published_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                {cve.cwe_id && (
                  <span className="px-2 py-1 bg-background rounded border border-border">
                    {cve.cwe_id}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

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
                className="text-muted hover:text-foreground"
              >
                ✕
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
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <p className="text-sm text-warning font-medium">
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

              <div className="grid grid-cols-2 gap-4">
                {selectedCVE.cwe_id && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted mb-2">CWE (Weakness Type)</h3>
                    <span className="inline-block px-3 py-1 bg-background rounded border border-border text-sm">
                      {selectedCVE.cwe_id}
                    </span>
                  </div>
                )}
              </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}