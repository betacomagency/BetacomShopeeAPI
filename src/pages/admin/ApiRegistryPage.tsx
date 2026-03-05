/**
 * API Registry Page - Danh sách API endpoints đã sử dụng (admin only)
 */

import { useAuth } from '@/hooks/useAuth';
import { ApiRegistryPanel } from '@/components/panels/ApiRegistryPanel';
import { Spinner } from '@/components/ui/spinner';

export default function ApiRegistryPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user?.id) return null;

  return <ApiRegistryPanel />;
}
