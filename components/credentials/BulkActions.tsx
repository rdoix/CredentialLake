'use client';

import { Download, Trash2, CheckCircle2, Mail } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onExport: () => void;
  onDelete: () => void;
  onMarkVerified: () => void;
  onNotify: () => void;
}

export default function BulkActions({
  selectedCount,
  onExport,
  onDelete,
  onMarkVerified,
  onNotify,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {selectedCount} credential{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExport}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Selected
          </button>

          <button
            onClick={onMarkVerified}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark Verified
          </button>

          <button
            onClick={onNotify}
            className="px-4 py-2 bg-warning hover:bg-warning/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Notify
          </button>

          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
