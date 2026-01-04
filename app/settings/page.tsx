'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsType } from '@/types/settings';
import { getDefaultSettings } from '@/lib/mock-settings';
import ApiKeysPanel from '@/components/settings/ApiKeysPanel';
import NotificationPanel from '@/components/settings/NotificationPanel';
import PreferencesPanel from '@/components/settings/PreferencesPanel';
import SystemPanel from '@/components/settings/SystemPanel';
import UserManagementPanel from '@/components/settings/UserManagementPanel';
import { useUser } from '@/contexts/UserContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiUrl } from '@/lib/api-config';
import { Save, RotateCcw, CheckCircle2, Key, Bell, User, Settings2, Users } from 'lucide-react';

type Tab = 'api-keys' | 'notifications' | 'preferences' | 'system' | 'users';

const SETTINGS_KEY = 'intelx_scanner_settings';
const API_BASE_URL = getApiUrl();

export default function Settings() {
  const { isAdmin, token } = useUser();
  const confirm = useConfirm();
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsType>(getDefaultSettings);
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const buildHeaders = (t: string | null): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    console.log('[Settings] localStorage raw:', saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('[Settings] localStorage parsed:', parsed);
        setSettings(parsed);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    } else {
      console.log('[Settings] No localStorage settings found; using defaults');
    }
  }, []);

  // Load masked API keys from backend settings and set into UI (without marking as changed)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/settings/`, {
          headers: buildHeaders(token),
        });
        if (!res.ok) return;
        const data = await res.json();

        // Merge masked keys and runtime tunables into current settings, do not set hasChanges
        setSettings(prev => ({
          ...prev,
          apiKeys: {
            intelx: data?.intelx_api_key ?? prev.apiKeys.intelx,
            nvd: data?.nvd_api_key ?? prev.apiKeys.nvd,
            telegram: data?.telegram_bot_token ?? prev.apiKeys.telegram,
            slack: data?.slack_webhook_url ?? prev.apiKeys.slack,
            teams: data?.teams_webhook_url ?? prev.apiKeys.teams,
          },
          system: {
            ...prev.system,
            // Runtime tunables from backend (camelCase in UI, snake_case from API)
            rqWorkers: typeof data?.rq_workers === 'number' ? data.rq_workers : (prev.system.rqWorkers ?? 5),
            parallelDomainWorkers: typeof data?.parallel_domain_workers === 'number' ? data.parallel_domain_workers : (prev.system.parallelDomainWorkers ?? 20),
            domainScanDelay: typeof data?.domain_scan_delay === 'number' ? data.domain_scan_delay : (prev.system.domainScanDelay ?? 0.1),
          },
        }));
      } catch (err) {
        // ignore fetch errors; UI still works with localStorage
        console.warn('Settings: failed to fetch backend settings', err);
      }
    })();
  }, [token]);

  const tabs = [
    { id: 'api-keys' as Tab, label: 'API Keys', icon: Key },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'preferences' as Tab, label: 'Preferences', icon: User },
    { id: 'system' as Tab, label: 'System', icon: Settings2 },
    ...(isAdmin ? [{ id: 'users' as Tab, label: 'User Management', icon: Users }] : []),
  ];

  const handleSave = async () => {
    setIsSaving(true);

    const notMasked = (v: string | undefined) =>
      typeof v === 'string' && v.length > 0 && !v.includes('*');

    try {
      // 1) Persist to backend (only send real values, never masked strings)
      const payload: Record<string, any> = {};
      const { apiKeys, system } = settings;

      if (notMasked(apiKeys.intelx)) payload.intelx_api_key = apiKeys.intelx;
      if (notMasked(apiKeys.nvd)) payload.nvd_api_key = apiKeys.nvd;
      if (notMasked(apiKeys.telegram)) payload.telegram_bot_token = apiKeys.telegram;
      if (notMasked(apiKeys.slack)) payload.slack_webhook_url = apiKeys.slack;
      if (notMasked(apiKeys.teams)) payload.teams_webhook_url = apiKeys.teams;

      // Runtime tunables for parallelism (numbers)
      if (typeof system.rqWorkers === 'number' && system.rqWorkers > 0) {
        payload.rq_workers = system.rqWorkers;
      }
      if (typeof system.parallelDomainWorkers === 'number' && system.parallelDomainWorkers > 0) {
        payload.parallel_domain_workers = system.parallelDomainWorkers;
      }
      if (typeof system.domainScanDelay === 'number' && system.domainScanDelay >= 0) {
        payload.domain_scan_delay = system.domainScanDelay;
      }

      if (Object.keys(payload).length > 0) {
        const res = await fetch(`${API_BASE_URL}/settings/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...buildHeaders(token) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`Backend update failed: ${res.status} ${res.statusText} ${t}`);
        }
      }

      // 2) Save UI preferences to localStorage
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      console.log('[Settings] Saved to localStorage:', settings);

      // 3) Refresh masked values from backend into UI
      try {
        const res2 = await fetch(`${API_BASE_URL}/settings/`, {
          headers: buildHeaders(token),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          console.log('[Settings] Backend masked settings:', data2);
          setSettings(prev => {
            const next = {
              ...prev,
              apiKeys: {
                intelx: data2?.intelx_api_key ?? prev.apiKeys.intelx,
                nvd: data2?.nvd_api_key ?? prev.apiKeys.nvd,
                telegram: data2?.telegram_bot_token ?? prev.apiKeys.telegram,
                slack: data2?.slack_webhook_url ?? prev.apiKeys.slack,
                teams: data2?.teams_webhook_url ?? prev.apiKeys.teams,
              },
            };
            console.log('[Settings] Applying backend masked keys into UI:', next.apiKeys);
            return next;
          });
        } else {
          console.warn('[Settings] Failed to refresh backend settings:', res2.status, res2.statusText);
        }
      } catch {
        // ignore refresh failure; UI will still have local values
      }

      setHasChanges(false);
      toast.success('Settings saved successfully', 'Your API keys were stored on the server and preferences saved.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings', `${error instanceof Error ? error.message : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const accepted = await confirm({
      title: 'Reset Settings',
      message: 'Reset all settings to defaults? This will revert local preferences.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      challenge: { type: 'checkbox', label: 'I understand this will overwrite current preferences' }
    });
    if (!accepted) return;
    setSettings(getDefaultSettings());
    setHasChanges(false);
  };

  const updateSettings = (newSettings: Partial<SettingsType>) => {
    setSettings({ ...settings, ...newSettings });
    setHasChanges(true);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted">Configure API keys, notifications, and system preferences</p>
      </div>

      {/* Save Bar (appears when changes exist) */}
      {hasChanges && (
        <div className="mb-6 bg-warning/10 border border-warning/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-warning" />
              <span className="text-sm font-medium text-warning">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Save className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3 font-medium transition-all whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-foreground'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'api-keys' && (
          <ApiKeysPanel
            apiKeys={settings.apiKeys}
            onChange={(apiKeys) => updateSettings({ apiKeys })}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationPanel
            config={settings.notifications}
            triggers={settings.notificationTriggers}
            onConfigChange={(notifications) => updateSettings({ notifications })}
            onTriggersChange={(notificationTriggers) => updateSettings({ notificationTriggers })}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesPanel
            preferences={settings.preferences}
            onChange={(preferences) => updateSettings({ preferences })}
          />
        )}

        {activeTab === 'system' && (
          <SystemPanel
            settings={settings.system}
            onChange={(system) => updateSettings({ system })}
          />
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagementPanel />
        )}
      </div>

      {/* Action Buttons (bottom) */}
      <div className="mt-8 flex items-center justify-between p-6 bg-card border border-border rounded-xl">
        <button
          onClick={handleReset}
          className="px-6 py-3 bg-card-hover hover:bg-border text-foreground rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Save className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save All Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
