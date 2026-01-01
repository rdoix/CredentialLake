'use client';

import { Credential, SortField, SortOrder } from '@/types/credential';
import { ArrowUpDown, ArrowUp, ArrowDown, Shield, CheckCircle2, XCircle, Eye, Copy } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface CredentialsTableProps {
  credentials: Credential[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onRowClick: (credential: Credential) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  showAllPasswords?: boolean;
}

export default function CredentialsTable({
  credentials,
  sortField,
  sortOrder,
  onSort,
  onRowClick,
  selectedIds,
  onSelectionChange,
  showAllPasswords = false,
}: CredentialsTableProps) {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const togglePasswordVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      console.log('CredentialsTable: copy success');
      toast.success('Copied!', undefined, 1500);
    } catch (err) {
      console.error('CredentialsTable: copy failed', err);
      toast.error('Copy failed', err instanceof Error ? err.message : undefined, 3000);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === credentials.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(credentials.map(c => c.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getStrengthBadge = (strength: Credential['passwordStrength']) => {
    const styles = {
      weak: 'bg-danger/10 text-danger',
      medium: 'bg-warning/10 text-warning',
      strong: 'bg-accent/10 text-accent',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[strength]}`}>
        {strength}
      </span>
    );
  };

  const maskPassword = (password: string) => {
    if (!password) return '';
    if (password.length <= 3) {
      return '*'.repeat(password.length);
    }
    // Show first 2 and last 1 character: "ad*****h"
    const first = password.substring(0, 2);
    const last = password.substring(password.length - 1);
    const middle = '*'.repeat(password.length - 3);
    return `${first}${middle}${last}`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === credentials.length && credentials.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort('email')}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Email
                  {getSortIcon('email')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Password</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort('domain')}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Sub domain
                  {getSortIcon('domain')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort('passwordStrength')}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Strength
                  {getSortIcon('passwordStrength')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => onSort('breachDate')}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Breach Date
                  {getSortIcon('breachDate')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((cred) => (
              <tr
                key={cred.id}
                onClick={() => onRowClick(cred)}
                className="border-b border-border hover:bg-card-hover cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cred.id)}
                    onChange={(e) => toggleSelect(cred.id, e)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{cred.email}</span>
                    {cred.isAdmin && (
                      <Shield className="w-4 h-4 text-danger" aria-label="Admin Account" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-foreground">
                      {(showAllPasswords || showPasswords[cred.id]) ? cred.password : maskPassword(cred.password)}
                    </span>
                    <button
                      onClick={(e) => togglePasswordVisibility(cred.id, e)}
                      className="p-1 hover:bg-border rounded transition-colors"
                      title={showPasswords[cred.id] ? 'Hide' : 'Show'}
                    >
                      <Eye className="w-4 h-4 text-muted" />
                    </button>
                    <button
                      onClick={(e) => copyToClipboard(cred.password, e)}
                      className="p-1 hover:bg-border rounded transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-4 h-4 text-muted" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted">{cred.domain}</span>
                </td>
                <td className="px-4 py-3">
                  {getStrengthBadge(cred.passwordStrength)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted">
                    {format(parseISO(cred.breachDate), 'MMM dd, yyyy')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {cred.verified ? (
                      <CheckCircle2 className="w-4 h-4 text-accent" aria-label="Verified" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted" aria-label="Unverified" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {credentials.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-muted">No credentials found matching your filters</p>
        </div>
      )}
    </div>
  );
}
