/**
 * Admin Monitoring Page — Renders tab content based on URL param
 * Routes: /admin/monitoring (health), /admin/monitoring/api, /business, /activity, /trace
 */
import { useParams } from 'react-router-dom';
import { HealthTab } from '@/components/panels/monitoring/health-tab';
import { ApiAnalyticsTab } from '@/components/panels/monitoring/api-analytics-tab';
import { BusinessTab } from '@/components/panels/monitoring/business-tab';
import { ActivityTab } from '@/components/panels/monitoring/activity-tab';
import { TraceTab } from '@/components/panels/monitoring/trace-tab';

const TAB_COMPONENTS: Record<string, React.FC> = {
  health: HealthTab,
  api: ApiAnalyticsTab,
  business: BusinessTab,
  activity: ActivityTab,
  trace: TraceTab,
};

const TAB_TITLES: Record<string, string> = {
  health: 'System Health',
  api: 'API Analytics',
  business: 'Business Metrics',
  activity: 'User Activity',
  trace: 'Request Trace',
};

export default function MonitoringPage() {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab && TAB_COMPONENTS[tab] ? tab : 'health';
  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{TAB_TITLES[activeTab]}</h1>
      <TabComponent />
    </div>
  );
}
