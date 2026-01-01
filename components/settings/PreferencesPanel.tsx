'use client';

import { UserPreferences } from '@/types/settings';
import { User, FileText, RefreshCw } from 'lucide-react';

interface PreferencesPanelProps {
  preferences: UserPreferences;
  onChange: (preferences: UserPreferences) => void;
}

export default function PreferencesPanel({ preferences, onChange }: PreferencesPanelProps) {
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    onChange({ ...preferences, [key]: value });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <User className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
          <p className="text-sm text-muted">Customize your experience</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Theme selection removed - use global ThemeToggle button in the header */}

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Timezone</label>
          <select
            value={preferences.timezone}
            onChange={(e) => updatePreference('timezone', e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
            <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
            <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
            <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
            <option value="UTC">UTC (GMT+0)</option>
            <option value="America/New_York">America/New York (GMT-5)</option>
            <option value="America/Los_Angeles">America/Los Angeles (GMT-8)</option>
            <option value="Europe/London">Europe/London (GMT+0)</option>
            <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
          </select>
          <p className="text-xs text-muted mt-1">All times will be displayed in your local timezone</p>
        </div>

        {/* Page Size */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Default Page Size</label>
          <select
            value={preferences.pageSize}
            onChange={(e) => updatePreference('pageSize', Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={10}>10 items</option>
            <option value={25}>25 items</option>
            <option value={50}>50 items</option>
            <option value={100}>100 items</option>
          </select>
          <p className="text-xs text-muted mt-1">Number of items to display per page</p>
        </div>

        {/* Auto Refresh */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Auto Refresh</label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-background rounded-lg">
            <input
              type="checkbox"
              checked={preferences.autoRefresh}
              onChange={(e) => updatePreference('autoRefresh', e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm text-foreground">Enable automatic data refresh</p>
              <p className="text-xs text-muted">Dashboard will refresh automatically</p>
            </div>
          </label>
        </div>

        {/* Refresh Interval */}
        {preferences.autoRefresh && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Refresh Interval</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="30"
                max="300"
                step="30"
                value={preferences.refreshInterval}
                onChange={(e) => updatePreference('refreshInterval', Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-primary min-w-[60px]">
                {preferences.refreshInterval}s
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Time between automatic refreshes</p>
          </div>
        )}

        {/* Show Passwords by Default */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-background rounded-lg">
            <input
              type="checkbox"
              checked={preferences.showPasswordsByDefault}
              onChange={(e) => updatePreference('showPasswordsByDefault', e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm text-foreground">Show passwords by default</p>
              <p className="text-xs text-muted">Passwords will be visible without clicking eye icon</p>
            </div>
          </label>
        </div>

        {/* Export Format */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Export Format</label>
          </div>
          <select
            value={preferences.exportFormat}
            onChange={(e) => updatePreference('exportFormat', e.target.value as 'csv' | 'json' | 'xlsx')}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="csv">CSV (Comma-separated)</option>
            <option value="json">JSON (JavaScript Object Notation)</option>
            <option value="xlsx">XLSX (Excel)</option>
          </select>
          <p className="text-xs text-muted mt-1">Preferred format for data exports</p>
        </div>
      </div>
    </div>
  );
}
