'use client';

import { CredentialStats } from '@/types/credential';
import { Database, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';

interface StatsBarProps {
  stats: CredentialStats;
}

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted">Total</p>
        </div>
        <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <p className="text-xs text-muted">Verified</p>
        </div>
        <p className="text-2xl font-bold text-accent">{stats.verified.toLocaleString()}</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-danger" />
          <p className="text-xs text-muted">Admin</p>
        </div>
        <p className="text-2xl font-bold text-danger">{stats.admin.toLocaleString()}</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-danger" />
          <p className="text-xs text-muted">Weak</p>
        </div>
        <p className="text-2xl font-bold text-danger">{stats.weak.toLocaleString()}</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <p className="text-xs text-muted">Medium</p>
        </div>
        <p className="text-2xl font-bold text-warning">{stats.medium.toLocaleString()}</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <p className="text-xs text-muted">Strong</p>
        </div>
        <p className="text-2xl font-bold text-accent">{stats.strong.toLocaleString()}</p>
      </div>
    </div>
  );
}
