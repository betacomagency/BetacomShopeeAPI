/**
 * AutoSetupDialog - Dialog cài đặt tự động Flash Sale
 * Có thể sử dụng từ FlashSalePanel hoặc FlashSaleAutoSetupPage
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Package, Play, RefreshCw, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageWithZoom } from '@/components/ui/image-with-zoom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface TimeSlot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
}

interface FlashSaleItem {
  item_id: number;
  item_name?: string;
  image?: string;
  image_url?: string;
  item_image?: string;
  status: number;
  purchase_limit: number;
  campaign_stock?: number;
  original_price?: number;
  input_promotion_price?: number;
  promotion_price_with_tax?: number;
  models?: FlashSaleModel[];
}

interface FlashSaleModel {
  model_id: number;
  model_name?: string;
  item_id: number;
  input_promotion_price: number;
  promotion_price_with_tax?: number;
  original_price?: number;
  campaign_stock: number;
  stock?: number;
  purchase_limit?: number;
  status?: number;
}

interface AutoSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: number;
  userId: string;
  copyFromFlashSaleId?: number | null;
  onSuccess?: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getItemImage(item: FlashSaleItem): string | undefined {
  const imageId = item.image || item.image_url || item.item_image;
  if (!imageId) return undefined;
  if (imageId.startsWith('http')) return imageId;
  return `https://cf.shopee.vn/file/${imageId}`;
}

function formatPrice(price?: number): string {
  if (!price) return '-';
  return `₫${price.toLocaleString('vi-VN')}`;
}

function calcDiscount(original?: number, promo?: number): number {
  if (!original || !promo || original <= 0) return 0;
  return Math.round(((original - promo) / original) * 100);
}

export function AutoSetupDialog({
  open,
  onOpenChange,
  shopId,
  userId,
  copyFromFlashSaleId,
  onSuccess,
}: AutoSetupDialogProps) {
  const { toast } = useToast();

  // Time slots state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());

  // Template items state
  const [templateItems, setTemplateItems] = useState<FlashSaleItem[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [latestFlashSaleId, setLatestFlashSaleId] = useState<number | null>(null);
  const [latestFlashSaleTime, setLatestFlashSaleTime] = useState<{ start: number; end: number } | null>(null);

  // Setup options
  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number>(0);
  const [isCustomLeadTime, setIsCustomLeadTime] = useState(false);
  const [_customLeadTimeInput, setCustomLeadTimeInput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  // Progress tracking
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    step: string;
    currentSlot?: TimeSlot;
    results: { slotId: number; status: 'success' | 'error'; message?: string }[];
  } | null>(null);

  // Fetch time slots when dialog opens
  useEffect(() => {
    if (open && shopId) {
      fetchTimeSlots();
      fetchLatestTemplate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shopId, copyFromFlashSaleId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedSlots(new Set());
      setLeadTimeMinutes(0);
      setIsCustomLeadTime(false);
      setCustomLeadTimeInput('');
      setProgress(null);
    }
  }, [open]);

  const fetchTimeSlots = async () => {
    setLoadingSlots(true);
    try {
      const startTime = Math.floor(Date.now() / 1000);

      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-time-slots', shop_id: shopId, start_time: startTime },
      });

      if (error) throw error;

      if (data?.error === 'shop_flash_sale_param_error') {
        setTimeSlots([]);
        return;
      }
      if (data?.error) throw new Error(data.error);

      let slots: TimeSlot[] = [];
      if (data?.response?.time_slot_list) {
        slots = data.response.time_slot_list;
      } else if (Array.isArray(data?.response)) {
        slots = data.response;
      } else if (data?.time_slot_list) {
        slots = data.time_slot_list;
      }

      // Fetch existing flash sales
      const { data: existingFS } = await supabase
        .from('apishopee_flash_sale_data')
        .select('timeslot_id')
        .eq('shop_id', shopId)
        .in('type', [1, 2]);

      // Fetch scheduled slots
      const { data: scheduledSlots } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .select('timeslot_id')
        .eq('shop_id', shopId)
        .in('status', ['pending', 'scheduled']);

      const usedIds = new Set<number>([
        ...(existingFS || []).map((fs: { timeslot_id: number }) => fs.timeslot_id).filter(Boolean),
        ...(scheduledSlots || []).map((s: { timeslot_id: number }) => s.timeslot_id).filter(Boolean),
      ]);

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

  const fetchLatestTemplate = async () => {
    setLoadingTemplate(true);
    try {
      let flashSaleId = copyFromFlashSaleId;

      if (flashSaleId) {
        // Lấy thời gian từ DB cho flash sale được copy
        const { data: copyFs } = await supabase
          .from('apishopee_flash_sale_data')
          .select('start_time, end_time')
          .eq('shop_id', shopId)
          .eq('flash_sale_id', flashSaleId)
          .single();
        if (copyFs) {
          setLatestFlashSaleTime({ start: copyFs.start_time, end: copyFs.end_time });
        }
      } else {
        // Ưu tiên lấy FS đang chạy hoặc sắp tới
        let { data: fsData, error: fsError } = await supabase
          .from('apishopee_flash_sale_data')
          .select('*')
          .eq('shop_id', shopId)
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
            .eq('shop_id', shopId)
            .order('start_time', { ascending: false })
            .limit(1)
            .single();

          if (latestError && latestError.code !== 'PGRST116') throw latestError;
          fsData = latestFs;
        }

        if (!fsData) {
          setTemplateItems([]);
          setLatestFlashSaleId(null);
          setLatestFlashSaleTime(null);
          return;
        }

        flashSaleId = fsData.flash_sale_id;
        setLatestFlashSaleTime({ start: fsData.start_time, end: fsData.end_time });
      }

      setLatestFlashSaleId(flashSaleId ?? null);

      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-items', shop_id: shopId, flash_sale_id: flashSaleId },
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

  // Group time slots by date
  const groupedSlots = useMemo((): Record<string, TimeSlot[]> => {
    const groups: Record<string, TimeSlot[]> = {};
    timeSlots.forEach((slot) => {
      const dateKey = formatDate(slot.start_time);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    });
    return groups;
  }, [timeSlots]);

  const toggleSlot = (timeslotId: number) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(timeslotId)) newSelected.delete(timeslotId);
    else newSelected.add(timeslotId);
    setSelectedSlots(newSelected);
  };

  const toggleDateSlots = (dateKey: string) => {
    const slotsInDate = groupedSlots[dateKey] || [];
    const slotIds = slotsInDate.map(s => s.timeslot_id);
    const allSelected = slotIds.every(id => selectedSlots.has(id));

    const newSelected = new Set(selectedSlots);
    if (allSelected) {
      slotIds.forEach(id => newSelected.delete(id));
    } else {
      slotIds.forEach(id => newSelected.add(id));
    }
    setSelectedSlots(newSelected);
  };

  const runAutoSetup = async () => {
    if (selectedSlots.size === 0) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn ít nhất 1 khung giờ', variant: 'destructive' });
      return;
    }
    if (templateItems.length === 0) {
      toast({ title: 'Thiếu thông tin', description: 'Không có sản phẩm mẫu để sao chép', variant: 'destructive' });
      return;
    }

    setIsRunning(true);

    const slotsToProcess = timeSlots.filter(s => selectedSlots.has(s.timeslot_id));

    // Prepare items to add
    const itemsToAdd = templateItems.map(item => {
      const enabledModels = item.models?.filter(m => m.status === 1) || [];
      const isNonVariantWithModel = enabledModels.length === 1 && enabledModels[0].model_id === 0;

      if (isNonVariantWithModel) {
        const model = enabledModels[0];
        if (!model.input_promotion_price || model.input_promotion_price <= 0) return null;
        return {
          item_id: item.item_id,
          purchase_limit: item.purchase_limit || 0,
          item_input_promo_price: model.input_promotion_price,
          item_stock: model.campaign_stock || 0,
        };
      }

      if (enabledModels.length === 0 && item.input_promotion_price && item.input_promotion_price > 0) {
        return {
          item_id: item.item_id,
          purchase_limit: item.purchase_limit || 0,
          item_input_promo_price: item.input_promotion_price,
          item_stock: item.campaign_stock || 0,
        };
      }

      if (enabledModels.length === 0) return null;

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
      if (!item) return false;
      if ('models' in item && item.models) {
        return item.models.length > 0 && item.models.every(m => m.input_promo_price > 0);
      }
      if ('item_input_promo_price' in item) {
        return item.item_input_promo_price > 0;
      }
      return false;
    });

    // If scheduled (leadTimeMinutes > 0), just insert to history
    if (leadTimeMinutes > 0) {
      setProgress({ current: 0, total: slotsToProcess.length, step: 'Đang lên lịch...', results: [] });
      let insertedCount = 0;
      for (let i = 0; i < slotsToProcess.length; i++) {
        const slot = slotsToProcess[i];
        setProgress(prev => prev && ({
          ...prev,
          current: i + 1,
          step: `Lên lịch khung ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`,
          currentSlot: slot,
        }));

        const historyRecord = {
          shop_id: shopId,
          user_id: userId,
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

        setProgress(prev => prev && ({
          ...prev,
          results: [...prev.results, {
            slotId: slot.timeslot_id,
            status: error ? 'error' : 'success',
            message: error?.message,
          }],
        }));

        if (!error) insertedCount++;
      }

      setIsRunning(false);
      onOpenChange(false);
      onSuccess?.();
      toast({
        title: 'Đã lên lịch',
        description: `Đã lên lịch ${insertedCount} Flash Sale.`,
      });
      return;
    }

    // Immediate setup: 2 API calls per slot (create + add items)
    let successCount = 0;
    let errorCount = 0;
    const totalApiCalls = slotsToProcess.length * 2;
    let completedCalls = 0;

    setProgress({ current: 0, total: totalApiCalls, step: 'Bắt đầu...', results: [] });

    for (let i = 0; i < slotsToProcess.length; i++) {
      const slot = slotsToProcess[i];
      const slotLabel = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`;

      const historyRecord = {
        shop_id: shopId,
        user_id: userId,
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

      if (historyId) {
        await supabase
          .from('apishopee_flash_sale_auto_history')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', historyId);
      }

      try {
        // Step 1: Create flash sale
        setProgress(prev => prev && ({ ...prev, step: `Tạo khung ${slotLabel}`, currentSlot: slot }));

        const { data: createData, error: createError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'create-flash-sale',
            shop_id: shopId,
            timeslot_id: slot.timeslot_id,
          },
        });

        if (createError) throw createError;
        if (createData?.error) throw new Error(createData.message || createData.error);

        const flashSaleId = createData?.response?.flash_sale_id;
        if (!flashSaleId) throw new Error('Không nhận được flash_sale_id');

        completedCalls++;
        setProgress(prev => prev && ({ ...prev, current: completedCalls }));

        // Step 2: Add items
        setProgress(prev => prev && ({ ...prev, step: `Thêm ${itemsToAdd.length} SP vào ${slotLabel}` }));

        const { error: addError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'add-items',
            shop_id: shopId,
            flash_sale_id: flashSaleId,
            items: itemsToAdd,
          },
        });

        if (addError) throw addError;

        completedCalls++;
        setProgress(prev => prev && ({ ...prev, current: completedCalls }));

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
        setProgress(prev => prev && ({
          ...prev,
          results: [...prev.results, { slotId: slot.timeslot_id, status: 'success' }],
        }));
      } catch (err) {
        // If failed at step 1, count both calls as done for progress
        const callsForThisSlot = 2;
        const callsDoneBefore = i * 2;
        completedCalls = callsDoneBefore + callsForThisSlot;
        setProgress(prev => prev && ({ ...prev, current: completedCalls }));

        if (historyId) {
          await supabase
            .from('apishopee_flash_sale_auto_history')
            .update({
              status: 'error',
              error_message: (err as Error).message,
              executed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', historyId);
        }
        errorCount++;
        setProgress(prev => prev && ({
          ...prev,
          results: [...prev.results, { slotId: slot.timeslot_id, status: 'error', message: (err as Error).message }],
        }));
      }

      // Delay between slots
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    onOpenChange(false);
    onSuccess?.();
    toast({
      title: 'Hoàn tất',
      description: `Thành công: ${successCount}, Lỗi: ${errorCount}`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-success" />
            Cài đặt tự động tạo Flash Sale
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cài đặt tự động tạo Flash Sale
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 flex-1 overflow-y-auto sm:max-h-[60vh] px-1">
          {/* Progress UI - shown when running */}
          {isRunning && progress && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">{progress.step}</span>
                  <span className="text-muted-foreground">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-success to-success rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Results list */}
              {progress.results.length > 0 && (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                  {progress.results.map((result, idx) => {
                    const slot = timeSlots.find(s => s.timeslot_id === result.slotId);
                    return (
                      <div key={idx} className="px-3 py-2 flex items-center gap-2 text-sm">
                        {result.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                        <span className="text-foreground">
                          {slot ? `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)} ${formatDate(slot.start_time)}` : `Slot #${result.slotId}`}
                        </span>
                        {result.status === 'success' ? (
                          <span className="text-success text-xs ml-auto">Thành công</span>
                        ) : (
                          <span className="text-destructive text-xs ml-auto truncate max-w-[200px]" title={result.message}>
                            {result.message || 'Lỗi'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Top: Lead Time & Template - hidden when running */}
          {!isRunning ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
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
                  : `Mỗi Flash Sale sẽ được tạo ${leadTimeMinutes} phút trước giờ bắt đầu`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4 text-brand" />
                Sản phẩm mẫu
                <Button variant="ghost" size="sm" onClick={fetchLatestTemplate} disabled={loadingTemplate} className="ml-auto h-6 px-2">
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
                  {latestFlashSaleId && latestFlashSaleTime && (
                    <p className="text-xs text-success mt-1">
                      Từ khung {new Date(latestFlashSaleTime.start * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(latestFlashSaleTime.end * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div> : null}

          {/* Product Table - shown when not running and has items */}
          {!isRunning && templateItems.length > 0 && (
            <TemplateItemsTable items={templateItems} />
          )}

          {/* Bottom: Time Slots - hidden when running */}
          {!isRunning ? <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-info" />
                Chọn khung giờ ({selectedSlots.size}/{timeSlots.length})
              </Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedSlots(new Set(timeSlots.map(s => s.timeslot_id)))} disabled={isRunning || selectedSlots.size === timeSlots.length}>
                  Chọn tất cả
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedSlots(new Set())} disabled={isRunning || selectedSlots.size === 0}>
                  Bỏ chọn
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchTimeSlots} disabled={loadingSlots}>
                  <RefreshCw className={cn("h-4 w-4", loadingSlots && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-info" />
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mb-2" />
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
                          className="px-3 py-2 bg-muted text-xs font-medium text-muted-foreground sticky top-0 flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors"
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
                          {slots.map((slot) => (
                            <div key={slot.timeslot_id} className="px-3 py-2 flex items-center gap-2 hover:bg-muted">
                              <Checkbox
                                checked={selectedSlots.has(slot.timeslot_id)}
                                onCheckedChange={() => toggleSlot(slot.timeslot_id)}
                                className="border-border"
                              />
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDate(slot.start_time)}
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
          </div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning} className="w-full md:w-auto mt-2 md:mt-0">
            Hủy
          </Button>
          <Button
            onClick={runAutoSetup}
            disabled={selectedSlots.size === 0 || templateItems.length === 0 || isRunning}
            className="bg-gradient-to-r from-success to-success hover:from-success hover:to-success w-full md:w-auto"
          >
            {isRunning && progress ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {progress.current}/{progress.total}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Bắt đầu ({selectedSlots.size} khung giờ)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== TEMPLATE ITEMS TABLE ====================

function TemplateItemsTable({ items }: { items: FlashSaleItem[] }) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Package className="h-4 w-4 text-brand" />
        Chi tiết sản phẩm ({items.length})
      </Label>
      <div className="border border-border rounded-lg max-h-[350px] overflow-y-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              <th className="h-9 px-3 text-left font-medium text-muted-foreground text-xs">Sản phẩm</th>
              <th className="h-9 px-2 text-right font-medium text-muted-foreground text-xs">Giá gốc</th>
              <th className="h-9 px-2 text-right font-medium text-muted-foreground text-xs">Giá KM</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground text-xs">Giảm</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground text-xs">SL KM</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground text-xs">Kho</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground text-xs">Giới hạn</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <TemplateItemRow
                key={item.item_id}
                item={item}
                expanded={expandedItems.has(item.item_id)}
                onToggleExpand={() => toggleExpand(item.item_id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplateItemRow({ item, expanded, onToggleExpand }: {
  item: FlashSaleItem;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const hasModels = item.models && item.models.length > 0;
  const modelsToShow = expanded ? item.models : item.models?.slice(0, 3);
  const itemImage = getItemImage(item);

  return (
    <>
      {/* Item header */}
      <tr className="border-b bg-muted/50">
        <td colSpan={7} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {itemImage ? (
                <ImageWithZoom
                  src={itemImage}
                  alt={item.item_name || `Item #${item.item_id}`}
                  className="w-full h-full object-cover"
                  zoomSize={200}
                />
              ) : (
                <div className="w-5 h-5 bg-muted rounded" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-foreground truncate block">
                {item.item_name || `Item #${item.item_id}`}
              </span>
              <span className="text-[10px] text-muted-foreground">ID: {item.item_id}</span>
            </div>
          </div>
        </td>
      </tr>

      {/* Model rows or single item */}
      {hasModels ? (
        <>
          {modelsToShow?.map(model => {
            const promoPrice = model.input_promotion_price || model.promotion_price_with_tax;
            const discount = calcDiscount(model.original_price, promoPrice);
            return (
              <tr key={model.model_id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-1.5">
                  <span className="text-xs text-muted-foreground truncate block">{model.model_name || `#${model.model_id}`}</span>
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground text-right">{formatPrice(model.original_price)}</td>
                <td className="px-2 py-1.5 text-xs text-foreground text-right font-medium">{formatPrice(promoPrice)}</td>
                <td className="px-2 py-1.5 text-center">
                  {discount > 0 && (
                    <span className="px-1 py-0.5 text-[10px] font-medium text-brand border border-brand/30 rounded">-{discount}%</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-xs text-brand font-medium text-center">{model.campaign_stock ?? 0}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground text-center">{model.stock ?? 0}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                  {(model.purchase_limit ?? item.purchase_limit) > 0 ? (model.purchase_limit ?? item.purchase_limit) : '-'}
                </td>
              </tr>
            );
          })}
          {item.models && item.models.length > 3 && (
            <tr className="border-b">
              <td colSpan={7} className="px-3 py-1">
                <button
                  onClick={onToggleExpand}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  {expanded ? (
                    <>Thu gọn <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Xem thêm {item.models.length - 3} phân loại <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              </td>
            </tr>
          )}
        </>
      ) : (
        <tr className="border-b hover:bg-muted/50">
          <td className="px-3 py-1.5"><span className="text-xs text-muted-foreground">-</span></td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground text-right">{formatPrice(item.original_price)}</td>
          <td className="px-2 py-1.5 text-xs text-foreground text-right font-medium">
            {formatPrice(item.input_promotion_price || item.promotion_price_with_tax)}
          </td>
          <td className="px-2 py-1.5 text-center">
            {calcDiscount(item.original_price, item.input_promotion_price || item.promotion_price_with_tax) > 0 && (
              <span className="px-1 py-0.5 text-[10px] font-medium text-brand border border-brand/30 rounded">
                -{calcDiscount(item.original_price, item.input_promotion_price || item.promotion_price_with_tax)}%
              </span>
            )}
          </td>
          <td className="px-2 py-1.5 text-xs text-brand font-medium text-center">{item.campaign_stock ?? 0}</td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground text-center">0</td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground text-center">
            {item.purchase_limit > 0 ? item.purchase_limit : '-'}
          </td>
        </tr>
      )}
    </>
  );
}
