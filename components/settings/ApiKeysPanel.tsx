'use client';

import { ApiKeys } from '@/types/settings';
import { Key, Eye, EyeOff, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-config';

interface ApiKeysPanelProps {
  apiKeys: ApiKeys;
  onChange: (apiKeys: ApiKeys) => void;
}

const API_BASE_URL = getApiUrl();

export default function ApiKeysPanel({ apiKeys, onChange }: ApiKeysPanelProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    intelx: false,
    telegram: false,
    slack: false,
    teams: false,
  });
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({
    intelx: false,
    telegram: false,
    slack: false,
    teams: false,
  });

  // Fetch existing settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/settings/`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        
        const data = await res.json();
        console.log('[ApiKeysPanel] Fetched settings:', data);
        
        // Check which keys are set on server (backend returns masked values like "ad*****h")
        setServerKeys({
          intelx: !!data.intelx_api_key,
          telegram: !!data.telegram_bot_token,
          slack: !!data.slack_webhook_url,
          teams: !!data.teams_webhook_url,
        });

        // If keys exist on server, show the masked value from backend in the input field
        const updatedKeys: ApiKeys = {
          intelx: data.intelx_api_key || apiKeys.intelx || '',
          telegram: data.telegram_bot_token || apiKeys.telegram || '',
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

  const apiKeyFields = [
    {
      key: 'intelx' as keyof ApiKeys,
      label: 'IntelX API Key',
      description: 'Required for scanning IntelX database',
      placeholder: 'Enter your IntelX API key',
      icon: '🔍',
    },
    {
      key: 'telegram' as keyof ApiKeys,
      label: 'Telegram Bot Token',
      description: 'Bot token from @BotFather',
      placeholder: 'Enter Telegram bot token',
      icon: '✈️',
    },
    {
      key: 'slack' as keyof ApiKeys,
      label: 'Slack Webhook URL',
      description: 'Webhook URL for Slack notifications',
      placeholder: 'https://hooks.slack.com/services/...',
      icon: '#️⃣',
    },
    {
      key: 'teams' as keyof ApiKeys,
      label: 'Microsoft Teams Webhook',
      description: 'Webhook URL for Teams notifications',
      placeholder: 'https://outlook.office.com/webhook/...',
      icon: '🟦',
    },
  ];

  return (
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
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <p className="text-sm text-warning">
          <strong>⚠️ Security Notice:</strong> API keys are stored securely. Never share your keys with anyone.
        </p>
      </div>
    </div>
  );
}
