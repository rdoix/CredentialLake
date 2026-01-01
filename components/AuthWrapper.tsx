'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isCollector } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Always allow login page (robust: handle trailing slash and future variants)
    const isLogin = pathname?.startsWith('/login');
    if (isLogin) return;

    // Authentication required for all non-login pages
    if (!isAuthenticated) {
      // Use trailing slash to match Next trailingSlash config and avoid 308 loops
      router.push('/login/');
    }
  }, [isAuthenticated, pathname, router]);

  // RBAC route gating: enforce per-role access
  useEffect(() => {
    // Allow login everywhere (robust: handle trailing slash and future variants)
    const isLogin = pathname?.startsWith('/login');
    if (isLogin) return;

    // Settings: administrator only
    if (pathname.startsWith('/settings') && !isAdmin) {
      router.push('/');
      return;
    }

    // Collector: administrator or collector only
    if (pathname.startsWith('/collector') && !(isAdmin || isCollector)) {
      router.push('/');
      return;
    }
  }, [pathname, isAdmin, isCollector, router]);

  // Show login page without layout (robust: handle trailing slash and future variants)
  {
    const isLogin = pathname?.startsWith('/login');
    if (isLogin) {
      return <>{children}</>;
    }
  }

  // Show loading or redirect for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Show authenticated layout
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}