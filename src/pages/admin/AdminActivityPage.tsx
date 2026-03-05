/**
 * Admin Activity Logs Page - Lịch sử thao tác (admin only)
 */

import { useAuth } from '@/hooks/useAuth';
import { ActivityLogsPanel } from '@/components/panels/ActivityLogsPanel';
import { Spinner } from '@/components/ui/spinner';

export default function AdminActivityPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user?.id) return null;

  return <ActivityLogsPanel />;
}
