'use client';

import { NotificationConfig, NotificationTriggers } from '@/types/settings';
import { Bell } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Notification Triggers */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Notification Triggers</h3>
            <p className="text-sm text-muted">Choose when to receive notifications (configure providers in API Keys tab)</p>
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
