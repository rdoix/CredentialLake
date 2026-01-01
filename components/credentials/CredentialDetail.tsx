'use client';

import { Credential } from '@/types/credential';
import { X, Shield, CheckCircle2, XCircle, Copy, Calendar, Clock, Globe, MapPin, Monitor } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';

interface CredentialDetailProps {
  credential: Credential | null;
  onClose: () => void;
}

export default function CredentialDetail({ credential, onClose }: CredentialDetailProps) {
  const toast = useToast();
  if (!credential) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('CredentialDetail: copy success');
      toast.success('Copied!', undefined, 1500);
    } catch (err) {
      console.error('CredentialDetail: copy failed', err);
      toast.error('Copy failed', err instanceof Error ? err.message : undefined, 3000);
    }
  };

  const getStrengthColor = (strength: Credential['passwordStrength']) => {
    const colors = {
      weak: 'text-danger',
      medium: 'text-warning',
      strong: 'text-accent',
    };
    return colors[strength];
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground mb-2">Credential Details</h2>
            <p className="text-sm text-muted">{credential.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Account Info */}
          <div className="bg-background rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Account Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Email Address</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground font-mono">{credential.email}</p>
                  <button
                    onClick={() => copyToClipboard(credential.email)}
                    className="p-1 hover:bg-card-hover rounded transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3 text-muted" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Password</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground font-mono">{credential.password}</p>
                  <button
                    onClick={() => copyToClipboard(credential.password)}
                    className="p-1 hover:bg-card-hover rounded transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3 text-muted" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Sub domain</label>
                <p className="text-sm text-foreground">{credential.domain}</p>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Password Strength</label>
                <p className={`text-sm font-medium ${getStrengthColor(credential.passwordStrength)}`}>
                  {credential.passwordStrength.charAt(0).toUpperCase() + credential.passwordStrength.slice(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-3">
            {credential.isAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
                <Shield className="w-4 h-4 text-danger" />
                <span className="text-sm font-medium text-danger">Admin Account</span>
              </div>
            )}

            {credential.verified ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/10 border border-border rounded-lg">
                <XCircle className="w-4 h-4 text-muted" />
                <span className="text-sm font-medium text-muted">Unverified</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-background rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Timeline
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-danger" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Breach Date</p>
                  <p className="text-xs text-muted">
                    {format(parseISO(credential.breachDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Discovered</p>
                  <p className="text-xs text-muted">
                    {format(parseISO(credential.discoveredAt), 'MMMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="bg-background rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Source</h3>
            <div className="flex items-center gap-2">
              {credential.source ? (
                <a
                  href={credential.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline break-all"
                >
                  {credential.source}
                </a>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
              {credential.source && (
                <button
                  onClick={() => copyToClipboard(credential.source)}
                  className="p-1 hover:bg-card-hover rounded transition-colors"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3 text-muted" />
                </button>
              )}
            </div>
          </div>

          {/* Metadata */}
          {credential.metadata && (
            <div className="bg-background rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Additional Metadata</h3>

              <div className="grid grid-cols-2 gap-4">
                {credential.metadata.ipAddress && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">IP Address</label>
                    <p className="text-sm text-foreground font-mono">{credential.metadata.ipAddress}</p>
                  </div>
                )}

                {credential.metadata.location && (
                  <div>
                    <label className="text-xs text-muted mb-1 block flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Location
                    </label>
                    <p className="text-sm text-foreground">{credential.metadata.location}</p>
                  </div>
                )}

                {credential.metadata.browser && (
                  <div>
                    <label className="text-xs text-muted mb-1 block flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      Browser
                    </label>
                    <p className="text-sm text-foreground">{credential.metadata.browser}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
