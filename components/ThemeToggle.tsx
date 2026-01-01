'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-14 w-28 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
          : 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%)',
        boxShadow: isDark
          ? '0 4px 14px 0 rgba(15, 23, 42, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.05)'
          : '0 4px 14px 0 rgba(56, 189, 248, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3)'
      }}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        {isDark ? (
          // Stars for dark mode - positioned on the right side to avoid moon knob
          <>
            <div className="absolute top-2 right-4 w-1 h-1 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
            <div className="absolute top-4 right-7 w-0.5 h-0.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-6 right-5 w-0.5 h-0.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-8 right-3 w-1 h-1 bg-white/30 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
          </>
        ) : (
          // Clouds for light mode - positioned on the left side to avoid sun knob
          <>
            <div className="absolute top-2 left-2 w-6 h-3 bg-white/70 rounded-full blur-[2px]" />
            <div className="absolute top-4 left-4 w-5 h-2.5 bg-white/60 rounded-full blur-[2px]" />
            <div className="absolute top-7 left-3 w-4 h-2 bg-white/65 rounded-full blur-[2px]" />
          </>
        )}
      </div>

      {/* Toggle knob with icon */}
      <div
        className="absolute top-1 flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 transform"
        style={{
          left: isDark ? '4px' : 'calc(100% - 52px)',
          background: isDark
            ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
            : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          boxShadow: isDark
            ? '0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
            : '0 4px 8px rgba(251, 191, 36, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.9)'
        }}
      >
        {isDark ? (
          <Moon 
            className="w-6 h-6 transition-all duration-300" 
            style={{ color: '#64748b' }}
            strokeWidth={2}
          />
        ) : (
          <Sun 
            className="w-7 h-7 transition-all duration-300" 
            style={{ color: '#f59e0b' }}
            strokeWidth={2.5}
          />
        )}
      </div>

      {/* No track icons - only the icon in the knob should be visible */}
    </button>
  );
}