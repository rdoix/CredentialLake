'use client';

import { X } from 'lucide-react';
import { CredentialFilters } from '@/types/credential';
import DateTimeRangePicker, { DateTimeRange } from '@/components/DateTimeRangePicker';

interface FilterPanelProps {
  filters: CredentialFilters;
  onFilterChange: (filters: CredentialFilters) => void;
  onClearFilters: () => void;
  availableDomains: string[];
  availableSources: string[];
}

export default function FilterPanel({
  filters,
  onFilterChange,
  onClearFilters,
  availableDomains,
  availableSources,
}: FilterPanelProps) {
  const updateFilter = (key: keyof CredentialFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const togglePasswordStrength = (strength: 'weak' | 'medium' | 'strong') => {
    const current = filters.passwordStrength || [];
    const updated = current.includes(strength)
      ? current.filter(s => s !== strength)
      : [...current, strength];
    updateFilter('passwordStrength', updated);
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof CredentialFilters];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== '';
  });

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Advanced Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-danger hover:text-danger/80 font-medium flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sub domain Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Sub domain</label>
          <select
            value={filters.domain || ''}
            onChange={(e) => updateFilter('domain', e.target.value || undefined)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Sub domains</option>
            {availableDomains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Source</label>
          <select
            value={filters.source || ''}
            onChange={(e) => updateFilter('source', e.target.value || undefined)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Sources</option>
            {availableSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        {/* Date Range Picker */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-2">Breach Date Range</label>
          <DateTimeRangePicker
            value={{
              from: filters.dateFrom,
              to: filters.dateTo
            }}
            onChange={(range: DateTimeRange) => {
              onFilterChange({
                ...filters,
                dateFrom: range.from,
                dateTo: range.to
              });
            }}
            placeholder="Select breach date range"
          />
        </div>

        {/* Admin Status */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Account Type</label>
          <select
            value={filters.isAdmin === undefined ? '' : filters.isAdmin.toString()}
            onChange={(e) => updateFilter('isAdmin', e.target.value === '' ? undefined : e.target.value === 'true')}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Accounts</option>
            <option value="true">Admin Only</option>
            <option value="false">Non-Admin Only</option>
          </select>
        </div>

        {/* Verified Status */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Verification</label>
          <select
            value={filters.verified === undefined ? '' : filters.verified.toString()}
            onChange={(e) => updateFilter('verified', e.target.value === '' ? undefined : e.target.value === 'true')}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All</option>
            <option value="true">Verified Only</option>
            <option value="false">Unverified Only</option>
          </select>
        </div>
      </div>

      {/* Password Strength Checkboxes */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-3">Password Strength</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.passwordStrength?.includes('weak') || false}
              onChange={() => togglePasswordStrength('weak')}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Weak</span>
            <span className="px-2 py-0.5 bg-danger/10 text-danger rounded text-xs font-medium">!</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.passwordStrength?.includes('medium') || false}
              onChange={() => togglePasswordStrength('medium')}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Medium</span>
            <span className="px-2 py-0.5 bg-warning/10 text-warning rounded text-xs font-medium">~</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.passwordStrength?.includes('strong') || false}
              onChange={() => togglePasswordStrength('strong')}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Strong</span>
            <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">✓</span>
          </label>
        </div>
      </div>
    </div>
  );
}
