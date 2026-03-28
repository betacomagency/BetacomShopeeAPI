import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { HealthPage } from '@/pages/health-page';
import { ApiAnalyticsPage } from '@/pages/api-analytics-page';
import { BusinessPage } from '@/pages/business-page';
import { ActivityPage } from '@/pages/activity-page';
import { TracePage } from '@/pages/trace-page';

export function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <Routes>
          <Route path="/" element={<HealthPage />} />
          <Route path="/api" element={<ApiAnalyticsPage />} />
          <Route path="/business" element={<BusinessPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/trace" element={<TracePage />} />
        </Routes>
      </main>
    </div>
  );
}
