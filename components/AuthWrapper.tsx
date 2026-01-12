'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { API_ENDPOINTS } from '@/lib/api-config';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isCollector, token, logout } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

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

  // Session validation and auto-logout on expiration/inactive
  useEffect(() => {
    const isLogin = pathname?.startsWith('/login');
    if (isLogin) return;

    // Only check when authenticated and token present
    if (!isAuthenticated || !token) return;

    let intervalId: number | undefined;

    const checkSession = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.AUTH_ME, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // Notify user and redirect to login
          if (res.status === 401) {
            toast.error('Session expired', 'Your session has expired. Please log in again.');
          } else if (res.status === 403) {
            toast.warning('Access denied', 'Your account is inactive. Please contact an administrator.');
          } else {
            toast.error('Authentication error', 'Please log in again.');
          }
          // Clear auth and redirect
          logout();
          router.push('/login/');
        }
      } catch {
        // Network errors during background checks are ignored to avoid noisy UI
      }
    };

    // Initial check, then periodic checks every 60s
    checkSession();
    intervalId = window.setInterval(checkSession, 60000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAuthenticated, token, pathname, router, logout, toast]);

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