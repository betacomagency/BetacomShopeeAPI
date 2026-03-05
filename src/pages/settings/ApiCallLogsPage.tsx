import { ApiCallLogsPanel } from '@/components/panels/ApiCallLogsPanel';

export default function ApiCallLogsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Call Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Theo dõi các lệnh gọi Shopee API từ hệ thống
        </p>
      </div>
      <ApiCallLogsPanel />
    </div>
  );
}
