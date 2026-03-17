/**
 * Table Demo Page - So sánh 3 style table cho E-commerce
 */

import { useState } from 'react';
import { Calendar, Clock, CheckCircle2, AlertCircle, Trash2, MoreHorizontal, ChevronDown } from 'lucide-react';

// Mock data
const mockData = [
  {
    id: 1,
    timeSlot: '17:00 17/03/2026 - 19:00',
    status: 'scheduled',
    note: 'Chờ đến 16:50 17/03/2026',
    leadTime: 'Ngay lập tức',
    scheduledAt: '15:20 17/03/2026',
    runAt: null,
  },
  {
    id: 2,
    timeSlot: '20:00 17/03/2026 - 22:00',
    status: 'completed',
    note: 'Đã hoàn thành',
    leadTime: '10 phút',
    scheduledAt: '14:00 17/03/2026',
    runAt: '19:50 17/03/2026',
  },
  {
    id: 3,
    timeSlot: '09:00 18/03/2026 - 11:00',
    status: 'failed',
    note: 'Lỗi: Token hết hạn',
    leadTime: '30 phút',
    scheduledAt: '16:00 17/03/2026',
    runAt: null,
  },
];

const statusConfig = {
  scheduled: { label: 'Đã lên lịch', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed: { label: 'Thất bại', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function TableDemoPage() {
  const [activeTab, setActiveTab] = useState<'card' | 'clean' | 'hybrid'>('card');

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Table Style Demo</h1>
        <p className="text-muted-foreground mt-1">So sánh 3 style table cho E-commerce</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        {[
          { id: 'card', label: 'Card Rows' },
          { id: 'clean', label: 'Clean Table' },
          { id: 'hybrid', label: 'Hybrid' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Option 1: Card-based Rows */}
      {activeTab === 'card' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Option 1: Card-based Rows</h2>
          <p className="text-sm text-muted-foreground">Mỗi row là 1 card độc lập, mobile-friendly</p>

          <div className="space-y-3">
            {mockData.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Main Info */}
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-foreground">{item.timeSlot}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.note}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[item.status as keyof typeof statusConfig].color}`}>
                      {statusConfig[item.status as keyof typeof statusConfig].label}
                    </span>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Cài trước</p>
                      <p className="font-medium text-foreground">{item.leadTime}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Đặt lịch lúc</p>
                      <p className="font-medium text-foreground">{item.scheduledAt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Đã chạy lúc</p>
                      <p className="font-medium text-foreground">{item.runAt || '—'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option 2: Clean Modern Table */}
      {activeTab === 'clean' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Option 2: Clean Modern Table</h2>
          <p className="text-sm text-muted-foreground">Table truyền thống với style modern, compact</p>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Khung giờ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trạng thái</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ghi chú</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cài trước</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đặt lịch lúc</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đã chạy lúc</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockData.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground text-sm">{item.timeSlot}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${statusConfig[item.status as keyof typeof statusConfig].color}`}>
                        {statusConfig[item.status as keyof typeof statusConfig].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{item.note}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{item.leadTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{item.scheduledAt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{item.runAt || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Option 3: Hybrid */}
      {activeTab === 'hybrid' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Option 3: Hybrid</h2>
          <p className="text-sm text-muted-foreground">Kết hợp ưu điểm của cả 2: Header sticky, row spacious</p>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Sticky Header */}
            <div className="bg-gradient-to-r from-primary/5 to-transparent border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">Khung giờ</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[100px]">Trạng thái</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Ghi chú</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Cài trước</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[130px]">Đặt lịch</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[130px]">Đã chạy</span>
                <span className="w-8"></span>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/50">
              {mockData.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-6">
                    {/* Time Slot */}
                    <div className="min-w-[180px] flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground text-sm">{item.timeSlot}</span>
                    </div>

                    {/* Status */}
                    <div className="min-w-[100px]">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusConfig[item.status as keyof typeof statusConfig].color}`}>
                        {item.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                        {statusConfig[item.status as keyof typeof statusConfig].label}
                      </span>
                    </div>

                    {/* Note */}
                    <p className="flex-1 text-sm text-muted-foreground truncate max-w-[200px]">{item.note}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-sm text-foreground w-[100px]">{item.leadTime}</span>
                    <span className="text-sm text-foreground w-[130px]">{item.scheduledAt}</span>
                    <span className="text-sm text-foreground w-[130px]">{item.runAt || '—'}</span>

                    {/* Actions Dropdown */}
                    <div className="relative">
                      <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Summary */}
      <div className="bg-muted/30 rounded-xl p-6 border border-border">
        <h3 className="font-semibold text-foreground mb-4">So sánh nhanh</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium text-primary">Card Rows</p>
            <ul className="text-muted-foreground space-y-1">
              <li>✓ Mobile-friendly nhất</li>
              <li>✓ Dễ scan thông tin</li>
              <li>✗ Tốn vertical space</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-primary">Clean Table</p>
            <ul className="text-muted-foreground space-y-1">
              <li>✓ Compact, data-dense</li>
              <li>✓ Familiar pattern</li>
              <li>✗ Less visual hierarchy</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-primary">Hybrid</p>
            <ul className="text-muted-foreground space-y-1">
              <li>✓ Best of both worlds</li>
              <li>✓ Good visual hierarchy</li>
              <li>✓ Professional look</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
