/**
 * Admin Layout - Layout riêng cho Admin Panel
 * Dùng AdminSidebar thay vì Sidebar, giữ Breadcrumb header
 */

import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import AdminSidebar from './AdminSidebar';
import Breadcrumb from './Breadcrumb';
import { cn } from '@/lib/utils';

export default function AdminLayout() {
  const { isAuthenticated, isLoading, session } = useAuth();
  const { isAdmin, isLoading: permLoading } = usePermissionsContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if ((isLoading && !session) || permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-info border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main
        className={cn(
          'min-h-screen h-screen flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]',
          'pl-0'
        )}
      >
        <Breadcrumb onMobileMenuClick={() => setMobileMenuOpen(true)} />

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
