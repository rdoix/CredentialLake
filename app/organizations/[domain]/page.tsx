'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, Shield, Database, Globe, ArrowLeft, Calendar, TrendingUp, Trash2, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { OrganizationDetail } from '@/types/organization';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api-config';

const API_BASE_URL = getApiUrl();

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useUser();
  const domain = decodeURIComponent(params.domain as string);
  const toast = useToast();
  const confirm = useConfirm();
  
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchOrganizationDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/organizations/${encodeURIComponent(domain)}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }
        });

        if (response.ok) {
          const raw = await response.json();
          console.log('Organization detail: raw payload', raw);
          const d = raw || {};
          const normalized: OrganizationDetail = {
            domain: String(d?.domain ?? ''),
            totalCredentials: Number(d?.total_credentials ?? 0),
            adminCount: Number(d?.admin_count ?? 0),
            subdomains: Array.isArray(d?.subdomains) ? d.subdomains.map((s: any) => String(s)) : [],
            subdomainCount: Number(d?.subdomain_count ?? (Array.isArray(d?.subdomains) ? d.subdomains.length : 0)),
            firstDiscovered: String(d?.first_discovered ?? ''),
            lastSeen: String(d?.last_seen ?? ''),
            subdomainStats: Array.isArray(d?.subdomain_stats)
              ? d.subdomain_stats.map((s: any) => ({
                  subdomain: String(s?.subdomain ?? ''),
                  credentialCount: Number(s?.credential_count ?? 0),
                  adminCount: Number(s?.admin_count ?? 0),
                }))
              : [],
            recentCredentials: Array.isArray(d?.recent_credentials)
              ? d.recent_credentials.map((rc: any) => ({
                  id: String(rc?.id ?? ''),
                  email: String(rc?.email ?? ''),
                  subdomain: String(rc?.subdomain ?? ''),
                  isAdmin: !!rc?.is_admin,
                  discoveredAt: String(rc?.discovered_at ?? ''),
                }))
              : [],
          };
          setOrganization(normalized);
        } else {
          console.error('Failed to fetch organization details');
          setOrganization(null);
        }
      } catch (error) {
        console.error('Error fetching organization details:', error);
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationDetail();
  }, [domain]);

  const handleDeleteOrganization = async () => {
    if (!organization) return;

    // Challenge-confirm dialog: require typing the domain name to proceed
    const accepted = await confirm({
      title: 'Delete Organization',
      message: `WARNING: This will permanently delete ALL ${organization.totalCredentials.toLocaleString()} credentials for "${domain}" and cannot be undone.`,
      confirmText: 'Delete Organization',
      cancelText: 'Cancel',
      variant: 'danger',
      challenge: { type: 'text', expected: domain, label: `Type "${domain}" to confirm`, caseSensitive: false },
    });

    if (!accepted) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete organization');
      }

      const result = await response.json();
      toast.success('Organization Deleted', `Deleted "${domain}".\nCredentials: ${result.credentials_deleted}\nJob Associations Removed: ${result.associations_deleted}`);

      // Redirect to organizations list
      router.push('/organizations');
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error('Delete Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted mb-4">Organization not found</p>
            <Link
              href="/organizations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Organizations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{organization.domain}</h1>
              <p className="text-muted">Organization Details</p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href={`/credentials?domain=${encodeURIComponent(organization.domain)}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            title="View all credentials for this organization"
          >
            <Database className="w-4 h-4" />
            View Credentials
          </Link>
          <button
            onClick={handleDeleteOrganization}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete this organization and all its credentials"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {organization.totalCredentials.toLocaleString()}
          </h3>
          <p className="text-sm text-muted">Total Credentials</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-danger" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {organization.adminCount.toLocaleString()}
          </h3>
          <p className="text-sm text-muted">Admin Accounts</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
              <Globe className="w-6 h-6 text-accent" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {organization.subdomainCount}
          </h3>
          <p className="text-sm text-muted">Sub domains</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-success" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {new Date(organization.lastSeen).toLocaleDateString()}
          </h3>
          <p className="text-sm text-muted">Last Seen</p>
        </div>
      </div>

      {/* Sub domains Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Sub domains</h2>
          <p className="text-sm text-muted mt-1">All sub domains under this organization</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/5 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Sub domain
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Credentials
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Admin Accounts
                </th>
                <th className="px-6 py-4 text-right text-sm font-medium text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {organization.subdomainStats.map((subdomain) => (
                <tr key={subdomain.subdomain} className="hover:bg-muted/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-accent" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {subdomain.subdomain}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">
                      {subdomain.credentialCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-danger">
                      {subdomain.adminCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/credentials?domain=${encodeURIComponent(subdomain.subdomain)}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Credentials
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Credentials */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Recent Credentials</h2>
          <p className="text-sm text-muted mt-1">Latest discovered credentials for this organization</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/5 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Sub domain
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                  Discovered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {organization.recentCredentials.map((cred) => (
                <tr key={cred.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm text-foreground">{cred.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">{cred.subdomain}</span>
                  </td>
                  <td className="px-6 py-4">
                    {cred.isAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-danger/10 text-danger rounded-full text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 text-muted rounded-full text-xs font-medium">
                        Regular
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">
                      {new Date(cred.discoveredAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}