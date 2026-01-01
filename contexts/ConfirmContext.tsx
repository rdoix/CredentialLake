'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Variant = 'default' | 'danger';

type TextChallenge = {
  type: 'text';
  label?: string;
  placeholder?: string;
  expected?: string; // when provided, must match to enable confirm
  caseSensitive?: boolean;
};

type CheckboxChallenge = {
  type: 'checkbox';
  label: string; // user must check to enable confirm
};

type Challenge = TextChallenge | CheckboxChallenge;

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  // When present, user must complete the challenge to enable confirm
  challenge?: Challenge;
}

interface QueueItem {
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { options, resolve }]);
    });
  }, []);

  const active = queue[0];

  const handleClose = useCallback(
    (accepted: boolean) => {
      if (!active) return;
      // Resolve current item
      active.resolve(accepted);
      // Remove from queue
      setQueue((prev) => prev.slice(1));
    },
    [active]
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {active && (
        <ConfirmDialog
          options={active.options}
          onCancel={() => handleClose(false)}
          onConfirm={() => handleClose(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/* UI */

function ConfirmDialog({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    challenge,
  } = options;

  const dialogRef = useRef<HTMLDivElement>(null);
  const [textInput, setTextInput] = useState('');
  const [checkAck, setCheckAck] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && isConfirmEnabled) {
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const isConfirmEnabled = useMemo(() => {
    if (!challenge) return true;
    if (challenge.type === 'checkbox') {
      return checkAck;
    }
    // text
    const expected = challenge.expected ?? '';
    const normalize = (s: string) =>
      challenge.caseSensitive ? s : s.toLowerCase();
    return expected ? normalize(textInput.trim()) === normalize(expected) : textInput.trim().length > 0;
  }, [challenge, textInput, checkAck]);

  const borderTone =
    variant === 'danger' ? 'border-danger/40' : 'border-border';
  const accentTone =
    variant === 'danger' ? 'text-danger' : 'text-primary';
  const buttonTone =
    variant === 'danger'
      ? 'bg-danger hover:bg-danger/90'
      : 'bg-primary hover:bg-primary-hover';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        ref={dialogRef}
        className={`relative z-10 w-full max-w-lg bg-card border ${borderTone} rounded-xl shadow-xl animate-slide-in-right md:animate-none md:translate-x-0`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {variant === 'danger' && (
              <AlertTriangle className="w-5 h-5 text-danger" />
            )}
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-1 rounded hover:bg-white/5"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {message && (
            <p className="text-sm text-muted whitespace-pre-wrap">{message}</p>
          )}

          {challenge && (
            <div className="space-y-2">
              {challenge.type === 'text' ? (
                <>
                  <label className="block text-xs font-medium text-foreground">
                    {challenge.label ??
                      (challenge.expected
                        ? `Type "${challenge.expected}" to confirm`
                        : 'Type to confirm')}
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={challenge.placeholder ?? ''}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkAck}
                    onChange={(e) => setCheckAck(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">
                    {challenge.label}
                  </span>
                </label>
              )}
              {!isConfirmEnabled && (
                <p className="text-xs text-muted">
                  Complete the confirmation step to enable the action.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-card-hover hover:bg-border text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
            className={`px-4 py-2 ${buttonTone} text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}