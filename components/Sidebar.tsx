'use client';

import { LayoutDashboard, Database, Settings, ScanSearch, Building2, Clock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Collector', href: '/collector', icon: ScanSearch },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Credential Lake', href: '/credentials', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isAdmin, isCollector } = useUser();
  const { theme } = useTheme();
  const [logoError, setLogoError] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for Asia/Jakarta timezone
  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // useUser destructured above

  // Role-based navigation (Demo shows all; Admin shows all; Collector hides Settings; User hides Collector & Settings)
  const visibleNav = useMemo(() => {
    if (isAdmin) return navigation;
    if (isCollector) return navigation.filter(item => item.name !== 'Settings');
    return navigation.filter(item => item.name !== 'Settings' && item.name !== 'Collector');
  }, [isAdmin, isCollector]);

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-border">
      {/* Brand */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="Credential Lake"
            width={40}
            height={40}
            className="object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">Credential Lake</h1>
            <p className="text-xs text-muted">Credential Monitor</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-muted hover:text-foreground hover:bg-card-hover'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Clock */}
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground font-mono">{formatTime()}</p>
              <p className="text-xs text-muted">{formatDate()}</p>
            </div>
          </div>
        </div>


        {/* Branding */}
        <div className="px-4 py-2 text-center">
          <p className="text-xs text-muted">
            Built by <span className="font-semibold text-foreground">Rdoix</span>
          </p>
        </div>
      </div>
    </div>
  );
}
