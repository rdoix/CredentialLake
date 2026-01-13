'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DeploymentHintProps {
  message?: string;
  storageKey?: string;
}

export default function DeploymentHint({ 
  message = "Configuration changes detected. Please rebuild Docker containers for changes to take effect.",
  storageKey = "deployment_hint_dismissed"
}: DeploymentHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this hint
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-500 mb-1">
              Docker Rebuild Required
            </h4>
            <p className="text-xs text-foreground/80 mb-3">
              {message}
            </p>
            <div className="bg-background/50 rounded p-2 mb-2">
              <code className="text-xs text-foreground font-mono block">
                docker-compose down<br/>
                docker-compose build<br/>
                docker-compose up -d
              </code>
            </div>
            <button
              onClick={handleDismiss}
              className="text-xs text-yellow-500 hover:text-yellow-400 font-medium"
            >
              Got it, don't show again
            </button>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}