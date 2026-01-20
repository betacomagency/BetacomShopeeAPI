/**
 * AdsSchedulesPage - Trang quản lý lịch tự động quảng cáo
 */

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Clock, Trash2, Search, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useShopeeAuth } from '@/contexts/ShopeeAuthContext';
import { deleteBudgetSchedule, toggleSchedulePause, type ScheduledAdsBudget } from '@/lib/shopee/ads';
import { cn } from '@/lib/utils';

export default function AdsSchedulesPage() {
  const { toast } = useToast();
  const { token } = useShopeeAuth();
  const shopId = token?.shop_id;

  const [schedules, setSchedules] = useState<ScheduledAdsBudget[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);

  // Filtered data
  const filteredSchedules = useMemo(() => {
    if (!scheduleFilter.trim()) return schedules;
    const search = scheduleFilter.toLowerCase();
    return schedules.filter(s =>
      s.campaign_name?.toLowerCase().includes(search) ||
      s.campaign_id.toString().includes(search)
    );
  }, [schedules, scheduleFilter]);

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  const formatTimeSlot = (hourStart: number, minuteStart?: number) => {
    const hour = hourStart.toString().padStart(2, '0');
    const minute = (minuteStart || 0).toString().padStart(2, '0');
    return `${hour}:${minute}`;
  };

  useEffect(() => {
    if (shopId) {
      loadData();
    }
  }, [shopId]);

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apishopee_scheduled_ads_budget')
        .select('*')
        .eq('shop_id', shopId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules((data || []) as ScheduledAdsBudget[]);
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (schedule: ScheduledAdsBudget) => {
    if (!shopId) return;
    setTogglingScheduleId(schedule.id);
    try {
      const result = await toggleSchedulePause(shopId, schedule.id, schedule.is_active);
      if (!result.success) throw new Error(result.error);
      toast({
        title: schedule.is_active ? 'Đã tạm dừng lịch' : 'Đã bật lại lịch',
        description: schedule.campaign_name || `Campaign ${schedule.campaign_id}`
      });
      loadData();
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTogglingScheduleId(null);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId || !shopId) return;
    setIsDeleting(true);
    try {
      const result = await deleteBudgetSchedule(shopId, deleteScheduleId);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Đã xóa lịch' });
      loadData();
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteScheduleId(null);
    }
  };

  if (!shopId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Vui lòng chọn shop để xem lịch tự động</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col p-2 md:p-0">
      <Card className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-3 md:px-4 py-2 md:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-sm md:text-base text-gray-700">Lịch tự động ({filteredSchedules.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="ID/Tên chiến dịch"
                value={scheduleFilter}
                onChange={(e) => setScheduleFilter(e.target.value)}
                className="h-7 w-full md:w-40 pl-7 text-xs"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        <CardContent className="p-2 md:p-4 flex-1 min-h-0 overflow-auto">
          {filteredSchedules.length === 0 ? (
            <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
              <Clock className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 md:mb-3 text-gray-300" />
              <p className="text-sm md:text-base text-gray-500 font-medium">{scheduleFilter ? 'Không tìm thấy kết quả' : 'Chưa có lịch tự động nào'}</p>
              <p className="text-xs md:text-sm text-gray-400 mt-1">{scheduleFilter ? 'Thử tìm kiếm với từ khóa khác' : 'Vào trang Quản lý quảng cáo để tạo lịch mới'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              {/* Desktop Header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_70px] gap-2 px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                <div>Chiến dịch</div>
                <div className="text-center">Khung giờ</div>
                <div className="text-center">Ngày</div>
                <div className="text-right">Ngân sách</div>
                <div className="text-center">Hành động</div>
              </div>
              {/* Mobile Header */}
              <div className="md:hidden grid grid-cols-[1fr_50px_55px_50px] gap-1 px-2 py-1.5 bg-gray-50 border-b text-[10px] font-medium text-gray-500 uppercase">
                <div>Chiến dịch</div>
                <div className="text-center">Giờ</div>
                <div className="text-right">Budget</div>
                <div className="text-center">TT</div>
              </div>
              <div className="divide-y">
                {filteredSchedules.map(s => {
                  const isPaused = !s.is_active;
                  const isToggling = togglingScheduleId === s.id;

                  return (
                    <div key={s.id}>
                      {/* Desktop Row */}
                      <div
                        className={cn(
                          "hidden md:grid grid-cols-[1fr_80px_80px_80px_70px] gap-2 px-3 py-2 items-center hover:bg-gray-50",
                          isPaused && "bg-gray-50 opacity-60"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("text-sm font-medium truncate", isPaused && "text-gray-500")}>
                              {s.campaign_name || 'Campaign ' + s.campaign_id}
                            </p>
                            {isPaused && (
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium flex-shrink-0">
                                Đã dừng
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">ID: {s.campaign_id}</p>
                        </div>
                        <div className={cn("text-sm text-center font-medium", isPaused ? "text-gray-400" : "text-blue-600")}>
                          {formatTimeSlot(s.hour_start, s.minute_start)}
                        </div>
                        <div className="text-xs text-center text-gray-600">
                          {s.days_of_week && s.days_of_week.length === 7
                            ? <span className={cn("px-1.5 py-0.5 rounded text-[10px]", isPaused ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>Hàng ngày</span>
                            : s.specific_dates && s.specific_dates.length > 0
                            ? <span className={cn("px-1.5 py-0.5 rounded text-[10px]", isPaused ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700")} title={s.specific_dates.join(', ')}>
                                {s.specific_dates.length} ngày
                              </span>
                            : '-'}
                        </div>
                        <div className={cn("text-sm text-right font-medium", isPaused ? "text-gray-400" : "text-orange-600")}>
                          {formatPrice(s.budget)}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6",
                              isPaused
                                ? "text-green-500 hover:text-green-600 hover:bg-green-50"
                                : "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
                            )}
                            onClick={() => handleTogglePause(s)}
                            disabled={isToggling}
                            title={isPaused ? "Bật lại lịch" : "Tạm dừng lịch"}
                          >
                            {isToggling ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isPaused ? (
                              <Play className="h-3.5 w-3.5" />
                            ) : (
                              <Pause className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteScheduleId(s.id)}
                            title="Xóa lịch"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Mobile Row (Table format) */}
                      <div
                        className={cn(
                          "md:hidden grid grid-cols-[1fr_50px_55px_50px] gap-1 px-2 py-2 items-start hover:bg-gray-50",
                          isPaused && "bg-gray-50 opacity-60"
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn("text-[11px] font-medium leading-tight", isPaused && "text-gray-500")}>
                            {s.campaign_name || 'Campaign ' + s.campaign_id}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">ID: {s.campaign_id}</p>
                        </div>
                        <div className={cn("text-[11px] text-center font-medium", isPaused ? "text-gray-400" : "text-blue-600")}>
                          {formatTimeSlot(s.hour_start, s.minute_start)}
                        </div>
                        <div className={cn("text-[10px] text-right font-medium", isPaused ? "text-gray-400" : "text-orange-600")}>
                          {formatPrice(s.budget)}
                        </div>
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-5 w-5",
                              isPaused
                                ? "text-green-500 hover:text-green-600 hover:bg-green-50"
                                : "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
                            )}
                            onClick={() => handleTogglePause(s)}
                            disabled={isToggling}
                          >
                            {isToggling ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isPaused ? (
                              <Play className="h-3 w-3" />
                            ) : (
                              <Pause className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteScheduleId(s.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteScheduleId} onOpenChange={() => setDeleteScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa lịch tự động</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Bạn có chắc chắn muốn xóa lịch tự động này không?</p>
                {deleteScheduleId && (() => {
                  const schedule = schedules.find(s => s.id === deleteScheduleId);
                  if (!schedule) return null;
                  return (
                    <div className="bg-gray-50 rounded-lg p-3 border text-sm">
                      <div className="font-medium text-gray-900 mb-2">
                        {schedule.campaign_name || `Campaign ${schedule.campaign_id}`}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <div>
                          <span className="text-gray-400">Khung giờ:</span>{' '}
                          <span className="font-medium text-blue-600">{formatTimeSlot(schedule.hour_start, schedule.minute_start)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Ngân sách:</span>{' '}
                          <span className="font-medium text-orange-600">{formatPrice(schedule.budget)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-400">Ngày áp dụng:</span>{' '}
                          <span className="font-medium text-green-600">
                            {schedule.days_of_week && schedule.days_of_week.length === 7
                              ? 'Hàng ngày'
                              : schedule.days_of_week && schedule.days_of_week.length > 0
                              ? schedule.days_of_week.map(d => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ')
                              : schedule.specific_dates && schedule.specific_dates.length > 0
                              ? schedule.specific_dates.map(d => {
                                  const [, month, day] = d.split('-');
                                  return `${day}/${month}`;
                                }).join(', ')
                              : 'Không xác định'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-red-600 text-sm font-medium">
                  Hành động này không thể hoàn tác.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa lịch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
