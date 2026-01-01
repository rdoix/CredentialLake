'use client';

import { useUser } from '@/contexts/UserContext';
import { User, ChevronDown, LogOut, Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, logout, isAdmin } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
    setIsOpen(false);
  };

  return (
    <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Profile Switcher Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-3 px-4 py-2 rounded-lg transition-all
            bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30
          `}
        >
          <User className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-semibold flex items-center gap-2">
              {user?.full_name || user?.username || 'User'}
              {isAdmin && <Shield className="w-3 h-3 text-yellow-500" />}
            </p>
            <p className="text-xs opacity-75">
              {user?.username || 'Authenticated'}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
            {/* User Info Section */}
            {user && (
              <div className="p-4 border-b border-border bg-background">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {user.full_name}
                      {isAdmin && <Shield className="w-3 h-3 text-yellow-500" />}
                    </p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 border-t border-border bg-background">
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
