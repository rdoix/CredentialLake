'use client';

import { SystemSettings } from '@/types/settings';
import { Settings2, Zap, Clock, RotateCcw, Database, Shield } from 'lucide-react';

interface SystemPanelProps {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
}

export default function SystemPanel({ settings, onChange }: SystemPanelProps) {
  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-danger" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">System Settings</h3>
          <p className="text-sm text-muted">Configure system behavior and limits</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Max Concurrent Scans */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Max Concurrent Scans</label>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxConcurrentScans}
              onChange={(e) => updateSetting('maxConcurrentScans', Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-bold text-primary min-w-[40px] text-center">
              {settings.maxConcurrentScans}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">Maximum number of scans that can run simultaneously</p>
        </div>

        {/* Job-level concurrency: RQ worker processes */}
        <div className="opacity-60">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">
              Worker Processes (RQ) <span className="text-xs text-warning">(Requires Restart)</span>
            </label>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={50}
              value={settings.rqWorkers ?? 5}
              onChange={(e) => updateSetting('rqWorkers', Number(e.target.value))}
              className="flex-1"
              disabled
            />
            <span className="text-lg font-bold text-primary min-w-[40px] text-center">
              {settings.rqWorkers ?? 5}
            </span>
          </div>
          <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded">
            <p className="text-xs text-warning">
              ⚠️ <strong>Restart Required:</strong> After changing, run: <code className="bg-background px-1 py-0.5 rounded">docker compose restart worker</code>
            </p>
            <p className="text-xs text-muted mt-1">
              Note: Currently stored in DB but worker reads from RQ_WORKERS env variable. Full implementation pending.
            </p>
          </div>
        </div>

        {/* Per-job domain concurrency */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Parallel Domain Workers</label>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={settings.parallelDomainWorkers ?? 20}
              onChange={(e) => updateSetting('parallelDomainWorkers', Number(e.target.value))}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="text-xs text-muted mt-1">
            Number of threads used inside a multi-domain scan job (higher = faster, mind API limits).
          </p>
        </div>

        {/* Domain request delay */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Domain Scan Delay (seconds)</label>
          </div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={settings.domainScanDelay ?? 0.1}
            onChange={(e) => updateSetting('domainScanDelay', Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted mt-1">Small delay between domain requests to prevent overload.</p>
        </div>

        {/* Scan Timeout */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Scan Timeout (seconds)</label>
          </div>
          <input
            type="number"
            min="60"
            max="3600"
            step="60"
            value={settings.scanTimeout}
            onChange={(e) => updateSetting('scanTimeout', Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted mt-1">Maximum time allowed for a single scan operation</p>
        </div>

        {/* Retry Attempts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Retry Attempts</label>
          </div>
          <select
            value={settings.retryAttempts}
            onChange={(e) => updateSetting('retryAttempts', Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={0}>0 (No retry)</option>
            <option value={1}>1 attempt</option>
            <option value={2}>2 attempts</option>
            <option value={3}>3 attempts</option>
            <option value={5}>5 attempts</option>
          </select>
          <p className="text-xs text-muted mt-1">Number of times to retry failed operations</p>
        </div>

        {/* Data Retention */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-muted" />
            <label className="block text-sm font-medium text-foreground">Data Retention (days)</label>
          </div>
          <input
            type="number"
            min="30"
            max="365"
            step="30"
            value={settings.dataRetentionDays}
            onChange={(e) => updateSetting('dataRetentionDays', Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted mt-1">
            How long to keep credential data. Manual cleanup required: <code className="text-xs bg-muted/20 px-1 py-0.5 rounded">docker compose exec backend python cli.py --cleanup --days 90</code>
          </p>
        </div>

        {/* Enable Audit Log */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-background rounded-lg opacity-60">
            <input
              type="checkbox"
              checked={settings.enableAuditLog}
              onChange={(e) => updateSetting('enableAuditLog', e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              disabled
            />
            <div className="flex items-center gap-2 flex-1">
              <Database className="w-4 h-4 text-muted" />
              <div>
                <p className="text-sm text-foreground">Enable Audit Logging <span className="text-xs text-warning">(In Development)</span></p>
                <p className="text-xs text-muted">Track all user actions and system events - Backend implementation in progress</p>
              </div>
            </div>
          </label>
        </div>

        {/* Enable Two-Factor Authentication */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-background rounded-lg opacity-60">
            <input
              type="checkbox"
              checked={settings.enableTwoFactor}
              onChange={(e) => updateSetting('enableTwoFactor', e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              disabled
            />
            <div className="flex items-center gap-2 flex-1">
              <Shield className="w-4 h-4 text-muted" />
              <div>
                <p className="text-sm text-foreground">Enable Two-Factor Authentication <span className="text-xs text-warning">(In Development)</span></p>
                <p className="text-xs text-muted">Require 2FA for accessing the platform - Backend implementation in progress</p>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-lg">
        <p className="text-sm text-danger">
          <strong>⚠️ Warning:</strong> Changing system settings may affect performance and security. Make sure you understand the implications.
        </p>
      </div>
    </div>
  );
}
