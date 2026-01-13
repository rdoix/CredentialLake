'use client';

import { ApiKeys } from '@/types/settings';
import { Key, Eye, EyeOff, Check, Send, TestTube } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-config';
import { useToast } from '@/contexts/ToastContext';
import { useUser } from '@/contexts/UserContext';

interface ApiKeysPanelProps {
  apiKeys: ApiKeys;
  onChange: (apiKeys: ApiKeys) => void;
}

const API_BASE_URL = getApiUrl();

export default function ApiKeysPanel({ apiKeys, onChange }: ApiKeysPanelProps) {
  const { token } = useUser();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    intelx: false,
    nvd: false,
    telegram: false,
    slack: false,
    teams: false,
  });
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({
    intelx: false,
    nvd: false,
    telegram: false,
    telegramChatId: false,
    slack: false,
    teams: false,
  });
  // IntelX activation diagnostics exposed by backend settings.to_dict():
  // - intelx_key_active: boolean
  // - intelx_key_source: 'db' | 'env' | null
  const [intelxStatus, setIntelxStatus] = useState<{ active: boolean; source: 'db' | 'env' | null }>({
    active: false,
    source: null,
  });
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  // Fetch existing settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/settings/`, {
          headers,
        });
        if (!res.ok) return;
        
        const data = await res.json();
        console.log('[ApiKeysPanel] Fetched settings:', data);
        
        // Check which keys are set on server (backend returns masked values like "ad*****h")
        setServerKeys({
          intelx: !!data.intelx_api_key,
          nvd: !!data.nvd_api_key,
          telegram: !!data.telegram_bot_token,
          telegramChatId: !!data.telegram_chat_id,
          slack: !!data.slack_webhook_url,
          teams: !!data.teams_webhook_url,
        });

        // IntelX activation diagnostics from backend (env vs db)
        setIntelxStatus({
          active: !!data.intelx_key_active,
          source: (data.intelx_key_source || null) as 'db' | 'env' | null,
        });

        // If keys exist on server, show the masked value from backend in the input field
        const updatedKeys: ApiKeys = {
          intelx: data.intelx_api_key || apiKeys.intelx || '',
          nvd: data.nvd_api_key || apiKeys.nvd || '',
          telegram: data.telegram_bot_token || apiKeys.telegram || '',
          telegramChatId: data.telegram_chat_id || apiKeys.telegramChatId || '',
          slack: data.slack_webhook_url || apiKeys.slack || '',
          teams: data.teams_webhook_url || apiKeys.teams || '',
        };
        
        console.log('[ApiKeysPanel] Setting keys:', updatedKeys);
        onChange(updatedKeys);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
 
    fetchSettings();
  }, []);

  const updateKey = (key: keyof ApiKeys, value: string) => {
    onChange({ ...apiKeys, [key]: value });
  };

  const toggleVisibility = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    return '•'.repeat(Math.min(value.length, 40));
  };

  // Detect masked server-provided value (e.g., "ad*****h")
  const isMaskedValue = (v: string | undefined) =>
    typeof v === 'string' && v.includes('*');

  const testNotification = async (service: 'telegram' | 'slack' | 'teams') => {
    setTesting(service);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let payload: any = {};
      
      if (service === 'telegram') {
        // Prevent masked token usage
        if (isMaskedValue(apiKeys.telegram)) {
          toast.error('Masked Value', 'Bot Token is masked. Please re-enter the full token.');
          setTesting(null);
          return;
        }
        if (!apiKeys.telegram || !apiKeys.telegramChatId) {
          toast.error('Missing Configuration', 'Please enter both Bot Token and Chat ID');
          setTesting(null);
          return;
        }
        payload = {
          provider: 'telegram',
          bot_token: apiKeys.telegram,
          chat_id: apiKeys.telegramChatId,
        };
      } else if (service === 'slack') {
        if (isMaskedValue(apiKeys.slack)) {
          toast.error('Masked Value', 'Slack Webhook URL is masked. Please paste the full webhook URL.');
          setTesting(null);
          return;
        }
        if (!apiKeys.slack) {
          toast.error('Missing Configuration', 'Please enter Slack Webhook URL');
          setTesting(null);
          return;
        }
        payload = {
          provider: 'slack',
          webhook_url: apiKeys.slack,
        };
      } else if (service === 'teams') {
        if (isMaskedValue(apiKeys.teams)) {
          toast.error('Masked Value', 'Teams Webhook URL is masked. Please paste the full webhook URL.');
          setTesting(null);
          return;
        }
        if (!apiKeys.teams) {
          toast.error('Missing Configuration', 'Please enter Teams Webhook URL');
          setTesting(null);
          return;
        }
        payload = {
          provider: 'teams',
          webhook_url: apiKeys.teams,
        };
      }

      const res = await fetch(`${API_BASE_URL}/settings/test-notification`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Test Sent', `Test notification sent to ${service} successfully!`);
      } else {
        const error = await res.text();
        toast.error('Test Failed', `Failed to send test notification: ${error}`);
      }
    } catch (error) {
      toast.error('Test Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(null);
    }
  };

  const apiKeyFields = [
    {
      key: 'intelx' as keyof ApiKeys,
      label: 'IntelX API Key',
      description: 'Required for scanning IntelX database',
      placeholder: 'Enter your IntelX API key',
      icon: '🔍',
    },
    {
      key: 'nvd' as keyof ApiKeys,
      label: 'NVD API Key',
      description: 'Optional - Increases CVE sync rate limit from 5 to 50 requests per 30 seconds',
      placeholder: 'Enter your NVD API key (optional)',
      icon: '🛡️',
    },
    {
      key: 'slack' as keyof ApiKeys,
      label: 'Slack Webhook URL',
      description: 'Webhook URL for Slack notifications',
      placeholder: 'https://hooks.slack.com/services/...',
      icon: '#️⃣',
      testable: true,
    },
    {
      key: 'teams' as keyof ApiKeys,
      label: 'Microsoft Teams Webhook',
      description: 'Webhook URL for Teams notifications',
      placeholder: 'https://outlook.office.com/webhook/...',
      icon: '🟦',
      testable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
            <p className="text-sm text-muted">Manage your integration API keys</p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-sm text-warning">
            <strong>⚠️ Security Notice:</strong> API keys are stored securely. Never share your keys with anyone.
          </p>
        </div>

        <div className="space-y-6">
          {apiKeyFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="mr-2">{field.icon}</span>
                {field.label}
              </label>
              <p className="text-xs text-muted mb-2">{field.description}</p>
              <div className="relative">
                <input
                  type={
                    // If we have a masked server value and user hasn't toggled "show", display as plain text so user sees the asterisks
                    (isMaskedValue(apiKeys[field.key]) && !showKeys[field.key]) ? 'text'
                    // If user toggled show, show text; otherwise keep as password (bullets) for real input
                    : (showKeys[field.key] ? 'text' : 'password')
                  }
                  value={apiKeys[field.key]}
                  onChange={(e) => updateKey(field.key, e.target.value)}
                  onFocus={() => {
                    // If the field currently holds a masked server value and user focuses to edit, clear it for fresh input
                    if (isMaskedValue(apiKeys[field.key]) && !showKeys[field.key]) {
                      updateKey(field.key, '');
                      setServerKeys(prev => ({ ...prev, [field.key]: false }));
                    }
                  }}
                  placeholder={field.placeholder}
                  className="w-full pl-4 pr-12 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(field.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-card-hover rounded transition-colors"
                >
                  {showKeys[field.key] ? (
                    <EyeOff className="w-4 h-4 text-muted" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted" />
                  )}
                </button>
              </div>
              {(apiKeys[field.key] || serverKeys[field.key]) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-accent">
                  <Check className="w-3 h-3" />
                  <span>
                    API key configured
                    {isMaskedValue(apiKeys[field.key]) ? ' (masked from server)' : ''}
                  </span>
                </div>
              )}
              {/* IntelX activation/source status (ENV vs DB) */}
              {field.key === 'intelx' && (
                <div className="mt-1 text-xs text-muted">
                  {intelxStatus.active ? (
                    <span>
                      IntelX key active (source: {intelxStatus.source === 'db' ? 'Settings (DB)' : 'Environment'})
                    </span>
                  ) : (
                    <span>
                      No IntelX key detected. Workers will use DB or environment if provided.
                    </span>
                  )}
                </div>
              )}
              {'testable' in field && field.testable && (
                <button
                  onClick={() => testNotification(field.key as 'slack' | 'teams')}
                  disabled={testing === field.key}
                  className="mt-2 w-full px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testing === field.key ? (
                    <>
                      <TestTube className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Test {field.label.split(' ')[0]}
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* Telegram Configuration */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <span className="text-xl">✈️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Telegram Configuration</h3>
            <p className="text-sm text-muted">Configure Telegram bot for notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Bot Token</label>
            <p className="text-xs text-muted mb-2">Get from @BotFather on Telegram</p>
            <div className="relative">
              <input
                type={
                  (isMaskedValue(apiKeys.telegram) && !showKeys.telegram) ? 'text'
                  : (showKeys.telegram ? 'text' : 'password')
                }
                value={apiKeys.telegram}
                onChange={(e) => updateKey('telegram', e.target.value)}
                onFocus={() => {
                  if (isMaskedValue(apiKeys.telegram) && !showKeys.telegram) {
                    updateKey('telegram', '');
                    setServerKeys(prev => ({ ...prev, telegram: false }));
                  }
                }}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full pl-4 pr-12 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => toggleVisibility('telegram')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-card-hover rounded transition-colors"
              >
                {showKeys.telegram ? (
                  <EyeOff className="w-4 h-4 text-muted" />
                ) : (
                  <Eye className="w-4 h-4 text-muted" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Chat ID</label>
            <p className="text-xs text-muted mb-2">Get from @userinfobot or getUpdates API</p>
            <input
              type="text"
              value={apiKeys.telegramChatId}
              onChange={(e) => updateKey('telegramChatId', e.target.value)}
              placeholder="123456789 (personal) or -1001234567890 (group)"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => testNotification('telegram')}
            disabled={testing === 'telegram'}
            className="w-full px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {testing === 'telegram' ? (
              <>
                <TestTube className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Test Telegram
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
