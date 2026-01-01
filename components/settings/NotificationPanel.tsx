'use client';

import { NotificationConfig, NotificationTriggers } from '@/types/settings';
import { Bell, Send, TestTube } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface NotificationPanelProps {
  config: NotificationConfig;
  triggers: NotificationTriggers;
  onConfigChange: (config: NotificationConfig) => void;
  onTriggersChange: (triggers: NotificationTriggers) => void;
}

export default function NotificationPanel({
  config,
  triggers,
  onConfigChange,
  onTriggersChange,
}: NotificationPanelProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  const testNotification = async (service: 'telegram' | 'slack' | 'teams') => {
    setTesting(service);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setTesting(null);
    toast.success('Test Sent', `Test notification sent to ${service}!`);
  };

  return (
    <div className="space-y-6">
      {/* Telegram */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <span className="text-xl">✈️</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Telegram</h3>
              <p className="text-sm text-muted">Send notifications to Telegram</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.telegram.enabled}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  telegram: { ...config.telegram, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {config.telegram.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Bot Token</label>
              <input
                type="text"
                value={config.telegram.botToken}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    telegram: { ...config.telegram, botToken: e.target.value },
                  })
                }
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Chat ID</label>
              <input
                type="text"
                value={config.telegram.chatId}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    telegram: { ...config.telegram, chatId: e.target.value },
                  })
                }
                placeholder="-1001234567890"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
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
        )}
      </div>

      {/* Slack */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="text-xl">#️⃣</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Slack</h3>
              <p className="text-sm text-muted">Send notifications to Slack</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.slack.enabled}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  slack: { ...config.slack, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {config.slack.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Webhook URL</label>
              <input
                type="text"
                value={config.slack.webhookUrl}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    slack: { ...config.slack, webhookUrl: e.target.value },
                  })
                }
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Channel</label>
              <input
                type="text"
                value={config.slack.channel}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    slack: { ...config.slack, channel: e.target.value },
                  })
                }
                placeholder="#security-alerts"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={() => testNotification('slack')}
              disabled={testing === 'slack'}
              className="w-full px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {testing === 'slack' ? (
                <>
                  <TestTube className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Test Slack
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Microsoft Teams */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-xl">🟦</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Microsoft Teams</h3>
              <p className="text-sm text-muted">Send notifications to Teams</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.teams.enabled}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  teams: { ...config.teams, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        {config.teams.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Webhook URL</label>
              <input
                type="text"
                value={config.teams.webhookUrl}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    teams: { ...config.teams, webhookUrl: e.target.value },
                  })
                }
                placeholder="https://outlook.office.com/webhook/..."
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={() => testNotification('teams')}
              disabled={testing === 'teams'}
              className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {testing === 'teams' ? (
                <>
                  <TestTube className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Test Teams
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Notification Triggers */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Notification Triggers</h3>
            <p className="text-sm text-muted">Choose when to receive notifications</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'onScanComplete', label: 'Scan Completed', desc: 'Notify when a scan finishes' },
            { key: 'onScanFailed', label: 'Scan Failed', desc: 'Notify when a scan fails' },
            { key: 'onAdminFound', label: 'Admin Account Found', desc: 'Notify when admin credentials are discovered' },
            { key: 'onWeakPasswordFound', label: 'Weak Password Found', desc: 'Notify when weak passwords are found' },
            { key: 'dailySummary', label: 'Daily Summary', desc: 'Receive daily statistics summary' },
          ].map((trigger) => (
            <label key={trigger.key} className="flex items-start gap-3 cursor-pointer p-3 hover:bg-card-hover rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={triggers[trigger.key as keyof NotificationTriggers]}
                onChange={(e) =>
                  onTriggersChange({
                    ...triggers,
                    [trigger.key]: e.target.checked,
                  })
                }
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{trigger.label}</p>
                <p className="text-xs text-muted">{trigger.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
