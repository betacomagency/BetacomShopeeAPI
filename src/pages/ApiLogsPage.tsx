/**
 * API Logs Page - Giám sát API Shopee (Admin Only)
 * 3 tabs: Dashboard | API Registry | Call Logs
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, BarChart3, BookOpen, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiDashboardPanel } from '@/components/panels/ApiDashboardPanel';
import { ApiRegistryPanel } from '@/components/panels/ApiRegistryPanel';
import { ApiCallLogsPanel } from '@/components/panels/ApiCallLogsPanel';

type TabKey = 'dashboard' | 'registry' | 'logs';

const tabs: Array<{ key: TabKey; label: string; icon: typeof Monitor }> = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'registry', label: 'API Registry', icon: BookOpen },
  { key: 'logs', label: 'Call Logs', icon: ScrollText },
];

export default function ApiLogsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Tab navigation */}
        <div className="flex-shrink-0 border-b bg-white">
          <div className="flex items-center gap-1 px-4">
            <Monitor className="w-5 h-5 text-slate-500 mr-2 flex-shrink-0" />
            <div className="flex flex-wrap">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
                      activeTab === tab.key
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && <ApiDashboardPanel />}
          {activeTab === 'registry' && <ApiRegistryPanel />}
          {activeTab === 'logs' && <ApiCallLogsPanel />}
        </div>
      </CardContent>
    </Card>
  );
}
