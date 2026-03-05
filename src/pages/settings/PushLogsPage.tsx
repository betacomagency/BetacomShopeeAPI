import { PushLogsPanel } from '@/components/panels/PushLogsPanel';

export default function PushLogsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Push Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Theo dõi push notifications từ Shopee Open Platform
        </p>
      </div>
      <PushLogsPanel />
    </div>
  );
}
