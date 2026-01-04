'use client';

import { Database, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import TopDomainsChart from '@/components/dashboard/TopDomainsChart';
import PasswordCloud from '@/components/dashboard/PasswordCloud';
import TldChart from '@/components/dashboard/TldChart';
import TimelineChart from '@/components/dashboard/TimelineChart';
import CVEFeedCard from '@/components/dashboard/CVEFeedCard';
import DashboardFilter, { DashboardFilters } from '@/components/dashboard/DashboardFilter';
import { useUser } from '@/contexts/UserContext';
import { useEffect, useState, useMemo } from 'react';

import { getApiUrl } from '@/lib/api-config';
const API_BASE_URL = getApiUrl();

export default function Dashboard() {
  const { user, token } = useUser();
  const buildHeaders = (t: string | null): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  // Dashboard data (demo uses mock, real fetches from API)
  const [data, setData] = useState({
    totalCredentials: 0,
    totalAdminFound: 0,
    topDomains: [] as { domain: string; count: number; adminCount: number }[],
    topPasswords: [] as { text: string; value: number }[],
    topTlds: [] as { tld: string; count: number; percentage: number }[],
    timeline: [] as { date: string; credentials: number; parsed: number; failed: number }[],
  });
  const [uniqueDomains, setUniqueDomains] = useState(0);
  const [filters, setFilters] = useState<DashboardFilters>({});

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        console.log('Dashboard: fetching real data', { API_BASE_URL });

        // Append trailing slashes to avoid Next.js 308 redirects that may drop query params in some environments
        const headers = buildHeaders(token);
        const [statsRes, domRes, tlRes, pwRes] = await Promise.all([
          fetch(`${API_BASE_URL}/dashboard/stats/`, { headers }),
          fetch(`${API_BASE_URL}/dashboard/top-domains/?limit=25`, { headers }),
          fetch(`${API_BASE_URL}/dashboard/timeline/?days=30`, { headers }),
          fetch(`${API_BASE_URL}/dashboard/top-passwords/?limit=10`, { headers }),
        ]);

        const stats = statsRes.ok ? await statsRes.json() : null;
        const doms = domRes.ok ? await domRes.json() : [];
        const tl = tlRes.ok ? await tlRes.json() : [];
        const pws = pwRes.ok ? await pwRes.json() : [];

        // Sanitize and map datasets to avoid NaN/Infinity reaching Recharts (decimal.js-light)
        const toNum = (v: any, fallback = 0) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : fallback;
        };

        const topDomainsRaw = Array.isArray(doms)
          ? doms.map((d: any) => ({
              domain: String(d?.domain ?? ''),
              count: toNum(d?.total_credentials ?? 0),
              adminCount: toNum(d?.admin_count ?? 0),
            }))
          : [];
        const topDomains = topDomainsRaw.map((d) => ({
          ...d,
          count: d.count < 0 ? 0 : d.count,
          adminCount: d.adminCount < 0 ? 0 : d.adminCount,
        }));
        
        // DEBUG: Log top domains received from backend
        console.log('Dashboard: Top Domains received from backend:');
        topDomains.forEach((d, idx) => {
          console.log(`  ${idx + 1}. ${d.domain}: ${d.count} credentials (admin: ${d.adminCount})`);
        });

        const totalCredentials = toNum(stats?.total_credentials ?? 0);
        const totalAdminFound = toNum(stats?.admin_credentials ?? 0);
        const uniqueDomainsCount = toNum(stats?.total_domains ?? topDomains.length, topDomains.length);

        // Map backend timeline (date,count) to frontend shape
        const timelineRaw = Array.isArray(tl)
          ? tl.map((t: any) => ({
              date: String(t?.date ?? new Date().toISOString().split('T')[0]),
              credentials: toNum(t?.count ?? 0),
              parsed: toNum(t?.count ?? 0), // no parsed metric available; mirror count
              failed: 0, // backend doesn't provide failed count
            }))
          : [];
        const timeline = timelineRaw.map((x) => ({
          ...x,
          credentials: x.credentials < 0 ? 0 : x.credentials,
          parsed: x.parsed < 0 ? 0 : x.parsed,
          failed: x.failed < 0 ? 0 : x.failed,
        }));

        // Derive TLD stats from top domains
        const tldMap: Record<string, number> = {};
        for (const d of topDomains) {
          const parts = d.domain.split('.');
          const tld = parts[parts.length - 1] || '';
          if (!tld) continue;
          tldMap[tld] = (tldMap[tld] || 0) + toNum(d.count);
        }
        const tldTotal = Object.values(tldMap).reduce((a, b) => a + b, 0);
        const topTlds = Object.entries(tldMap).map(([tld, count]) => ({
          tld,
          count: toNum(count),
          percentage: tldTotal ? Math.round((toNum(count) / tldTotal) * 100) : 0,
        }));

        // Map backend passwords payload to UI shape (top 10 by frequency)
        const topPasswordsRaw = Array.isArray(pws)
          ? pws.map((p: any) => ({
              text: String(p?.text ?? ''),
              value: toNum(p?.value ?? 0),
            }))
          : [];
        const topPasswords = topPasswordsRaw
          .filter((p) => p.text && p.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);

        console.log('Dashboard: fetched', {
          totalCredentials,
          totalAdminFound,
          domainsLen: topDomains.length,
          passwordsLen: topPasswords.length,
          tldsLen: topTlds.length,
          timelineLen: timeline.length,
        });

        setData({
          totalCredentials,
          totalAdminFound,
          topDomains,
          topPasswords,
          topTlds,
          timeline,
        });
        setUniqueDomains(uniqueDomainsCount);
      } catch (error) {
        console.error('Dashboard: fetch error', error);
        setData({
          totalCredentials: 0,
          totalAdminFound: 0,
          topDomains: [],
          topPasswords: [],
          topTlds: [],
          timeline: [],
        });
        setUniqueDomains(0);
      }
    };

    fetchDashboard();
  }, [token]);

  // Extract available domains and TLDs for filter dropdowns
  const availableDomains = useMemo(() => {
    return Array.from(new Set(data.topDomains.map(d => d.domain))).sort();
  }, [data.topDomains]);

  const availableTlds = useMemo(() => {
    return Array.from(new Set(data.topTlds.map(t => t.tld))).sort();
  }, [data.topTlds]);

  // Apply filters to dashboard data
  const filteredData = useMemo(() => {
    let filteredDomains = data.topDomains;
    let filteredTlds = data.topTlds;
    let filteredTimeline = data.timeline;
    let filteredPasswords = data.topPasswords;

    // Filter by domain
    if (filters.domain) {
      filteredDomains = filteredDomains.filter(d => d.domain === filters.domain);
    }

    // Filter by TLD
    if (filters.tld) {
      filteredTlds = filteredTlds.filter(t => t.tld === filters.tld);
      filteredDomains = filteredDomains.filter(d => d.domain.endsWith(`.${filters.tld}`));
    }

    // Filter by date range
    if (filters.dateFrom || filters.dateTo) {
      filteredTimeline = filteredTimeline.filter(t => {
        const date = new Date(t.date);
        if (filters.dateFrom && date < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && date > new Date(filters.dateTo)) return false;
        return true;
      });
    }

    // Determine if any filters are active
    const filtersActive = !!(filters.domain || filters.tld || filters.dateFrom || filters.dateTo);

    // Calculate totals from the filtered subset
    const calculatedTotalCredentials = filteredDomains.reduce((sum, d) => sum + d.count, 0);
    const calculatedAdminCount = filteredDomains.reduce((sum, d) => sum + d.adminCount, 0);
    const calculatedUniqueDomains = filteredDomains.length;

    return {
      topDomains: filteredDomains,
      topTlds: filteredTlds,
      timeline: filteredTimeline,
      topPasswords: filteredPasswords,
      // Use full stats totals when no filters are active; use calculated subset when filters are active
      totalCredentials: filtersActive ? calculatedTotalCredentials : data.totalCredentials,
      totalAdminFound: filtersActive ? calculatedAdminCount : data.totalAdminFound,
      uniqueDomains: filtersActive ? calculatedUniqueDomains : uniqueDomains,
    };
  }, [data, filters, uniqueDomains]);

  // Handler for clicking on charts to filter
  const handleDomainClick = (domain: string) => {
    setFilters(prev => ({ ...prev, domain }));
  };

  const handleTldClick = (tld: string) => {
    setFilters(prev => ({ ...prev, tld }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted">Monitor credential leaks and security analytics in real-time</p>
      </div>

      {/* Dashboard Filter Panel */}
      <DashboardFilter
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        availableDomains={availableDomains}
        availableTlds={availableTlds}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Credentials"
          value={filteredData.totalCredentials}
          icon={Database}
          trend={{ value: 12.5, isPositive: true }}
          color="primary"
        />
        <StatCard
          title="Admin Accounts"
          value={filteredData.totalAdminFound}
          icon={Shield}
          trend={{ value: 8.3, isPositive: false }}
          color="danger"
        />
        <StatCard
          title="Unique Domains"
          value={filteredData.uniqueDomains}
          icon={TrendingUp}
          trend={{ value: 5.2, isPositive: true }}
          color="accent"
        />
      </div>

      {/* Timeline Chart - Full Width (moved to top) */}
      <div className="grid grid-cols-1 gap-6">
        <TimelineChart data={filteredData.timeline} />
      </div>

      {/* Password Cloud and TLD Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PasswordCloud data={filteredData.topPasswords} />
        <TldChart
          data={filteredData.topTlds}
          onTldClick={handleTldClick}
        />
      </div>

      {/* Top 25 Domains and CVE Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Domains Chart */}
        <TopDomainsChart
          data={filteredData.topDomains}
          onDomainClick={handleDomainClick}
        />
        
        {/* CVE Feed Card */}
        <CVEFeedCard />
      </div>
    </div>
  );
}
