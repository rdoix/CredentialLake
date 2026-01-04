'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateTimeRange {
  from?: string;
  to?: string;
  label?: string;
}

interface DateTimeRangePickerProps {
  value: DateTimeRange;
  onChange: (range: DateTimeRange) => void;
  placeholder?: string;
}

type QuickSelectOption = {
  label: string;
  getValue: () => DateTimeRange;
};

export default function DateTimeRangePicker({
  value,
  onChange,
  placeholder = 'Select date range'
}: DateTimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'absolute'>('quick');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [refreshUnit, setRefreshUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick select options
  const quickSelectOptions: QuickSelectOption[] = [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
          from: today.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
          label: 'Today'
        };
      }
    },
    {
      label: 'This week',
      getValue: () => {
        const today = new Date();
        const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
        firstDay.setHours(0, 0, 0, 0);
        return {
          from: firstDay.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
          label: 'This week'
        };
      }
    },
    {
      label: 'Last 15 minutes',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 15 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 15 minutes'
        };
      }
    },
    {
      label: 'Last 30 minutes',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 30 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 30 minutes'
        };
      }
    },
    {
      label: 'Last 1 hour',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 1 hour'
        };
      }
    },
    {
      label: 'Last 24 hours',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 24 hours'
        };
      }
    },
    {
      label: 'Last 7 days',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 7 days'
        };
      }
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 30 days'
        };
      }
    },
    {
      label: 'Last 90 days',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 90 days'
        };
      }
    },
    {
      label: 'Last 1 year',
      getValue: () => {
        const now = new Date();
        const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return {
          from: from.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
          label: 'Last 1 year'
        };
      }
    }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleQuickSelect = (option: QuickSelectOption) => {
    const range = option.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onChange({
        from: customFrom,
        to: customTo,
        label: `${customFrom} to ${customTo}`
      });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange({ from: undefined, to: undefined, label: undefined });
    setCustomFrom('');
    setCustomTo('');
  };

  const getDisplayText = () => {
    if (value.label) {
      return value.label;
    }
    if (value.from && value.to) {
      return `${value.from} to ${value.to}`;
    }
    if (value.from) {
      return `From ${value.from}`;
    }
    if (value.to) {
      return `To ${value.to}`;
    }
    return placeholder;
  };

  const hasValue = value.from || value.to;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-foreground hover:bg-card-hover transition-colors w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm">{getDisplayText()}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasValue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[600px] bg-card border border-border rounded-xl shadow-2xl z-[9999] overflow-hidden">
          {/* Header with Tabs */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('quick')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'quick'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground hover:bg-background'
                }`}
              >
                Quick select
              </button>
              <button
                onClick={() => setActiveTab('absolute')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'absolute'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground hover:bg-background'
                }`}
              >
                Absolute
              </button>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {activeTab === 'quick' ? (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Commonly used</h4>
                <div className="grid grid-cols-2 gap-2">
                  {quickSelectOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSelect(option)}
                      className="text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Recently used section (placeholder) */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Recently used date ranges</h4>
                  {value.label && (
                    <button
                      onClick={() => onChange(value)}
                      className="text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors w-full"
                    >
                      {value.label}
                    </button>
                  )}
                </div>

                {/* Refresh every section */}
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Refresh every</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <select
                      value={refreshUnit}
                      onChange={(e) => setRefreshUnit(e.target.value as 'seconds' | 'minutes')}
                      className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="seconds">seconds</option>
                      <option value="minutes">minutes</option>
                    </select>
                    <button
                      onClick={() => setIsRefreshing(!isRefreshing)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isRefreshing
                          ? 'bg-danger text-white hover:bg-danger/90'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {isRefreshing ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Absolute time range</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      From
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      To
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleApplyCustom}
                    disabled={!customFrom || !customTo}
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 flex items-center justify-between bg-background/50">
            <button
              onClick={handleClear}
              className="text-sm text-danger hover:text-danger/80 font-medium"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}