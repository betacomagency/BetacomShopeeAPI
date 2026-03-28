/**
 * Admin Monitoring Page — System observability dashboard with 5 tabs
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { HealthTab } from '@/components/panels/monitoring/health-tab';
import { ApiAnalyticsTab } from '@/components/panels/monitoring/api-analytics-tab';
import { BusinessTab } from '@/components/panels/monitoring/business-tab';
import { ActivityTab } from '@/components/panels/monitoring/activity-tab';
import { TraceTab } from '@/components/panels/monitoring/trace-tab';
import { Heart, BarChart3, Activity, Users, Search } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Monitoring</h1>

      <Tabs defaultValue="health">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="health" className="cursor-pointer gap-1.5">
            <Heart className="h-3.5 w-3.5" /> Health
          </TabsTrigger>
          <TabsTrigger value="api" className="cursor-pointer gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> API Analytics
          </TabsTrigger>
          <TabsTrigger value="business" className="cursor-pointer gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Business
          </TabsTrigger>
          <TabsTrigger value="activity" className="cursor-pointer gap-1.5">
            <Users className="h-3.5 w-3.5" /> User Activity
          </TabsTrigger>
          <TabsTrigger value="trace" className="cursor-pointer gap-1.5">
            <Search className="h-3.5 w-3.5" /> Request Trace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health"><HealthTab /></TabsContent>
        <TabsContent value="api"><ApiAnalyticsTab /></TabsContent>
        <TabsContent value="business"><BusinessTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="trace"><TraceTab /></TabsContent>
      </Tabs>
    </div>
  );
}
