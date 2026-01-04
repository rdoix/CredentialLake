'use client';

import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import DateTimeRangePicker, { DateTimeRange } from '@/components/DateTimeRangePicker';

export interface DashboardFilters {
  domain?: string;
  tld?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface DashboardFilterProps {
  filters: DashboardFilters;
  onFilterChange: (filters: DashboardFilters) => void;
  onClearFilters: () => void;
  availableDomains: string[];
  availableTlds: string[];
}

export default function DashboardFilter({
  filters,
  onFilterChange,
  onClearFilters,
  availableDomains,
  availableTlds,
}: DashboardFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof DashboardFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof DashboardFilters];
    return value !== undefined && value !== '';
  });

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Header - Always Visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-background/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Dashboard Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearFilters();
              }}
              className="text-sm text-danger hover:text-danger/80 font-medium flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-danger/10 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted" />
          )}
        </div>
      </div>

      {/* Filter Content - Collapsible */}
      {isExpanded && (
        <div className="p-6 pt-0 border-t border-border relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sub domain Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Sub domain</label>
              <select
                value={filters.domain || ''}
                onChange={(e) => updateFilter('domain', e.target.value || undefined)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Sub domains</option>
                {availableDomains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>

            {/* TLD Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">TLD</label>
              <select
                value={filters.tld || ''}
                onChange={(e) => updateFilter('tld', e.target.value || undefined)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All TLDs</option>
                {availableTlds.map(tld => (
                  <option key={tld} value={tld}>{tld}</option>
                ))}
              </select>
            </div>

            {/* Date Range Picker */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
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
                placeholder="Select date range"
              />
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.domain && (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                  <span>Sub domain: {filters.domain}</span>
                  <button
                    onClick={() => updateFilter('domain', undefined)}
                    className="hover:text-primary/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {filters.tld && (
                <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
                  <span>TLD: {filters.tld}</span>
                  <button
                    onClick={() => updateFilter('tld', undefined)}
                    className="hover:text-accent/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm">
                  <span>
                    {filters.dateFrom && filters.dateTo
                      ? `${filters.dateFrom} to ${filters.dateTo}`
                      : filters.dateFrom
                      ? `From: ${filters.dateFrom}`
                      : `To: ${filters.dateTo}`}
                  </span>
                  <button
                    onClick={() => {
                      updateFilter('dateFrom', undefined);
                      updateFilter('dateTo', undefined);
                    }}
                    className="hover:text-secondary/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}