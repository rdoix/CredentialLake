'use client';

import { useEffect, useRef } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterToggle: () => void;
  onExport: () => void;
  onRefresh: () => void;
  showFilters: boolean;
  totalResults: number;
  autoFocus?: boolean;     // focus on first render
  maintainFocus?: boolean; // keep focus while typing despite re-renders
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  onFilterToggle,
  onExport,
  onRefresh,
  showFilters,
  totalResults,
  autoFocus = true,
  maintainFocus = true,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on initial mount if desired
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onSearchChange(val);
    // Ensure focus stays on the input even if the parent re-renders aggressively
    if (maintainFocus && inputRef.current) {
      requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleChange}
            placeholder="Search by email or sub domain..."
            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            autoFocus={autoFocus}
          />
          </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onFilterToggle}
            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              showFilters
                ? 'bg-primary text-white'
                : 'bg-card-hover hover:bg-border text-foreground'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <button
            onClick={onRefresh}
            className="px-4 py-3 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onExport}
            className="px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-muted">
          Found <span className="font-semibold text-foreground">{totalResults.toLocaleString()}</span> credentials
        </p>
      </div>
    </div>
  );
}
