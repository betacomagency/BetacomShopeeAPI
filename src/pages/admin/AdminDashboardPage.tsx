/**
 * Admin Dashboard Page - Tổng quan hệ thống (admin only)
 */

import { useAuth } from '@/hooks/useAuth';
import { AdminDashboardPanel } from '@/components/panels/AdminDashboardPanel';
import { Spinner } from '@/components/ui/spinner';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user?.id) return null;

  return <AdminDashboardPanel userId={user.id} />;
}
