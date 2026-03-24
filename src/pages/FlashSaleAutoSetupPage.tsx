/**
 * Flash Sale Auto Setup Page - Tự động cài đặt Flash Sale
 * Tự động tạo Flash Sale cho nhiều time slots cùng lúc
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Clock,
  Calendar as CalendarIcon,
  ChevronDown,
  Package,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useSyncData } from '@/hooks/useSyncData';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Interfaces
interface TimeSlot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
  selected?: boolean;
}

interface FlashSaleItem {
  item_id: number;
  item_name?: string;
  image?: string;
  status: number;
  purchase_limit: number;
  campaign_stock?: number;
  // Cho sản phẩm không có biến thể - giá nằm trực tiếp trong item
  input_promotion_price?: number;
  promotion_price_with_tax?: number;
  stock?: number;
  models?: FlashSaleModel[];
}

interface FlashSaleModel {
  model_id: number;
  model_name?: string;
  item_id: number;
  original_price: number;
  input_promotion_price: number;
  stock: number;
  campaign_stock: number;
  status?: number;
}

interface ProcessLog {
  timeslot_id: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  message: string;
  flash_sale_id?: number;
}

interface AutoHistoryRecord {
  id: string;
  shop_id: number;
  user_id: string;
  timeslot_id: number;
  flash_sale_id: number | null;
  status: 'pending' | 'scheduled' | 'processing' | 'success' | 'error';
  lead_time_minutes: number;
  scheduled_at: string | null;
  executed_at: string | null;
  slot_start_time: number;
  slot_end_time: number;
  items_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Đang chờ', color: 'bg-muted text-muted-foreground border-border', icon: <Clock className="h-3 w-3" /> },
  scheduled: { label: 'Đã lên lịch', color: 'bg-info/10 text-info border-info', icon: <CalendarIcon className="h-3 w-3" /> },
  processing: { label: 'Đang xử lý', color: 'bg-warning/10 text-warning border-warning', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  success: { label: 'Thành công', color: 'bg-success/10 text-success border-success', icon: <CheckCircle className="h-3 w-3" /> },
  error: { label: 'Lỗi', color: 'bg-destructive/10 text-destructive border-destructive', icon: <XCircle className="h-3 w-3" /> },
};

const HISTORY_PAGE_SIZE = 20;

// Format helpers
function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FlashSaleAutoSetupPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { shops, selectedShopId, isLoading: shopsLoading } = useShopeeAuth();
  const isRunningRef = useRef(false);

  // Sync flash sale data after successful creation
  const { triggerSync } = useSyncData({
    shopId: selectedShopId || 0,
    userId: user?.id || '',
    autoSyncOnMount: false,
  });

  // Time slots state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [_usedTimeslotIds, setUsedTimeslotIds] = useState<Set<number>>(new Set()); // Timeslots đã có FS

  // Latest flash sale items (template)
  const [templateItems, setTemplateItems] = useState<FlashSaleItem[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [latestFlashSaleId, setLatestFlashSaleId] = useState<number | null>(null);

  // Auto setup state
  const [isRunning, setIsRunning] = useState(false);
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [isImmediateSetup, setIsImmediateSetup] = useState(true); // Track if current run is immediate

  // Dialog state
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number>(0);
  const [isCustomLeadTime, setIsCustomLeadTime] = useState(false);
  const [_customLeadTimeInput, setCustomLeadTimeInput] = useState<string>('');

  // History state
  const [history, setHistory] = useState<AutoHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [historyPage, setHistoryPage] = useState(1);

  const historyTotalPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return history.slice(start, start + HISTORY_PAGE_SIZE);
  }, [history, historyPage]);

  // Confirm dialog state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Multi-select state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isAllPageSelected = pagedHistory.length > 0 && pagedHistory.every(r => selectedRecords.has(r.id));
  const isSomeSelected = selectedRecords.size > 0;

  const toggleRecordSelection = (id: string) => {
    setSelectedRecords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedRecords(prev => {
        const next = new Set(prev);
        pagedHistory.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRecords(prev => {
        const next = new Set(prev);
        pagedHistory.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const bulkDeleteSelected = async () => {
    setShowBulkDeleteConfirm(false);
    setBulkDeleting(true);
    try {
      const idsToDelete = [...selectedRecords];
      const recordsToDelete = history.filter(h => idsToDelete.includes(h.id));

      // Delete flash sales on Shopee for records that have flash_sale_id
      const uniqueFlashSaleIds = [
        ...new Set(recordsToDelete.map(h => Number(h.flash_sale_id)).filter(id => id > 0)),
      ];

      for (const flashSaleId of uniqueFlashSaleIds) {
        try {
          const { data } = await supabase.functions.invoke('apishopee-flash-sale', {
            body: { action: 'delete-flash-sale', shop_id: selectedShopId, flash_sale_id: flashSaleId },
          });
          if (data?.error && !isFlashSaleNotExistError(data.error)) {
            console.error(`Failed to delete flash sale ${flashSaleId}:`, data.error);
          }
        } catch (err) {
          console.error(`Failed to delete flash sale ${flashSaleId}:`, err);
        }
        if (uniqueFlashSaleIds.length > 1) await new Promise(r => setTimeout(r, 300));
      }

      // Delete records from database
      const { error } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;

      setHistory(prev => prev.filter(h => !idsToDelete.includes(h.id)));
      setSelectedRecords(new Set());
      toast({
        title: 'Đã xóa',
        description: `Đã xóa ${idsToDelete.length} bản ghi${uniqueFlashSaleIds.length > 0 ? ` và ${uniqueFlashSaleIds.length} Flash Sale trên Shopee` : ''}`,
      });
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const location = useLocation();

  // Get copyFromFlashSaleId directly from location state
  const copyFromFlashSaleId = location.state?.copyFromFlashSaleId as number | null;

  useEffect(() => {
    if (location.state?.openSetupDialog) {
      setShowSetupDialog(true);
      // Clear openSetupDialog from state but keep copyFromFlashSaleId
      // This prevents dialog from reopening on re-render while keeping the flash sale reference
      window.history.replaceState(
        { copyFromFlashSaleId: location.state?.copyFromFlashSaleId }, 
        document.title
      );
    }
  }, [location.state]);

  // Fetch time slots
  const fetchTimeSlots = async () => {
    if (!selectedShopId) return;
    setLoadingSlots(true);
    try {
      // Fetch time slots từ Shopee
      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-time-slots', shop_id: selectedShopId },
      });
      if (error) throw error;

      if (data?.error === 'shop_flash_sale_param_error') {
        setTimeSlots([]);
        setUsedTimeslotIds(new Set());
        setLoadingSlots(false);
        return;
      }
      if (data?.error) throw new Error(data.error);

      let slots: TimeSlot[] = [];
      if (data?.response?.time_slot_list) slots = data.response.time_slot_list;
      else if (Array.isArray(data?.response)) slots = data.response;

      // Fetch song song: Flash Sale đã tồn tại + slot đã lên lịch tự động
      const [{ data: existingFS }, { data: scheduledSlots }] = await Promise.all([
        supabase
          .from('apishopee_flash_sale_data')
          .select('timeslot_id')
          .eq('shop_id', selectedShopId)
          .in('type', [1, 2]), // Chỉ lấy FS sắp tới và đang chạy
        supabase
          .from('apishopee_flash_sale_auto_history')
          .select('timeslot_id')
          .eq('shop_id', selectedShopId)
          .in('status', ['pending', 'scheduled']),
      ]);

      const usedIds = new Set<number>([
        ...(existingFS || []).map((fs: { timeslot_id: number }) => fs.timeslot_id).filter(Boolean),
        ...(scheduledSlots || []).map((s: { timeslot_id: number }) => s.timeslot_id).filter(Boolean),
      ]);
      setUsedTimeslotIds(usedIds);

      // Lọc bỏ các slot đã có Flash Sale hoặc đã được lên lịch
      const availableSlots = (Array.isArray(slots) ? slots : []).filter(
        slot => !usedIds.has(slot.timeslot_id)
      );

      setTimeSlots(availableSlots);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch latest flash sale as template (or specific flash sale if copyFromFlashSaleId is set)
  const fetchLatestTemplate = async (specificFlashSaleId?: number) => {
    if (!selectedShopId) return;
    setLoadingTemplate(true);
    try {
      let flashSaleId = specificFlashSaleId || copyFromFlashSaleId;
      
      // If no specific flash sale ID, get the latest one
      if (!flashSaleId) {
        // Ưu tiên lấy FS đang chạy hoặc sắp tới
        let { data: fsData, error: fsError } = await supabase
          .from('apishopee_flash_sale_data')
          .select('*')
          .eq('shop_id', selectedShopId)
          .in('type', [1, 2]) // Sắp tới hoặc đang chạy
          .order('start_time', { ascending: false })
          .limit(1)
          .single();

        if (fsError && fsError.code !== 'PGRST116') throw fsError;

        // Nếu không có FS đang chạy/sắp tới, lấy FS mới nhất bất kỳ (bao gồm đã kết thúc)
        if (!fsData) {
          const { data: latestFs, error: latestError } = await supabase
            .from('apishopee_flash_sale_data')
            .select('*')
            .eq('shop_id', selectedShopId)
            .order('start_time', { ascending: false })
            .limit(1)
            .single();

          if (latestError && latestError.code !== 'PGRST116') throw latestError;
          fsData = latestFs;
        }

        if (!fsData) {
          setTemplateItems([]);
          setLatestFlashSaleId(null);
          setLoadingTemplate(false);
          return;
        }

        flashSaleId = fsData.flash_sale_id;
      }

      setLatestFlashSaleId(flashSaleId);

      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-items', shop_id: selectedShopId, flash_sale_id: flashSaleId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const itemInfoList = data?.response?.item_info || [];
      const modelsList = data?.response?.models || [];

      const itemsWithModels = itemInfoList.map((item: FlashSaleItem) => {
        const itemModels = modelsList.filter((m: FlashSaleModel) => m.item_id === item.item_id);
        return { ...item, models: itemModels.length > 0 ? itemModels : undefined };
      });

      const enabledItems = itemsWithModels.filter((item: FlashSaleItem) => item.status === 1);
      setTemplateItems(enabledItems);
    } catch (err) {
      console.error('Fetch template error:', err);
      setTemplateItems([]);
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Fetch history
  const fetchHistory = async () => {
    if (!selectedShopId) return;
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('apishopee_flash_sale_auto_history')
        .select('*')
        .eq('shop_id', selectedShopId)
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (dateFilter) {
        const startOfDay = Math.floor(new Date(dateFilter).setHours(0, 0, 0, 0) / 1000);
        const endOfDay = Math.floor(new Date(dateFilter).setHours(23, 59, 59, 999) / 1000);
        query = query.gte('slot_start_time', startOfDay).lte('slot_start_time', endOfDay);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Sort: scheduled/pending (by slot_start_time asc) first, then others (by created_at desc)
      const sorted = (data || []).sort((a, b) => {
        const isPendingA = a.status === 'scheduled' || a.status === 'pending';
        const isPendingB = b.status === 'scheduled' || b.status === 'pending';

        // Pending/scheduled items come first
        if (isPendingA && !isPendingB) return -1;
        if (!isPendingA && isPendingB) return 1;

        // Both pending: sort by slot_start_time ascending (soonest first)
        if (isPendingA && isPendingB) {
          return a.slot_start_time - b.slot_start_time;
        }

        // Both not pending: sort by created_at descending (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setHistory(sorted);
      setHistoryPage(1);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const isFlashSaleNotExistError = (error: string) =>
    error.includes('not_exist') || error.includes('not_found') || error.includes('not found');

  // Delete history record (xóa cả flash sale trên Shopee nếu có)
  const deleteRecord = async (id: string) => {
    const record = history.find(h => h.id === id);
    if (!record) return;

    try {
      // Nếu có flash_sale_id hợp lệ, xóa flash sale trên Shopee trước
      if (record.flash_sale_id && Number(record.flash_sale_id) > 0) {
        const { data, error: deleteError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'delete-flash-sale',
            shop_id: selectedShopId,
            flash_sale_id: record.flash_sale_id,
          },
        });

        if (deleteError) {
          console.error('Delete flash sale error:', deleteError);
        } else if (data?.error && !isFlashSaleNotExistError(data.error)) {
          console.error('Delete flash sale API error:', data.error);
        }
      }

      // Xóa bản ghi trong database
      const { error } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .delete()
        .eq('id', id);
      if (error) throw error;

      setHistory(prev => prev.filter(h => h.id !== id));
      toast({
        title: 'Đã xóa',
        description: record.flash_sale_id
          ? `Đã xóa Flash Sale #${record.flash_sale_id} và bản ghi lịch sử`
          : 'Đã xóa bản ghi lịch sử'
      });
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Clear all history (xóa cả flash sale trên Shopee)
  const clearAllHistory = async () => {
    setShowClearAllConfirm(false);
    try {
      // Deduplicate: chỉ gọi delete 1 lần cho mỗi flash_sale_id duy nhất
      const uniqueFlashSaleIds = [
        ...new Set(
          history
            .map(h => Number(h.flash_sale_id))
            .filter(id => id > 0)
        ),
      ];
      let deletedCount = 0;

      for (const flashSaleId of uniqueFlashSaleIds) {
        try {
          const { data } = await supabase.functions.invoke('apishopee-flash-sale', {
            body: {
              action: 'delete-flash-sale',
              shop_id: selectedShopId,
              flash_sale_id: flashSaleId,
            },
          });
          if (!data?.error || isFlashSaleNotExistError(data.error)) {
            deletedCount++;
          } else {
            console.error(`Failed to delete flash sale ${flashSaleId}:`, data.error);
          }
        } catch (err) {
          console.error(`Failed to delete flash sale ${flashSaleId}:`, err);
        }
        // Delay 300ms giữa các lần gọi để tránh rate limit
        if (uniqueFlashSaleIds.length > 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Xóa tất cả bản ghi trong database theo shop_id
      const { error } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .delete()
        .eq('shop_id', selectedShopId);
      if (error) throw error;

      setHistory([]);
      toast({
        title: 'Đã xóa',
        description: `Đã xóa ${deletedCount} Flash Sale trên Shopee và toàn bộ lịch sử`
      });
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (selectedShopId) {
      fetchTimeSlots();
      // If copying from a specific flash sale, fetch that one; otherwise fetch latest
      fetchLatestTemplate(copyFromFlashSaleId || undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, copyFromFlashSaleId]);

  useEffect(() => {
    if (selectedShopId) {
      setSelectedRecords(new Set());
      fetchHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, statusFilter, dateFilter]);

  // Realtime subscription: auto-refresh khi scheduler hoàn thành jobs
  useEffect(() => {
    if (!selectedShopId) return;

    const channel = supabase
      .channel(`auto_history_${selectedShopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'apishopee_flash_sale_auto_history',
          filter: `shop_id=eq.${selectedShopId}`,
        },
        (payload) => {
          const newStatus = (payload.new as AutoHistoryRecord).status;
          const oldStatus = (payload.old as { status?: string }).status;

          // Khi scheduler chuyển status sang success/error → refresh history + sync
          if (oldStatus !== newStatus && (newStatus === 'success' || newStatus === 'error')) {
            fetchHistory();
            if (newStatus === 'success') {
              triggerSync(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, triggerSync]);

  // Group time slots by date
  const groupedSlots = useMemo((): Record<string, TimeSlot[]> => {
    const groups: Record<string, TimeSlot[]> = {};
    timeSlots.forEach((slot: TimeSlot) => {
      const dateKey = formatDate(slot.start_time);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    });
    return groups;
  }, [timeSlots]);

  // Toggle slot selection
  const toggleSlot = (timeslotId: number) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(timeslotId)) newSelected.delete(timeslotId);
    else newSelected.add(timeslotId);
    setSelectedSlots(newSelected);
  };

  // Select all slots
  const toggleAllSlots = () => {
    if (selectedSlots.size === timeSlots.length) {
      setSelectedSlots(new Set());
    } else {
      setSelectedSlots(new Set(timeSlots.map(s => s.timeslot_id)));
    }
  };

  // Toggle all slots in a specific date
  const toggleDateSlots = (dateKey: string) => {
    const slotsInDate = groupedSlots[dateKey] || [];
    const slotIds = slotsInDate.map(s => s.timeslot_id);
    const allSelected = slotIds.every(id => selectedSlots.has(id));
    
    const newSelected = new Set(selectedSlots);
    if (allSelected) {
      // Bỏ chọn tất cả slot trong ngày
      slotIds.forEach(id => newSelected.delete(id));
    } else {
      // Chọn tất cả slot trong ngày
      slotIds.forEach(id => newSelected.add(id));
    }
    setSelectedSlots(newSelected);
  };

  // Open setup dialog - always available
  const _handleStartClick = () => {
    setShowSetupDialog(true);
  };

  // Run auto setup with scheduling
  const runAutoSetup = async () => {
    if (selectedSlots.size === 0) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn ít nhất 1 khung giờ', variant: 'destructive' });
      return;
    }
    if (templateItems.length === 0) {
      toast({ title: 'Thiếu thông tin', description: 'Không có sản phẩm mẫu để sao chép', variant: 'destructive' });
      return;
    }

    setShowSetupDialog(false);
    setIsRunning(true);
    isRunningRef.current = true;
    setProgress(0);
    setIsImmediateSetup(leadTimeMinutes === 0);

    const slotsToProcess = timeSlots.filter(s => selectedSlots.has(s.timeslot_id));
    const logs: ProcessLog[] = slotsToProcess.map(s => ({
      timeslot_id: s.timeslot_id,
      status: 'pending',
      message: 'Đang chờ...',
    }));
    setProcessLogs(logs);

    // Prepare items to add
    const itemsToAdd = templateItems.map(item => {
      const enabledModels = item.models?.filter(m => m.status === 1) || [];

      // Trường hợp 1: Sản phẩm không có biến thể với model_id = 0
      const isNonVariantWithModel = enabledModels.length === 1 && enabledModels[0].model_id === 0;

      if (isNonVariantWithModel) {
        const model = enabledModels[0];
        if (!model.input_promotion_price || model.input_promotion_price <= 0) {
          return null;
        }
        return {
          item_id: item.item_id,
          purchase_limit: item.purchase_limit || 0,
          item_input_promo_price: model.input_promotion_price,
          item_stock: model.campaign_stock || 0,
        };
      }

      // Trường hợp 2: Sản phẩm không có biến thể - không có models, giá nằm trong item
      if (enabledModels.length === 0 && item.input_promotion_price && item.input_promotion_price > 0) {
        return {
          item_id: item.item_id,
          purchase_limit: item.purchase_limit || 0,
          item_input_promo_price: item.input_promotion_price,
          item_stock: item.campaign_stock || 0,
        };
      }

      // Trường hợp 3: Không có model nào enabled và không có giá item
      if (enabledModels.length === 0) {
        return null;
      }

      // Trường hợp 4: Sản phẩm có biến thể - gửi với models array
      return {
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        models: enabledModels.map(m => ({
          model_id: m.model_id,
          input_promo_price: m.input_promotion_price || 0,
          stock: m.campaign_stock || 0,
        })),
      };
    }).filter(item => {
      // Loại bỏ item null hoặc không hợp lệ
      if (!item) return false;
      // Kiểm tra sản phẩm có biến thể
      if ('models' in item && item.models) {
        return item.models.length > 0 && item.models.every(m => m.input_promo_price > 0);
      }
      // Kiểm tra sản phẩm không có biến thể
      if ('item_input_promo_price' in item) {
        return item.item_input_promo_price > 0;
      }
      return false;
    });

    // Nếu có lead time (scheduled), chỉ insert vào history và kết thúc
    if (leadTimeMinutes > 0) {
      let insertedCount = 0;
      for (const slot of slotsToProcess) {
        const historyRecord = {
          shop_id: selectedShopId,
          user_id: user?.id,
          timeslot_id: slot.timeslot_id,
          status: 'scheduled',
          lead_time_minutes: leadTimeMinutes,
          scheduled_at: new Date((slot.start_time - leadTimeMinutes * 60) * 1000).toISOString(),
          slot_start_time: slot.start_time,
          slot_end_time: slot.end_time,
          items_count: itemsToAdd.length,
        };

        const { error } = await supabase
          .from('apishopee_flash_sale_auto_history')
          .insert(historyRecord);

        if (!error) insertedCount++;
      }

      setIsRunning(false);
      isRunningRef.current = false;
      setProcessLogs([]);
      setSelectedSlots(new Set());
      fetchHistory();
      fetchTimeSlots();
      toast({
        title: 'Đã lên lịch',
        description: `Đã lên lịch ${insertedCount} Flash Sale. Theo dõi trong bảng lịch sử bên dưới.`,
      });
      return;
    }

    // Immediate setup (leadTimeMinutes === 0)
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < slotsToProcess.length; i++) {
      if (!isRunningRef.current) break;

      const slot = slotsToProcess[i];

      const historyRecord = {
        shop_id: selectedShopId,
        user_id: user?.id,
        timeslot_id: slot.timeslot_id,
        status: 'pending',
        lead_time_minutes: 0,
        scheduled_at: null,
        slot_start_time: slot.start_time,
        slot_end_time: slot.end_time,
        items_count: itemsToAdd.length,
      };

      const { data: historyData } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .insert(historyRecord)
        .select()
        .single();

      const historyId = historyData?.id;

      setProcessLogs(prev => prev.map(log =>
        log.timeslot_id === slot.timeslot_id
          ? { ...log, status: 'processing', message: 'Đang tạo Flash Sale...' }
          : log
      ));

      if (historyId) {
        await supabase
          .from('apishopee_flash_sale_auto_history')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', historyId);
      }

      try {
        const { data: createData, error: createError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'create-flash-sale',
            shop_id: selectedShopId,
            timeslot_id: slot.timeslot_id,
          },
        });

        if (createError) throw createError;
        if (createData?.error) throw new Error(createData.message || createData.error);

        const flashSaleId = createData?.response?.flash_sale_id;
        if (!flashSaleId) throw new Error('Không nhận được flash_sale_id');

        const { data: addData, error: addError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'add-items',
            shop_id: selectedShopId,
            flash_sale_id: flashSaleId,
            items: itemsToAdd,
          },
        });

        if (addError) throw addError;

        let message = `Đã tạo FS #${flashSaleId}`;
        if (addData?.error) {
          message += ` (Lỗi thêm SP: ${addData.message || addData.error})`;
        } else {
          message += ` với ${itemsToAdd.length} SP`;
        }

        setProcessLogs(prev => prev.map(log =>
          log.timeslot_id === slot.timeslot_id
            ? { ...log, status: 'success', message, flash_sale_id: flashSaleId }
            : log
        ));

        if (historyId) {
          await supabase
            .from('apishopee_flash_sale_auto_history')
            .update({
              status: 'success',
              flash_sale_id: flashSaleId,
              executed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', historyId);
        }

        successCount++;

      } catch (err) {
        const errorMessage = (err as Error).message;
        setProcessLogs(prev => prev.map(log =>
          log.timeslot_id === slot.timeslot_id
            ? { ...log, status: 'error', message: errorMessage }
            : log
        ));

        if (historyId) {
          await supabase
            .from('apishopee_flash_sale_auto_history')
            .update({
              status: 'error',
              error_message: errorMessage,
              executed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', historyId);
        }

        errorCount++;
      }

      setProgress(Math.round(((i + 1) / slotsToProcess.length) * 100));

      // Delay giữa các slots
      if (i < slotsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    fetchHistory(); // Refresh history after completion
    fetchTimeSlots(); // Refresh time slots để loại bỏ các slot vừa tạo FS

    // Sync flash sale data từ Shopee để cập nhật trang Danh sách
    if (successCount > 0) {
      await triggerSync(true);
    }

    toast({
      title: 'Hoàn tất',
      description: `Thành công: ${successCount}, Lỗi: ${errorCount}`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });
  };

  // Stop auto setup
  const _stopAutoSetup = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    toast({ title: 'Đã dừng', description: 'Quá trình tự động cài đặt đã bị dừng' });
  };

  // Stats
  const stats = {
    total: history.length,
    success: history.filter(h => h.status === 'success').length,
    error: history.filter(h => h.status === 'error').length,
    pending: history.filter(h => h.status === 'pending' || h.status === 'scheduled').length,
  };

  // Loading state
  if (shopsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // No shops
  if (shops.length === 0) {
    return (
      <div className="px-6 py-6">
        <Alert>
          <AlertDescription>
            Bạn chưa kết nối shop nào. Vui lòng vào{' '}
            <a href="/settings/shops" className="text-brand hover:underline font-medium">Cài đặt → Quản lý Shop</a>{' '}
            để kết nối shop Shopee.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">
          {/* Sticky Header Section */}
          <div className="flex-shrink-0">
            {/* Header with Filter and Actions */}
            <div className="border-b">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:px-4 md:py-3">
                {/* Filters */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1 min-w-[120px] md:flex-none md:w-[160px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'all', label: 'Tất cả', count: stats.total },
                      { value: 'success', label: 'Thành công', count: stats.success },
                      { value: 'error', label: 'Lỗi', count: stats.error },
                      { value: 'scheduled', label: 'Đã lên lịch', count: stats.pending },
                    ].map((tab) => (
                      <SelectItem key={tab.value} value={tab.value}>
                        {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-empty={!dateFilter}
                      className="flex-1 min-w-[120px] md:flex-none md:w-[180px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {dateFilter ? format(dateFilter, 'dd/MM/yyyy', { locale: vi }) : 'Lọc theo ngày'}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFilter}
                      onSelect={setDateFilter}
                      defaultMonth={dateFilter}
                    />
                  </PopoverContent>
                </Popover>
                {dateFilter && (
                  <button
                    onClick={() => setDateFilter(undefined)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Bulk actions */}
                {isSomeSelected && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={bulkDeleting}
                    className="cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Xóa {selectedRecords.size} đã chọn
                  </Button>
                )}
              </div>

              {/* Select all bar */}
              {history.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 border-t bg-muted/30">
                  <Checkbox
                    checked={isAllPageSelected}
                    onCheckedChange={toggleSelectAllPage}
                    className="cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">
                    {isAllPageSelected ? 'Bỏ chọn trang này' : 'Chọn tất cả trang này'}
                    {selectedRecords.size > 0 && ` · ${selectedRecords.size} đã chọn`}
                  </span>
                </div>
              )}
            </div>

            {/* Progress */}
            {isRunning && (
              <div className="px-4 py-3 border-b bg-success/10">
                <div className="flex items-center gap-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-success" />
                  <div className="flex-1">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
                </div>
              </div>
            )}

            {/* Process Logs - only show for immediate setup */}
            {processLogs.length > 0 && isImmediateSetup && (
              <div className="border-b">
                <div className="px-4 py-2 bg-background text-sm font-medium text-muted-foreground">Kết quả xử lý</div>
                <div className="max-h-[200px] overflow-y-auto divide-y">
                  {processLogs.map((log) => {
                    const slot = timeSlots.find(s => s.timeslot_id === log.timeslot_id);
                    return (
                      <div key={log.timeslot_id} className="px-4 py-3 flex items-center gap-3">
                        {log.status === 'success' && <CheckCircle className="h-4 w-4 text-success" />}
                        {log.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                        {log.status === 'processing' && <RefreshCw className="h-4 w-4 animate-spin text-info" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {slot ? `${formatDate(slot.start_time)} ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}` : `Slot #${log.timeslot_id}`}
                          </p>
                          <p className={cn(
                            "text-xs mt-0.5",
                            log.status === 'success' && "text-success",
                            log.status === 'error' && "text-destructive",
                            log.status === 'processing' && "text-info"
                          )}>
                            {log.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile List View */}
            <div className="md:hidden">
            {loadingHistory ? (
              <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-3 mx-auto text-muted-foreground" />
                <p>Chưa có lịch sử nào</p>
              </div>
            ) : (
              <div className="divide-y">
                {pagedHistory.map((record) => {
                  const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                  const dateStr = formatDate(record.slot_start_time);
                  const endDateStr = formatDate(record.slot_end_time);
                  const startTimeStr = formatTime(record.slot_start_time);
                  const endTimeStr = formatTime(record.slot_end_time);

                  /* Left border color by status */
                  const borderColor =
                    record.status === 'success'
                      ? 'border-l-success'
                      : record.status === 'error'
                        ? 'border-l-destructive'
                        : record.status === 'processing'
                          ? 'border-l-info'
                          : 'border-l-info/50';

                  return (
                    <div key={record.id} className={cn("px-3 py-2.5 bg-card border-l-[3px]", borderColor, selectedRecords.has(record.id) && "bg-primary/5")}>
                      {/* Row 1: Checkbox + Time slot + Status + Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onCheckedChange={() => toggleRecordSelection(record.id)}
                          className="shrink-0 cursor-pointer"
                        />
                        <span className="text-sm text-foreground font-medium flex-1">
                          {startTimeStr} {dateStr} – {dateStr === endDateStr ? endTimeStr : `${endTimeStr} ${endDateStr}`}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0", statusConfig.color)}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => setDeleteConfirmId(record.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Row 2: Meta info */}
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Số SP: <span className="font-medium text-foreground">{record.items_count}</span>
                        </span>
                        {record.status === 'success' && record.flash_sale_id && (
                          <span className="text-success font-mono">
                            FS #{record.flash_sale_id}
                          </span>
                        )}
                        {record.lead_time_minutes > 0 && (
                          <span className="text-info">
                            {record.lead_time_minutes} phút trước
                          </span>
                        )}
                        {record.status === 'scheduled' && record.scheduled_at && (
                          <span className="text-info">
                            Chờ đến: {formatDateTime(record.scheduled_at)}
                          </span>
                        )}
                      </div>

                      {/* Error message if any */}
                      {record.status === 'error' && record.error_message && (
                        <div className="mt-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">
                          {record.error_message}
                        </div>
                      )}
                    </div>
                  );
                })}
                {historyTotalPages > 1 && (
                  <div className="px-4 py-3 border-t">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setHistoryPage(p => Math.max(1, p - 1))} className={historyPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                        </PaginationItem>
                        {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(p => (
                          <PaginationItem key={p}>
                            <PaginationLink isActive={historyPage === p} onClick={() => setHistoryPage(p)} className="cursor-pointer">{p}</PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} className={historyPage === historyTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Desktop Card Rows */}
            <div className="hidden md:block p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-info" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-3" />
                  <p>Chưa có lịch sử nào</p>
                </div>
              ) : (
                <>
                <div className="space-y-3">
                  {pagedHistory.map((record) => {
                    const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                    return (
                      <div
                        key={record.id}
                        className={cn("bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all group", selectedRecords.has(record.id) && "border-primary/50 bg-primary/5")}
                      >
                        <div className="grid grid-cols-[24px_1fr_auto_100px_140px_140px_40px] items-center gap-4">
                          {/* Checkbox */}
                          <Checkbox
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={() => toggleRecordSelection(record.id)}
                            className="cursor-pointer"
                          />
                          {/* Main Info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-semibold text-foreground">
                                {formatTime(record.slot_start_time)}{" "}
                                {formatDate(record.slot_start_time)} –{" "}
                                {formatDate(record.slot_start_time) === formatDate(record.slot_end_time)
                                  ? formatTime(record.slot_end_time)
                                  : `${formatTime(record.slot_end_time)} ${formatDate(record.slot_end_time)}`}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground ml-10 truncate">
                              {record.status === 'success' && record.flash_sale_id ? (
                                <span className="text-success font-mono">Flash Sale #{record.flash_sale_id}</span>
                              ) : record.status === 'error' && record.error_message ? (
                                <span className="text-destructive">{record.error_message}</span>
                              ) : record.status === 'scheduled' && record.scheduled_at ? (
                                <span className="text-info">Chờ đến {formatDateTime(record.scheduled_at)}</span>
                              ) : (
                                <span>—</span>
                              )}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <Badge variant="outline" className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap", statusConfig.color)}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>

                          {/* Cài trước */}
                          <div className="text-sm">
                            <p className="text-muted-foreground text-xs">Cài trước</p>
                            <p className="font-medium text-foreground">
                              {record.lead_time_minutes > 0 ? `${record.lead_time_minutes} phút` : 'Ngay lập tức'}
                            </p>
                          </div>

                          {/* Đặt lịch lúc */}
                          <div className="text-sm">
                            <p className="text-muted-foreground text-xs">Đặt lịch lúc</p>
                            <p className="font-medium text-foreground">{formatDateTime(record.created_at)}</p>
                          </div>

                          {/* Đã chạy lúc */}
                          <div className="text-sm">
                            <p className="text-muted-foreground text-xs">Đã chạy lúc</p>
                            <p className="font-medium text-foreground">{record.executed_at ? formatDateTime(record.executed_at) : '—'}</p>
                          </div>

                          {/* Delete Action */}
                          <div className="flex justify-center">
                            <button
                              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              onClick={() => setDeleteConfirmId(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {historyTotalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setHistoryPage(p => Math.max(1, p - 1))} className={historyPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                        </PaginationItem>
                        {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(p => (
                          <PaginationItem key={p}>
                            <PaginationLink isActive={historyPage === p} onClick={() => setHistoryPage(p)} className="cursor-pointer">{p}</PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} className={historyPage === historyTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-[672px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-success" />
              Cài đặt tự động tạo Flash Sale
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 py-4 max-h-[70vh] overflow-y-auto px-4 md:px-1">
            {/* Left: Time Slots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-info" />
                  Chọn khung giờ ({selectedSlots.size}/{timeSlots.length})
                </Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={toggleAllSlots} disabled={isRunning}>
                    {selectedSlots.size === timeSlots.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={fetchTimeSlots} disabled={loadingSlots}>
                    <RefreshCw className={cn("h-4 w-4", loadingSlots && "animate-spin")} />
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-info" />
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mb-2" />
                    <p className="text-sm">Không có khung giờ</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {(Object.entries(groupedSlots) as [string, TimeSlot[]][]).map(([date, slots]) => {
                      const slotIds = slots.map(s => s.timeslot_id);
                      const allSelected = slotIds.length > 0 && slotIds.every(id => selectedSlots.has(id));
                      const someSelected = slotIds.some(id => selectedSlots.has(id));
                      
                      return (
                        <div key={date}>
                          <div 
                            className="px-3 py-2 bg-background text-xs font-medium text-muted-foreground sticky top-0 flex items-center gap-2 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => toggleDateSlots(date)}
                          >
                            <Checkbox
                              checked={allSelected}
                              className={cn(
                                "border-border",
                                someSelected && !allSelected && "data-[state=unchecked]:bg-muted"
                              )}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => toggleDateSlots(date)}
                            />
                            <span>{date}</span>
                            <span className="text-muted-foreground ml-auto">({slots.length} khung giờ)</span>
                          </div>
                          <div className="divide-y">
                            {slots.map((slot: TimeSlot) => (
                              <div key={slot.timeslot_id} className="px-3 py-2 flex items-center gap-2 hover:bg-background">
                                <Checkbox
                                  checked={selectedSlots.has(slot.timeslot_id)}
                                  onCheckedChange={() => toggleSlot(slot.timeslot_id)}
                                  className="border-border"
                                />
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Lead Time */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-success" />
                Thời gian tự động cài
              </Label>
              <Select
                value={isCustomLeadTime ? 'custom' : leadTimeMinutes.toString()}
                onValueChange={(v) => {
                  if (v === 'custom') {
                    setIsCustomLeadTime(true);
                    setCustomLeadTimeInput(leadTimeMinutes > 0 ? leadTimeMinutes.toString() : '');
                  } else {
                    setIsCustomLeadTime(false);
                    setLeadTimeMinutes(Number(v));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn thời gian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tạo ngay lập tức</SelectItem>
                  <SelectItem value="10">10 phút trước khung giờ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {leadTimeMinutes === 0
                  ? 'Tất cả Flash Sale sẽ được tạo ngay lập tức'
                  : `Mỗi Flash Sale sẽ được tạo ${leadTimeMinutes} phút trước giờ bắt đầu của khung đó`
                }
              </p>

              {/* Template Info */}
              <div className="mt-4 space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-brand" />
                  Sản phẩm mẫu
                  <Button variant="ghost" size="sm" onClick={() => fetchLatestTemplate()} disabled={loadingTemplate} className="ml-auto h-6 px-2">
                    <RefreshCw className={cn("h-3 w-3", loadingTemplate && "animate-spin")} />
                  </Button>
                </Label>
                {loadingTemplate ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang tải...
                  </div>
                ) : templateItems.length === 0 ? (
                  <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    Không có sản phẩm mẫu. Cần có Flash Sale với sản phẩm đang bật.
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground bg-success/10 p-2 rounded">
                    <p className="font-medium text-success">{templateItems.length} sản phẩm</p>
                    {latestFlashSaleId && (
                      <p className="text-xs text-success mt-1">Từ Flash Sale #{latestFlashSaleId}</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)} className="w-full md:w-auto mt-2 md:mt-0">
              Hủy
            </Button>
            <Button
              onClick={runAutoSetup}
              disabled={selectedSlots.size === 0 || templateItems.length === 0}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 w-full md:w-auto"
            >
              <Play className="h-4 w-4 mr-2" />
              Bắt đầu ({selectedSlots.size} khung giờ)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete single record */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const record = history.find(h => h.id === deleteConfirmId);
                if (record?.flash_sale_id) {
                  return `Flash Sale #${record.flash_sale_id} trên Shopee cũng sẽ bị xóa. Bạn có chắc chắn?`;
                }
                return 'Bạn có chắc muốn xóa bản ghi này?';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteConfirmId) deleteRecord(deleteConfirmId); setDeleteConfirmId(null); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm clear all history */}
      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ lịch sử</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const fsCount = history.filter(h => h.flash_sale_id).length;
                if (fsCount > 0) {
                  return `${fsCount} Flash Sale đã tạo trên Shopee cũng sẽ bị xóa. Hành động này không thể hoàn tác.`;
                }
                return 'Toàn bộ lịch sử sẽ bị xóa. Hành động này không thể hoàn tác.';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllHistory}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk delete selected records */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa {selectedRecords.size} bản ghi đã chọn</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const selected = history.filter(h => selectedRecords.has(h.id));
                const fsCount = selected.filter(h => h.flash_sale_id && Number(h.flash_sale_id) > 0).length;
                if (fsCount > 0) {
                  return `${fsCount} Flash Sale trên Shopee cũng sẽ bị xóa. Hành động này không thể hoàn tác.`;
                }
                return 'Các bản ghi đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={bulkDeleteSelected}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa {selectedRecords.size} bản ghi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
