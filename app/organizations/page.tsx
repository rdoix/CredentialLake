'use client';

import { useState, useEffect, useMemo } from 'react';
import { Building2, Shield, Database, TrendingUp, Search, ChevronRight } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Organization } from '@/types/organization';
import Link from 'next/link';
import OrganizationsPagination from '@/components/organizations/OrganizationsPagination';

import { getApiUrl } from '@/lib/api-config';
const API_BASE_URL = getApiUrl();

export default function OrganizationsPage() {
  const { token } = useUser();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'domain' | 'credentials' | 'admin'>('credentials');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/organizations`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }
        });

        if (response.ok) {
          const raw = await response.json();
          console.log('Organizations: raw payload sample', Array.isArray(raw) ? raw[0] : raw);
          const normalized = (Array.isArray(raw) ? raw : []).map((o: any) => ({
            domain: String(o?.domain ?? ''),
            totalCredentials: Number(o?.total_credentials ?? 0),
            adminCount: Number(o?.admin_count ?? 0),
            subdomains: Array.isArray(o?.subdomains) ? o.subdomains.map((s: any) => String(s)) : [],
            subdomainCount: Number(o?.subdomain_count ?? (Array.isArray(o?.subdomains) ? o.subdomains.length : 0)),
            firstDiscovered: String(o?.first_discovered ?? ''),
            lastSeen: String(o?.last_seen ?? ''),
          }));

          const onlyOther = normalized.length === 1 && normalized[0]?.domain === 'other';
          if (!onlyOther && normalized.length > 0) {
            setOrganizations(normalized);
          } else {
            // Fallback: derive organizations client-side from credentials when backend returns only "other"
            try {
              const credsRes = await fetch(`${API_BASE_URL}/credentials?limit=1000`, {
                headers: {
                  Accept: 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                }
              });
              if (credsRes.ok) {
                const credsData = await credsRes.json();
                const creds = Array.isArray(credsData?.credentials) ? credsData.credentials : [];

                // Helpers: normalize and extract root domain (client-side)
                const publicSuffixMulti = new Set(['co.id','go.id','ac.id','or.id','web.id','my.id','sch.id','co.uk','gov.uk','ac.uk','org.uk','com.au','net.au','gov.au','co.jp']);
                const normalize = (value: any) => {
                  let s = String(value || '').trim().toLowerCase();
                  if (!s) return 'other';
                  if (s.includes('://')) {
                    try {
                      const u = new URL(s);
                      s = u.hostname || s;
                    } catch {
                      // continue
                    }
                  }
                  if (s.includes('/')) s = s.split('/', 1)[0];
                  if (s.includes(':')) s = s.split(':', 1)[0];
                  if (s.startsWith('www.')) s = s.slice(4);
                  // simple domain pattern
                  const label = '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)';
                  const re = new RegExp(`^(?:${label}\\.)+[a-z]{2,24}$`);
                  if (!re.test(s)) {
                    const match = String(value || '').toLowerCase().match(/(?:[a-z0-9-]+\.)+[a-z]{2,24}/);
                    return match ? match[0].replace(/^www\./,'') : 'other';
                  }
                  return s;
                };
                const rootOf = (domain: string) => {
                  const parts = domain.split('.');
                  if (parts.length < 2) return domain;
                  const last2 = parts.slice(-2).join('.');
                  if (publicSuffixMulti.has(last2)) {
                    if (parts.length >= 3) return parts.slice(-3).join('.');
                    return domain;
                  }
                  return parts.slice(-2).join('.');
                };

                // Aggregate
                const orgMap: Record<string, {
                  subdomains: Set<string>;
                  totalCredentials: number;
                  adminCount: number;
                  firstDiscovered?: string;
                  lastSeen?: string;
                }> = {};

                for (const c of creds) {
                  const dRaw = normalize(c?.domain);
                  const dUrl = normalize(c?.url);
                  let dBest = dRaw !== 'other' ? dRaw : (dUrl !== 'other' ? dUrl : 'other');
                  if (dBest === 'other' && typeof c?.username === 'string' && c.username.includes('@')) {
                    const emailDom = normalize(c.username.split('@')[1]);
                    dBest = emailDom !== 'other' ? emailDom : dBest;
                  }
                  const root = dBest === 'other' ? 'other' : rootOf(dBest);
                  if (!orgMap[root]) {
                    orgMap[root] = {
                      subdomains: new Set(),
                      totalCredentials: 0,
                      adminCount: 0,
                      firstDiscovered: undefined,
                      lastSeen: undefined,
                    };
                  }
                  const bucket = orgMap[root];
                  bucket.totalCredentials += 1;
                  if (c?.is_admin || c?.isAdmin) bucket.adminCount += 1;

                  const sub = dBest !== 'other' ? dBest : 'other';
                  bucket.subdomains.add(sub);

                  const fd = String(c?.first_seen || c?.firstSeen || '');
                  const ls = String(c?.last_seen || c?.lastSeen || '');
                  if (fd) {
                    bucket.firstDiscovered = !bucket.firstDiscovered ? fd
                      : (new Date(fd) < new Date(bucket.firstDiscovered) ? fd : bucket.firstDiscovered);
                  }
                  if (ls) {
                    bucket.lastSeen = !bucket.lastSeen ? ls
                      : (new Date(ls) > new Date(bucket.lastSeen) ? ls : bucket.lastSeen);
                  }
                }

                // Convert to Organization[]
                const derived: Organization[] = Object.entries(orgMap).map(([domain, data]) => ({
                  domain,
                  totalCredentials: data.totalCredentials,
                  adminCount: data.adminCount,
                  subdomains: Array.from(data.subdomains),
                  subdomainCount: Array.from(data.subdomains).filter(s => s !== 'other').length || (data.subdomains.has('other') ? 1 : 0),
                  firstDiscovered: data.firstDiscovered || '',
                  lastSeen: data.lastSeen || '',
                })).sort((a,b) => b.totalCredentials - a.totalCredentials);

                // Prefer derived if it yields more than just 'other'
                const derivedOnlyOther = derived.length === 1 && derived[0]?.domain === 'other';
                setOrganizations(!derivedOnlyOther ? derived : normalized);
              } else {
                setOrganizations(normalized);
              }
            } catch (fallbackErr) {
              console.warn('Organizations: fallback grouping error', fallbackErr);
              setOrganizations(normalized);
            }
          }
        } else {
          console.error('Failed to fetch organizations');
          setOrganizations([]);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Filter and sort organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations.filter(org =>
      org.domain.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'domain':
          comparison = a.domain.localeCompare(b.domain);
          break;
        case 'credentials':
          comparison = a.totalCredentials - b.totalCredentials;
          break;
        case 'admin':
          comparison = a.adminCount - b.adminCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [organizations, searchQuery, sortBy, sortOrder]);

  // Paginated organizations
  const paginatedOrganizations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredOrganizations.slice(startIndex, endIndex);
  }, [filteredOrganizations, currentPage, pageSize]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const totalStats = useMemo(() => {
    return {
      totalOrganizations: organizations.length,
      totalCredentials: organizations.reduce((sum, org) => sum + org.totalCredentials, 0),
      totalAdmin: organizations.reduce((sum, org) => sum + org.adminCount, 0),
      totalSubdomains: organizations.reduce((sum, org) => sum + org.subdomainCount, 0)
    };
  }, [organizations]);

  const toggleSort = (field: 'domain' | 'credentials' | 'admin') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Organizations</h1>
        <p className="text-muted">View and manage organizations with credential leaks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-foreground">
                {totalStats.totalOrganizations.toLocaleString()}
              </h3>
              <p className="text-sm text-muted">Total Organizations</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-foreground">
                {totalStats.totalCredentials.toLocaleString()}
              </h3>
              <p className="text-sm text-muted">Total Credentials</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-foreground">
                {totalStats.totalAdmin.toLocaleString()}
              </h3>
              <p className="text-sm text-muted">Admin Accounts</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-foreground">
                {totalStats.totalSubdomains.toLocaleString()}
              </h3>
              <p className="text-sm text-muted">Total Sub domains</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search organizations..."
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/5 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => toggleSort('domain')}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Organization
                    {sortBy === 'domain' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-sm font-medium text-foreground">Sub domains</span>
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => toggleSort('credentials')}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Credentials
                    {sortBy === 'credentials' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => toggleSort('admin')}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Admin Accounts
                    {sortBy === 'admin' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-sm font-medium text-foreground">Last Seen</span>
                </th>
                <th className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-foreground">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    Loading organizations...
                  </td>
                </tr>
              ) : filteredOrganizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No organizations found
                  </td>
                </tr>
              ) : (
                paginatedOrganizations.map((org) => (
                  <tr key={org.domain} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{org.domain}</p>
                          <p className="text-xs text-muted">
                            First seen: {new Date(org.firstDiscovered).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">{org.subdomainCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">
                        {org.totalCredentials.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-danger">
                        {org.adminCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted">
                        {new Date(org.lastSeen).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/organizations/${encodeURIComponent(org.domain)}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredOrganizations.length > 0 && (
        <OrganizationsPagination
          currentPage={currentPage}
          pageSize={pageSize}
          total={filteredOrganizations.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1); // Reset to first page when changing page size
          }}
        />
      )}
    </div>
  );
}