'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Credential, CredentialFilters, SortField, SortOrder, PaginationState } from '@/types/credential';
import SearchBar from '@/components/credentials/SearchBar';
import FilterPanel from '@/components/credentials/FilterPanel';
import StatsBar from '@/components/credentials/StatsBar';
import CredentialsTable from '@/components/credentials/CredentialsTable';
import Pagination from '@/components/credentials/Pagination';
import CredentialDetail from '@/components/credentials/CredentialDetail';
import BulkActions from '@/components/credentials/BulkActions';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Database, Eye, EyeOff, RefreshCw } from 'lucide-react';

import { getApiUrl } from '@/lib/api-config';
const API_BASE_URL = getApiUrl();
// Settings storage key used by Settings page
const SETTINGS_KEY = 'intelx_scanner_settings';

// Local utility functions for filtering credentials
const filterCredentials = (credentials: Credential[], filters: any): Credential[] => {
  return credentials.filter(cred => {
    if (filters.search) {
      const search = String(filters.search).toLowerCase();
      if (!String(cred.email || '').toLowerCase().includes(search) &&
          !String(cred.domain || '').toLowerCase().includes(search)) {
        return false;
      }
    }

    if (filters.domain) {
      const d = String(cred.domain || '').toLowerCase();
      const root = String(filters.domain || '').toLowerCase();
      // Include exact root and any subdomain of the root
      if (d !== root && !d.endsWith(`.${root}`)) return false;
    }
    if (filters.isAdmin !== undefined && cred.isAdmin !== filters.isAdmin) return false;
    if (filters.verified !== undefined && cred.verified !== filters.verified) return false;
    if (filters.source && cred.source !== filters.source) return false;

    if (filters.passwordStrength && filters.passwordStrength.length > 0) {
      if (!filters.passwordStrength.includes(cred.passwordStrength)) return false;
    }

    if (filters.dateFrom) {
      if (new Date(cred.breachDate) < new Date(filters.dateFrom)) return false;
    }

    if (filters.dateTo) {
      if (new Date(cred.breachDate) > new Date(filters.dateTo)) return false;
    }

    return true;
  });
};

const sortCredentials = (credentials: Credential[], field: string, order: 'asc' | 'desc'): Credential[] => {
  return [...credentials].sort((a, b) => {
    let aVal: any = (a as any)[field];
    let bVal: any = (b as any)[field];

    if (field === 'breachDate' || field === 'discoveredAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

const computeStats = (credentials: Credential[]) => {
  const total = credentials.length;
  const verified = credentials.filter(c => c.verified).length;
  const admin = credentials.filter(c => c.isAdmin).length;
  const weak = credentials.filter(c => c.passwordStrength === 'weak').length;
  const medium = credentials.filter(c => c.passwordStrength === 'medium').length;
  const strong = credentials.filter(c => c.passwordStrength === 'strong').length;
  return { total, verified, admin, weak, medium, strong };
};

export default function Credentials() {
  const { user, token } = useUser();
  const toast = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();

  // State - mock for demo, empty for real (will fetch from API)
  const [allCredentials, setAllCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CredentialFilters>(() => {
    const domainParam = searchParams.get('domain');
    return domainParam ? { domain: domainParam } : {};
  });
  const [showFilters, setShowFilters] = useState<boolean>(() => !!searchParams.get('domain'));
  const [sortField, setSortField] = useState<SortField>('discoveredAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);


  /** Apply saved user preferences (pageSize, showPasswordsByDefault) on mount and when settings change */
  useEffect(() => {
    const applyPrefs = () => {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const prefs = parsed?.preferences || {};
        // Default page size
        if (typeof prefs.pageSize === 'number' && prefs.pageSize > 0) {
          setPagination(prev => ({ ...prev, pageSize: prefs.pageSize, page: 1 }));
        }
        // Default password visibility
        if (typeof prefs.showPasswordsByDefault === 'boolean') {
          setShowAllPasswords(Boolean(prefs.showPasswordsByDefault));
        }
      } catch (e) {
        console.warn('CredentialLake: failed to read preferences from settings', e);
      }
    };
  
    applyPrefs();
  
    // Listen for changes from Settings page via localStorage events
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) applyPrefs();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  
  /** Reset totals and page when ANY filter changes to avoid stale counts */
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1, total: 0 }));
    setServerTotal(0);
    setAllCredentials([]);
  }, [JSON.stringify(filters)]);

  // Fetch credentials from API
  useEffect(() => {
    const fetchCredentials = async () => {
      // Helper: robust transform to frontend shape
      const transformCredential = (cred: any): Credential => {
        const pwdLen = typeof cred?.password === 'string' ? cred.password.length : 0;
        const firstSeen = cred?.first_seen ?? null;
        const lastSeen = cred?.last_seen ?? null;
        const breach = (typeof firstSeen === 'string' && firstSeen) ? firstSeen :
                       (typeof lastSeen === 'string' && lastSeen) ? lastSeen :
                       new Date(0).toISOString(); // fallback epoch
        const discovered = (typeof lastSeen === 'string' && lastSeen) ? lastSeen :
                           (typeof firstSeen === 'string' && firstSeen) ? firstSeen :
                           new Date().toISOString(); // fallback now

        return {
          id: String(cred?.id ?? ''),
          email: String(cred?.username ?? ''),
          password: String(cred?.password ?? ''),
          domain: String(cred?.domain ?? ''),
          source: String(cred?.url ?? ''),
          breachDate: breach,
          discoveredAt: discovered,
          passwordStrength: pwdLen < 8 ? 'weak' : pwdLen < 12 ? 'medium' : 'strong',
          isAdmin: !!cred?.is_admin,
          verified: Number(cred?.seen_count ?? 0) > 1
        };
      };

      // Fetch real data from API with diagnostics and pagination
      setIsLoading(true);
      const domainFilter = String(filters.domain || '').trim();
      
      console.log('CredentialLake: starting fetch', {
        API_BASE_URL,
        domain: domainFilter || null,
        page: pagination.page,
        pageSize: pagination.pageSize
      });

      try {
        const searchFilter = String(searchQuery || '').trim();
        
        // NOTE: Do not set serverTotal from /credentials/stats here to avoid race/mismatch
        // Stats are fetched in a separate effect for cards only.

        // Primary attempt: backend /credentials (FastAPI), server-side pagination per current page
        const base1 = `${API_BASE_URL}/credentials/`;
        const skipVal = (pagination.page - 1) * pagination.pageSize;
        const limitVal = pagination.pageSize;
        let total1: number | undefined;

        // Build URL for server-side pagination with domain/search and admin filter (FastAPI)
        const url1 = `${base1}?skip=${skipVal}&limit=${limitVal}${domainFilter ? `&domain=${encodeURIComponent(domainFilter)}` : ''}${searchFilter ? `&search=${encodeURIComponent(searchFilter)}` : ''}${filters.isAdmin !== undefined ? `&is_admin=${filters.isAdmin}` : ''}`;
        console.log('CredentialLake: requesting', url1);
        const res1 = await fetch(url1, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

        if (res1.ok) {
          const data1 = await res1.json();
          const items1 = Array.isArray(data1?.credentials)
            ? data1.credentials
            : Array.isArray(data1?.items)
              ? data1.items
              : [];
          total1 = typeof data1?.total === 'number' ? data1.total : items1.length;

          console.log('CredentialLake: /credentials response', {
            status: res1.status,
            total: total1,
            received: items1.length,
            page: pagination.page
          });
          // Use backend-reported total to drive Found count and pagination totals
          const newTotal = typeof total1 === 'number' ? total1 : items1.length;
          setServerTotal(newTotal);
          setPagination(prev => ({ ...prev, total: newTotal }));

          // Transform and dedupe current page items
          const transformed = items1.map(transformCredential);
          const seen = new Set<string>();
          const deduped = transformed.filter((c: Credential) => {
            if (!c.id || seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });

          setAllCredentials(deduped);
          return;
        } else {
          console.warn('CredentialLake: /credentials failed', {
            status: res1.status,
            statusText: res1.statusText,
          });
        }

        // Fallback attempt: gateway/backend /results (server-side pagination by page/page_size)
        const base2 = `${API_BASE_URL}/results/`;
        // Gateway/backend results endpoint supports admin_only and date range
        const url2 = `${base2}?page=${pagination.page}&page_size=${pagination.pageSize}${domainFilter ? `&domain=${encodeURIComponent(domainFilter)}` : ''}${searchFilter ? `&search=${encodeURIComponent(searchFilter)}` : ''}${filters.isAdmin === true ? `&admin_only=true` : ''}${filters.dateFrom ? `&from_date=${encodeURIComponent(filters.dateFrom)}` : ''}${filters.dateTo ? `&to_date=${encodeURIComponent(filters.dateTo)}` : ''}`;
        console.log('CredentialLake: fallback requesting', url2);
        const res2 = await fetch(url2, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

        if (res2.ok) {
          const data2 = await res2.json();
          const items2 = Array.isArray(data2?.items)
            ? data2.items
            : Array.isArray(data2?.credentials)
              ? data2.credentials
              : [];
          const total2 = typeof data2?.total === 'number' ? data2.total : items2.length;

          // Use backend-reported total to drive Found count and pagination totals
          const newTotal2 = total2;
          setServerTotal(newTotal2);
          setPagination(prev => ({ ...prev, total: newTotal2 }));

          const transformed = items2.map(transformCredential);
          const seen = new Set<string>();
          const deduped = transformed.filter((c: Credential) => {
            if (!c.id || seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });

          setAllCredentials(deduped);
          return;
        } else {
          console.error('CredentialLake: /results failed', {
            status: res2.status,
            statusText: res2.statusText,
          });
          throw new Error(`Both endpoints failed: ${res2.status} ${res2.statusText}`);
        }
      } catch (error) {
        console.error('CredentialLake: error fetching credentials', error);
        setAllCredentials([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredentials();
 }, [reloadKey, searchQuery, pagination.page, pagination.pageSize, token, JSON.stringify(filters)]);

  // Get unique domains and sources for filters
  const availableDomains = useMemo(() => {
    return Array.from(new Set(allCredentials.map(c => c.domain))).sort();
  }, [allCredentials]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(allCredentials.map(c => c.source))).sort();
  }, [allCredentials]);

  // Apply advanced client-side filtering and sorting on the fetched page
  const filteredList = useMemo(() => {
    return filterCredentials(allCredentials, { ...filters, search: searchQuery });
  }, [allCredentials, filters, searchQuery]);

  const paginatedCredentials = useMemo(() => {
    return sortCredentials(filteredList, sortField, sortOrder);
  }, [filteredList, sortField, sortOrder]);

  /**
   * Update pagination total:
   * - If any client-only filters are active (verified, source, passwordStrength, dateFrom/dateTo),
   *   use the client-filtered list length to keep "Found" and bottom pager consistent.
   * - Otherwise, use the server-reported total for accurate pagination across pages.
   */
  const hasClientOnlyFilters = useMemo(() => (
    filters.verified !== undefined ||
    (filters.passwordStrength && filters.passwordStrength.length > 0) ||
    !!filters.source ||
    !!filters.dateFrom ||
    !!filters.dateTo
  ), [filters]);
  
  useEffect(() => {
    const total = hasClientOnlyFilters ? filteredList.length : serverTotal;
    setPagination(prev => ({ ...prev, total }));
  }, [serverTotal, filteredList.length, hasClientOnlyFilters]);

  // Fetch and display stats from backend API
  const [backendStats, setBackendStats] = useState({ total: 0, verified: 0, admin: 0, weak: 0, medium: 0, strong: 0 });
  
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const domainFilter = String(filters.domain || '').trim();
        const searchFilter = String(searchQuery || '').trim();
        
        const statsParams = new URLSearchParams();
        if (domainFilter) statsParams.set('domain', domainFilter);
        if (searchFilter) statsParams.set('search', searchFilter);
        
        const statsUrl = `${API_BASE_URL}/credentials/stats?${statsParams.toString()}`;
        const statsRes = await fetch(statsUrl, {
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setBackendStats({
            total: statsData.total || 0,
            verified: statsData.verified || 0,
            admin: statsData.admin || 0,
            weak: statsData.weak || 0,
            medium: statsData.medium || 0,
            strong: statsData.strong || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, [reloadKey, filters.domain, searchQuery, token]);

  // Always use backend-provided stats to keep totals consistent with server-side data
  const stats = useMemo(() => backendStats, [backendStats]);

  // Removed fallback that derived serverTotal from current page to avoid inconsistent counts

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    setSelectedIds([]);
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, page: 1 }));
    setSelectedIds([]);
  };

  const handleExport = async () => {
    // Resolve export format from saved user preferences
    const getExportFormat = (): 'csv' | 'json' | 'xlsx' => {
      try {
        const raw = localStorage.getItem('intelx_scanner_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          const fmt = parsed?.preferences?.exportFormat;
          if (fmt === 'csv' || fmt === 'json' || fmt === 'xlsx') return fmt;
        }
      } catch (e) {
        console.warn('CredentialLake: failed to read exportFormat from settings', e);
      }
      return 'csv';
    };

    const formatPref = getExportFormat();

    const dataToExport = selectedIds.length > 0
      ? allCredentials.filter(c => selectedIds.includes(c.id))
      : allCredentials;

    // Styled choice dialog: Confirm = masked, Cancel = plain
    const exportMasked = await confirm({
      title: 'Export Passwords',
      message: 'Export with masked passwords? Confirm = masked, Cancel = plain.',
      confirmText: 'Export Masked',
      cancelText: 'Export Plain'
    });

    const maskForExport = (pwd: string): string => {
      if (!pwd) return '';
      if (pwd.length <= 3) return '*'.repeat(pwd.length);
      const first = pwd.slice(0, 2);
      const last = pwd.slice(-1);
      const middle = '*'.repeat(pwd.length - 3);
      return `${first}${middle}${last}`;
    };

    if (formatPref === 'json') {
      // Build JSON payload respecting mask choice
      const items = dataToExport.map((c: Credential) => ({
        email: c.email,
        password: exportMasked ? maskForExport(c.password) : c.password,
        domain: c.domain,
        source: c.source,
        breachDate: c.breachDate,
        discoveredAt: c.discoveredAt,
        passwordStrength: c.passwordStrength,
        isAdmin: c.isAdmin,
        verified: c.verified,
      }));

      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credentials-export-${new Date().toISOString().split('T')[0]}${exportMasked ? '-masked' : ''}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // XLSX not yet supported without adding a client-side library; fallback to CSV gracefully
    if (formatPref === 'xlsx') {
      try {
        const toast = useToast();
        toast.info('XLSX export not available yet. Exporting CSV instead.');
      } catch {
        // ignore toast errors
      }
    }

    // CSV export
    const esc = (v: string | number | boolean) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = [
      'Email',
      'Password',
      'Sub domain',
      'Source',
      'Breach Date',
      'Discovered At',
      'Password Strength',
      'Is Admin',
      'Verified',
    ].join(',');

    const rows = dataToExport.map((c: Credential) => {
      const pw = exportMasked ? maskForExport(c.password) : c.password;
      return [
        esc(c.email),
        esc(pw),
        esc(c.domain),
        esc(c.source),
        esc(c.breachDate),
        esc(c.discoveredAt),
        esc(c.passwordStrength),
        esc(c.isAdmin),
        esc(c.verified),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credentials-export-${new Date().toISOString().split('T')[0]}${exportMasked ? '-masked' : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const accepted = await confirm({
      title: 'Delete Selected Credentials',
      message: `This will permanently delete ${selectedIds.length} credentials.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'checkbox', label: 'I understand this action cannot be undone' }
    });
    if (!accepted) return;

    try {
      console.log('CredentialLake: bulk delete start', { count: selectedIds.length, API_BASE_URL });
      const responses = await Promise.all(
        selectedIds.map(id =>
          fetch(`${API_BASE_URL}/credentials/${id}`, {
            method: 'DELETE',
            headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          })
        )
      );

      const failures = responses.filter(r => !r.ok).map(r => ({ status: r.status, statusText: r.statusText }));
      if (failures.length > 0) {
        console.error('CredentialLake: bulk delete failures', failures);
        toast.error('Partial Delete Failure', `Failed to delete ${failures.length} of ${selectedIds.length} credentials`);
      } else {
        console.log('CredentialLake: bulk delete success');
        toast.success('Credentials Deleted', `Successfully deleted ${selectedIds.length} credentials`);
      }
    } catch (e) {
      console.error('CredentialLake: bulk delete error', e);
      toast.error('Delete Error', 'Error deleting selected credentials. See console for details.');
    } finally {
      setSelectedIds([]);
      setReloadKey(prev => prev + 1);
    }
  };

  const handleBulkVerify = () => {
    toast.success('Credentials Verified', `${selectedIds.length} credentials marked as verified`);
    setSelectedIds([]);
  };

  const handleBulkNotify = () => {
    toast.info('Notifications Sent', `Sending notifications for ${selectedIds.length} credentials`);
  };

  const handleDeleteAll = async () => {
    const accepted = await confirm({
      title: 'Delete ALL Credentials',
      message: 'This will permanently delete ALL credentials in the lake and cannot be undone.',
      confirmText: 'Delete ALL',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'text', expected: 'DELETE ALL', label: 'Type "DELETE ALL" to confirm' }
    });
    if (!accepted) return;

    try {
      console.log('CredentialLake: delete all start', { endpoint: `${API_BASE_URL}/credentials/` });
      const res = await fetch(`${API_BASE_URL}/credentials/`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        console.error('CredentialLake: delete all failed', { status: res.status, statusText: res.statusText });
        toast.error('Delete Failed', `Delete All failed: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json().catch(() => null);
      console.log('CredentialLake: delete all success', data);
      toast.success('All Credentials Deleted', 'Successfully deleted all credentials from the lake');
    } catch (e) {
      console.error('CredentialLake: delete all error', e);
      toast.error('Delete Error', 'Error deleting all credentials. See console for details.');
    } finally {
      setSelectedIds([]);
      setReloadKey(prev => prev + 1);
    }
  };

  const handleRefresh = () => {
    setSearchQuery('');
    setFilters({});
    setSelectedIds([]);
    setPagination(prev => ({ ...prev, page: 1, total: 0 }));
    setServerTotal(0);
    setAllCredentials([]);
    setReloadKey(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Credential Lake</h1>
          <p className="text-muted">Query and explore all collected credentials</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowAllPasswords(prev => {
                const next = !prev;
                console.log('CredentialLake: global visibility toggle', { showAllPasswords: next });
                return next;
              });
            }}
            className="px-4 py-2 bg-card hover:bg-card-hover border border-border text-foreground rounded-lg text-sm font-medium transition-colors"
            title={showAllPasswords ? 'Mask all passwords' : 'Unmask all passwords'}
          >
            <span className="flex items-center gap-2">
              {showAllPasswords ? (
                <EyeOff className="w-4 h-4 text-muted" />
              ) : (
                <Eye className="w-4 h-4 text-muted" />
              )}
              {showAllPasswords ? 'Mask' : 'Unmask'}
            </span>
          </button>
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-sm font-medium transition-colors"
            title="Delete all credentials"
          >
            Delete All
          </button>
        </div>
      </div>

      {/* Controls: Stats and Search (always rendered to preserve input focus) */}
      <StatsBar stats={stats} />

      {/* Search Bar */}
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterToggle={() => setShowFilters(!showFilters)}
        onExport={handleExport}
        onRefresh={handleRefresh}
        showFilters={showFilters}
        totalResults={pagination.total}
      />

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          onClearFilters={() => setFilters({})}
          availableDomains={availableDomains}
          availableSources={availableSources}
        />
      )}

      {/* Always show search/filter when loading or no results so user can edit query */}
      {(isLoading || allCredentials.length === 0) && (
        <>
          {/* Controls rendered above */}
        </>
      )}

      {/* Empty State or No Results */}
      {!isLoading && allCredentials.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Database className="w-16 h-16 text-muted mx-auto mb-4" />
          {searchQuery || filters.domain ? (
            <>
              <h3 className="text-xl font-semibold text-foreground mb-2">No Results Found</h3>
              <p className="text-muted mb-6">
                No credentials match your search criteria. Try adjusting your filters or search query.
              </p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-foreground mb-2">No Credentials Yet</h3>
              <p className="text-muted mb-6">
                {`You're signed in as ${user?.full_name || user?.username || 'your account'}. Start scanning to collect credentials.`}
              </p>
              <a
                href="/collector"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
              >
                Start Your First Scan
              </a>
            </>
          )}
        </div>
      ) : isLoading ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading credentials...</p>
        </div>
      ) : (
        <>

      {/* Bulk Actions */}
      <BulkActions
        selectedCount={selectedIds.length}
        onExport={handleExport}
        onDelete={handleBulkDelete}
        onMarkVerified={handleBulkVerify}
        onNotify={handleBulkNotify}
      />

      {/* Credentials Table */}
      <CredentialsTable
        credentials={paginatedCredentials}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={setSelectedCredential}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        showAllPasswords={showAllPasswords}
      />

      {/* Pagination */}
      <Pagination
        pagination={pagination}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

          {/* Detail Modal */}
          <CredentialDetail
            credential={selectedCredential}
            onClose={() => setSelectedCredential(null)}
          />
        </>
      )}
    </div>
  );
}
