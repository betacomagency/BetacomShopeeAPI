/**
 * Flash Sale Copy Page - Sao chép Flash Sale
 * Hiển thị chi tiết sản phẩm + chọn khung giờ mới (giống BigSeller)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Store,
  AlertCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { ImageWithZoom } from '@/components/ui/image-with-zoom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useSyncData } from '@/hooks/useSyncData';
import { supabase } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// Badge available for future use
// import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ==================== INTERFACES ====================

interface TimeSlot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
}

interface CriteriaData {
  min_discount?: number;
  max_discount?: number;
  min_promo_stock?: number;
  max_promo_stock?: number;
  min_product_rating?: number;
  min_likes?: number;
  min_order_total?: number;
  max_days_to_ship?: number;
  min_repetition_day?: number;
  min_discount_price?: number;
  max_discount_price?: number;
  need_lowest_price?: boolean;
  must_not_pre_order?: boolean;
}

const DEFAULT_CRITERIA: CriteriaData = {
  min_discount: 5,
  max_discount: 90,
  min_promo_stock: 1,
  max_promo_stock: 10000,
  min_product_rating: 4,
  max_days_to_ship: 2,
  must_not_pre_order: true,
};

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
  stock?: number;
  models?: FlashSaleModel[];
}

interface FlashSaleModel {
  model_id: number;
  model_name?: string;
  item_id: number;
  original_price?: number;
  input_promotion_price: number;
  promotion_price_with_tax?: number;
  campaign_stock: number;
  stock?: number;
  purchase_limit?: number;
  status?: number;
}

// ==================== HELPERS ====================

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

// ==================== MAIN PAGE ====================

export default function FlashSaleCopyPage() {
  const { flashSaleId: flashSaleIdParam } = useParams<{ flashSaleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { shops, selectedShopId, isLoading: shopsLoading } = useShopeeAuth();

  const flashSaleId = flashSaleIdParam ? parseInt(flashSaleIdParam) : null;
  const currentShop = shops.find(s => s.shop_id === selectedShopId);

  const { triggerSync } = useSyncData({
    shopId: selectedShopId || 0,
    userId: user?.id || '',
    autoSyncOnMount: false,
  });

  // State
  const [templateItems, setTemplateItems] = useState<FlashSaleItem[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [sourceFlashSaleTime, setSourceFlashSaleTime] = useState<{ start: number; end: number } | null>(null);

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());

  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number>(10);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progressResults, setProgressResults] = useState<{ slotId: number; status: 'success' | 'error'; message?: string }[]>([]);
  const [progressStep, setProgressStep] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);

  // Item toggle state
  const [excludedItems, setExcludedItems] = useState<Set<number>>(new Set());
  const [excludedModels, setExcludedModels] = useState<Set<string>>(new Set()); // "itemId:modelId"

  // Exclusion reason tracking — lý do từng model bị auto-exclude
  type ExclusionReason = 'no_stock' | 'criteria_fail' | 'disabled' | 'no_price';
  const [exclusionReasons, setExclusionReasons] = useState<Map<string, ExclusionReason[]>>(new Map());

  // Criteria state
  const [criteria, setCriteria] = useState<CriteriaData>(DEFAULT_CRITERIA);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [failedModels, setFailedModels] = useState<Set<string>>(new Set()); // "itemId:modelId" that fail criteria

  // Inline edits: key = "itemId:modelId", value = edited promo price / campaign stock
  const [itemEdits, setItemEdits] = useState<Map<string, { promoPrice?: number; campaignStock?: number }>>(new Map());

  // Fetch data on mount
  useEffect(() => {
    if (selectedShopId && flashSaleId) {
      fetchTemplateItems();
      fetchTimeSlots();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, flashSaleId]);

  // Fetch criteria after template items loaded
  useEffect(() => {
    if (templateItems.length > 0 && selectedShopId) {
      fetchCriteria();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateItems.length, selectedShopId]);

  // ==================== DATA FETCHING ====================

  const fetchTemplateItems = async () => {
    if (!selectedShopId || !flashSaleId) return;
    setLoadingTemplate(true);
    // Reset exclusion state để tránh duplicate khi re-render (StrictMode)
    setExclusionReasons(new Map());
    setExcludedModels(new Set());
    try {
      // Get source FS time info
      const { data: fsData } = await supabase
        .from('apishopee_flash_sale_data')
        .select('start_time, end_time')
        .eq('shop_id', selectedShopId)
        .eq('flash_sale_id', flashSaleId)
        .single();

      if (fsData) {
        setSourceFlashSaleTime({ start: fsData.start_time, end: fsData.end_time });
      }

      // Fetch items from Shopee API
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

      // Auto-exclude models + track exclusion reasons
      const noStockModels = new Set<string>();
      const newReasons = new Map<string, ExclusionReason[]>();

      for (const item of enabledItems) {
        if (item.models) {
          for (const model of item.models) {
            const key = `${item.item_id}:${model.model_id}`;
            // RC1: stock = 0 → hết hàng (FS đã chạy xong)
            if ((model.stock ?? 0) === 0) {
              noStockModels.add(key);
              newReasons.set(key, [...(newReasons.get(key) || []), 'no_stock']);
            }
            // RC3: model bị vô hiệu/từ chối bởi Shopee
            if (model.status !== undefined && model.status !== 1) {
              noStockModels.add(key);
              newReasons.set(key, [...(newReasons.get(key) || []), 'disabled']);
            }
            // RC4: model không có giá khuyến mãi
            const promoPrice = model.input_promotion_price || 0;
            if (promoPrice <= 0) {
              noStockModels.add(key);
              newReasons.set(key, [...(newReasons.get(key) || []), 'no_price']);
            }
          }
        }
      }

      if (noStockModels.size > 0) {
        setExcludedModels(prev => {
          const next = new Set(prev);
          noStockModels.forEach(k => next.add(k));
          return next;
        });
      }
      if (newReasons.size > 0) {
        setExclusionReasons(prev => {
          const next = new Map(prev);
          newReasons.forEach((reasons, key) => next.set(key, [...(next.get(key) || []), ...reasons]));
          return next;
        });
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
      setTemplateItems([]);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const fetchTimeSlots = async () => {
    if (!selectedShopId) return;
    setLoadingSlots(true);
    try {
      const startTime = Math.floor(Date.now() / 1000);
      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-time-slots', shop_id: selectedShopId, start_time: startTime },
      });

      if (error) throw error;
      if (data?.error === 'shop_flash_sale_param_error') { setTimeSlots([]); return; }
      if (data?.error) throw new Error(data.error);

      let slots: TimeSlot[] = [];
      if (data?.response?.time_slot_list) slots = data.response.time_slot_list;
      else if (Array.isArray(data?.response)) slots = data.response;
      else if (data?.time_slot_list) slots = data.time_slot_list;

      // Exclude used timeslots
      const { data: existingFS } = await supabase
        .from('apishopee_flash_sale_data')
        .select('timeslot_id')
        .eq('shop_id', selectedShopId)
        .in('type', [1, 2]);

      const { data: scheduledSlots } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .select('timeslot_id')
        .eq('shop_id', selectedShopId)
        .in('status', ['pending', 'scheduled']);

      const usedIds = new Set<number>([
        ...(existingFS || []).map((fs: { timeslot_id: number }) => fs.timeslot_id).filter(Boolean),
        ...(scheduledSlots || []).map((s: { timeslot_id: number }) => s.timeslot_id).filter(Boolean),
      ]);

      setTimeSlots((Array.isArray(slots) ? slots : []).filter(s => !usedIds.has(s.timeslot_id)));
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchCriteria = async () => {
    if (!selectedShopId) return;
    setLoadingCriteria(true);
    try {
      const firstItemId = templateItems[0]?.item_id;
      if (!firstItemId) return;
      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: { action: 'get-criteria', shop_id: selectedShopId, item_id: firstItemId },
      });
      if (error) throw error;
      if (data?.error) {
        console.warn('[CRITERIA] API error, using defaults:', data.error);
        return;
      }
      const criteriaList = data?.response?.criteria;
      if (Array.isArray(criteriaList) && criteriaList.length > 0) {
        const c = criteriaList[0] as CriteriaData;
        // Override min_promo_stock to 1 (Shopee returns 5 but we allow lower stock)
        c.min_promo_stock = DEFAULT_CRITERIA.min_promo_stock;
        setCriteria(c);

        // Auto-check all models against criteria and auto-exclude failed ones
        const failed = new Set<string>();
        const autoExcludeModels = new Set<string>();
        for (const item of templateItems) {
          if (item.models && item.models.length > 0) {
            for (const model of item.models) {
              const promoPrice = model.input_promotion_price || model.promotion_price_with_tax;
              const discount = calcDiscount(model.original_price, promoPrice);
              const check = checkModelCriteria(c, discount, model.campaign_stock ?? 0);
              if (!check.pass) {
                const key = `${item.item_id}:${model.model_id}`;
                failed.add(key);
                autoExcludeModels.add(key);
              }
            }
          } else {
            // Single item (no models)
            const promoPrice = item.input_promotion_price || item.promotion_price_with_tax;
            const discount = calcDiscount(item.original_price, promoPrice);
            const check = checkModelCriteria(c, discount, item.campaign_stock ?? 0);
            if (!check.pass) {
              failed.add(`${item.item_id}:0`);
            }
          }
        }
        setFailedModels(failed);
        // Auto-exclude failed models + track criteria_fail reason (RC2)
        if (autoExcludeModels.size > 0) {
          setExcludedModels(prev => {
            const next = new Set(prev);
            autoExcludeModels.forEach(k => next.add(k));
            return next;
          });
          setExclusionReasons(prev => {
            const next = new Map(prev);
            autoExcludeModels.forEach(key => {
              next.set(key, [...(next.get(key) || []), 'criteria_fail']);
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.warn('[CRITERIA] Failed:', (err as Error).message);
    } finally {
      setLoadingCriteria(false);
    }
  };

  // ==================== ITEM TOGGLE ====================

  const toggleItem = (itemId: number) => {
    setExcludedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const toggleModel = (itemId: number, modelId: number) => {
    const key = `${itemId}:${modelId}`;
    setExcludedModels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isModelExcluded = (itemId: number, modelId: number) => excludedModels.has(`${itemId}:${modelId}`);

  // Get effective values (edited or original)
  const getEffectiveValues = useCallback((itemId: number, modelId: number, originalPromo: number, originalStock: number) => {
    const key = `${itemId}:${modelId}`;
    const edit = itemEdits.get(key);
    const rawStock = edit?.campaignStock ?? originalStock;
    return {
      promoPrice: edit?.promoPrice ?? originalPromo,
      // Nếu stock = 0, mặc định lên 1 (Shopee reject stock=0)
      campaignStock: rawStock === 0 ? 1 : rawStock,
    };
  }, [itemEdits]);

  const updateModelEdit = useCallback((itemId: number, modelId: number, field: 'promoPrice' | 'campaignStock', value: number) => {
    const key = `${itemId}:${modelId}`;
    setItemEdits(prev => {
      const next = new Map(prev);
      const existing = next.get(key) || {};
      next.set(key, { ...existing, [field]: value });
      return next;
    });
  }, []);

  // Re-check criteria when edits change
  useEffect(() => {
    if (!criteria || templateItems.length === 0) return;
    const failed = new Set<string>();
    const toExclude = new Set<string>();
    const toUnexclude = new Set<string>();

    for (const item of templateItems) {
      if (item.models && item.models.length > 0) {
        for (const model of item.models) {
          const key = `${item.item_id}:${model.model_id}`;
          const origPromo = model.input_promotion_price || model.promotion_price_with_tax || 0;
          const origStock = model.campaign_stock ?? 0;
          const { promoPrice, campaignStock } = getEffectiveValues(item.item_id, model.model_id, origPromo, origStock);
          const discount = calcDiscount(model.original_price, promoPrice);
          const check = checkModelCriteria(criteria, discount, campaignStock);
          if (!check.pass) {
            failed.add(key);
            if (!excludedModels.has(key)) toExclude.add(key);
          } else {
            // If was previously failed but now passes after edit, allow re-enable
            if (failedModels.has(key) && excludedModels.has(key)) {
              toUnexclude.add(key);
            }
          }
        }
      }
    }

    setFailedModels(failed);
    if (toExclude.size > 0 || toUnexclude.size > 0) {
      setExcludedModels(prev => {
        const next = new Set(prev);
        toExclude.forEach(k => next.add(k));
        toUnexclude.forEach(k => next.delete(k));
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemEdits, criteria, templateItems]);

  // Count active items for footer button
  const activeItemCount = templateItems.filter(item => !excludedItems.has(item.item_id)).length;

  // ==================== EXCLUSION SUMMARY (Phase 3) ====================

  const countByReason = useCallback((reason: ExclusionReason): number => {
    let count = 0;
    exclusionReasons.forEach(reasons => {
      if (reasons.includes(reason)) count++;
    });
    return count;
  }, [exclusionReasons]);

  const restoreAllExcluded = useCallback(() => {
    // Chỉ khôi phục stock=0 và criteria_fail (user có thể ghi đè)
    // KHÔNG khôi phục 'disabled' hoặc 'no_price' (Shopee sẽ reject)
    const restorable = new Set<string>();
    exclusionReasons.forEach((reasons, key) => {
      const onlyUserOverridable = reasons.every(r => r === 'no_stock' || r === 'criteria_fail');
      if (onlyUserOverridable) restorable.add(key);
    });

    setExcludedModels(prev => {
      const next = new Set(prev);
      restorable.forEach(k => next.delete(k));
      return next;
    });
    // Xóa exclusionReasons cho các model đã khôi phục để banner cập nhật đúng
    setExclusionReasons(prev => {
      const next = new Map(prev);
      restorable.forEach(k => next.delete(k));
      return next;
    });
  }, [exclusionReasons]);

  // ==================== SLOT SELECTION ====================

  const groupedSlots = useMemo((): Record<string, TimeSlot[]> => {
    const groups: Record<string, TimeSlot[]> = {};
    timeSlots.forEach(slot => {
      const dateKey = formatDate(slot.start_time);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    });
    return groups;
  }, [timeSlots]);

  const toggleSlot = (id: number) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDateSlots = (dateKey: string) => {
    const slotIds = (groupedSlots[dateKey] || []).map(s => s.timeslot_id);
    const allSelected = slotIds.every(id => selectedSlots.has(id));
    setSelectedSlots(prev => {
      const next = new Set(prev);
      slotIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  // ==================== RUN SETUP ====================

  const prepareItems = () => {
    return templateItems
      .filter(item => !excludedItems.has(item.item_id))
      .map(item => {
        const enabledModels = (item.models?.filter(m => m.status === 1) || [])
          .filter(m => !isModelExcluded(item.item_id, m.model_id));
        const isNonVariantWithModel = enabledModels.length === 1 && enabledModels[0].model_id === 0;

        if (isNonVariantWithModel) {
          const model = enabledModels[0];
          const { promoPrice, campaignStock } = getEffectiveValues(item.item_id, model.model_id, model.input_promotion_price || 0, model.campaign_stock || 0);
          if (!promoPrice || promoPrice <= 0) return null;
          return {
            item_id: item.item_id,
            purchase_limit: item.purchase_limit || 0,
            item_input_promo_price: promoPrice,
            item_stock: campaignStock,
          };
        }

        if (enabledModels.length === 0 && item.input_promotion_price && item.input_promotion_price > 0) {
          const { promoPrice, campaignStock } = getEffectiveValues(item.item_id, 0, item.input_promotion_price, item.campaign_stock || 0);
          return {
            item_id: item.item_id,
            purchase_limit: item.purchase_limit || 0,
            item_input_promo_price: promoPrice,
            item_stock: campaignStock,
          };
        }

        if (enabledModels.length === 0) return null;

        return {
          item_id: item.item_id,
          purchase_limit: item.purchase_limit || 0,
          models: enabledModels.map(m => {
            const { promoPrice, campaignStock } = getEffectiveValues(item.item_id, m.model_id, m.input_promotion_price || 0, m.campaign_stock || 0);
            return {
              model_id: m.model_id,
              input_promo_price: promoPrice,
              stock: campaignStock,
            };
          }),
        };
      }).filter(item => {
        if (!item) return false;
        if ('models' in item && item.models) return item.models.length > 0 && item.models.every(m => m.input_promo_price > 0);
        if ('item_input_promo_price' in item) return item.item_input_promo_price > 0;
        return false;
      });
  };

  const runSetup = async () => {
    if (selectedSlots.size === 0 || templateItems.length === 0 || !selectedShopId || !user?.id) return;

    setIsRunning(true);
    setProgressResults([]);
    setProgressCurrent(0);

    const slotsToProcess = timeSlots.filter(s => selectedSlots.has(s.timeslot_id));
    const itemsToAdd = prepareItems();

    if (leadTimeMinutes > 0) {
      // Scheduled mode
      setProgressStep('Đang lên lịch...');
      let insertedCount = 0;

      for (let i = 0; i < slotsToProcess.length; i++) {
        const slot = slotsToProcess[i];
        setProgressCurrent(i + 1);
        setProgressStep(`Lên lịch khung ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`);

        const { error } = await supabase
          .from('apishopee_flash_sale_auto_history')
          .insert({
            shop_id: selectedShopId,
            user_id: user.id,
            timeslot_id: slot.timeslot_id,
            status: 'scheduled',
            lead_time_minutes: leadTimeMinutes,
            scheduled_at: new Date((slot.start_time - leadTimeMinutes * 60) * 1000).toISOString(),
            slot_start_time: slot.start_time,
            slot_end_time: slot.end_time,
            items_data: itemsToAdd,
            items_count: itemsToAdd.length,
          });

        setProgressResults(prev => [...prev, {
          slotId: slot.timeslot_id,
          status: error ? 'error' : 'success',
          message: error?.message,
        }]);
        if (!error) insertedCount++;
      }

      setIsRunning(false);
      toast({ title: 'Đã lên lịch', description: `Đã lên lịch ${insertedCount} Flash Sale.` });
      setTimeout(() => navigate('/flash-sale/auto-setup'), 1500);
      return;
    }

    // Immediate mode
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < slotsToProcess.length; i++) {
      const slot = slotsToProcess[i];
      const slotLabel = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`;
      setProgressCurrent(i + 1);

      const { data: historyData } = await supabase
        .from('apishopee_flash_sale_auto_history')
        .insert({
          shop_id: selectedShopId,
          user_id: user.id,
          timeslot_id: slot.timeslot_id,
          status: 'processing',
          lead_time_minutes: 0,
          slot_start_time: slot.start_time,
          slot_end_time: slot.end_time,
          items_count: itemsToAdd.length,
        })
        .select()
        .single();

      const historyId = historyData?.id;

      try {
        setProgressStep(`Tạo khung ${slotLabel}`);
        const { data: createData, error: createError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: { action: 'create-flash-sale', shop_id: selectedShopId, timeslot_id: slot.timeslot_id },
        });
        if (createError) throw createError;
        if (createData?.error) throw new Error(createData.message || createData.error);

        const newFsId = createData?.response?.flash_sale_id;
        if (!newFsId) throw new Error('Không nhận được flash_sale_id');

        setProgressStep(`Thêm ${itemsToAdd.length} SP vào ${slotLabel}`);
        const { data: addData, error: addError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: { action: 'add-items', shop_id: selectedShopId, flash_sale_id: newFsId, items: itemsToAdd },
        });
        if (addError) throw addError;
        if (addData?.error) throw new Error(addData.message || addData.error);

        if (historyId) {
          await supabase.from('apishopee_flash_sale_auto_history').update({
            status: 'success', flash_sale_id: newFsId,
            items_data: itemsToAdd,
            executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq('id', historyId);
        }

        successCount++;
        setProgressResults(prev => [...prev, { slotId: slot.timeslot_id, status: 'success' }]);
      } catch (err) {
        if (historyId) {
          await supabase.from('apishopee_flash_sale_auto_history').update({
            status: 'error', error_message: (err as Error).message,
            executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq('id', historyId);
        }
        errorCount++;
        setProgressResults(prev => [...prev, { slotId: slot.timeslot_id, status: 'error', message: (err as Error).message }]);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    await triggerSync(true);
    toast({
      title: 'Hoàn tất',
      description: `Thành công: ${successCount}, Lỗi: ${errorCount}`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    // Navigate to Flash Sale list after completion
    if (successCount > 0) {
      setTimeout(() => navigate('/flash-sale'), 1500);
    }
  };

  // ==================== GUARDS ====================

  if (shopsLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner className="h-8 w-8" /></div>;
  }

  if (!selectedShopId || !user?.id) {
    return (
      <Alert>
        <Store className="h-4 w-4" />
        <AlertDescription>Vui lòng chọn shop để sao chép Flash Sale.</AlertDescription>
      </Alert>
    );
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flash-sale')} className="cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Sao chép Flash Sale</h1>
            {sourceFlashSaleTime && (
              <p className="text-sm text-muted-foreground">
                Từ khung {formatTime(sourceFlashSaleTime.start)} {formatDate(sourceFlashSaleTime.start)} - {formatTime(sourceFlashSaleTime.end)}
                {' '}&middot; FS #{flashSaleId}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Banner cảnh báo phân loại bị loại bỏ tự động */}
      {exclusionReasons.size > 0 && !loadingTemplate && !loadingCriteria && (
        <div className="flex-shrink-0 px-6 pt-3">
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{exclusionReasons.size}</strong> phân loại bị tự động loại:{' '}
                {[
                  countByReason('no_stock') > 0 && `${countByReason('no_stock')} hết hàng`,
                  countByReason('criteria_fail') > 0 && `${countByReason('criteria_fail')} chưa đạt tiêu chí`,
                  countByReason('disabled') > 0 && `${countByReason('disabled')} bị vô hiệu`,
                  countByReason('no_price') > 0 && `${countByReason('no_price')} chưa có giá`,
                ].filter(Boolean).join(', ')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={restoreAllExcluded}
                className="cursor-pointer flex-shrink-0 border-amber-500/50 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                Bỏ loại tất cả
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">

          {/* Basic Info */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Thông tin cơ bản</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Gian hàng */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Gian hàng <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2 text-sm font-medium h-9 px-3 border rounded-md bg-background">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {currentShop?.shop_name || `Shop #${selectedShopId}`}
                  </div>
                </div>

                {/* Thời gian tự động cài */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Thời gian tự động cài</Label>
                  <Select value={leadTimeMinutes.toString()} onValueChange={v => setLeadTimeMinutes(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Tạo ngay lập tức</SelectItem>
                      <SelectItem value="10">10 phút trước</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Khung giờ */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-muted-foreground text-xs">Khung giờ <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Selected slots preview */}
                    {selectedSlots.size > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {timeSlots.filter(s => selectedSlots.has(s.timeslot_id)).slice(0, 5).map(slot => (
                          <span key={slot.timeslot_id} className="inline-flex items-center gap-1 px-2 py-1 bg-info/10 text-info text-xs rounded-md border border-info">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)} {formatDate(slot.start_time)}
                            <button
                              onClick={() => toggleSlot(slot.timeslot_id)}
                              className="ml-0.5 text-blue-400 hover:text-info cursor-pointer"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {selectedSlots.size > 5 && (
                          <span className="text-xs text-muted-foreground">+{selectedSlots.size - 5} khung giờ khác</span>
                        )}
                      </div>
                    )}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setShowSlotPicker(true)}
                      className="cursor-pointer text-xs"
                    >
                      + Chọn khung giờ
                    </Button>
                  </div>

                  {/* Slot Picker Dialog */}
                  <Dialog open={showSlotPicker} onOpenChange={setShowSlotPicker}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                          <span>Chọn khung giờ</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setSelectedSlots(new Set(timeSlots.map(s => s.timeslot_id)))}
                              disabled={selectedSlots.size === timeSlots.length}
                              className="h-7 text-xs cursor-pointer"
                            >
                              Chọn tất cả
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setSelectedSlots(new Set())}
                              disabled={selectedSlots.size === 0}
                              className="h-7 text-xs cursor-pointer"
                            >
                              Bỏ chọn
                            </Button>
                            <Button variant="ghost" size="sm" onClick={fetchTimeSlots} disabled={loadingSlots} className="h-7 px-2 cursor-pointer">
                              <RefreshCw className={cn("h-3 w-3", loadingSlots && "animate-spin")} />
                            </Button>
                          </div>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
                        {loadingSlots ? (
                          <div className="flex items-center justify-center py-8">
                            <Spinner className="h-5 w-5" />
                          </div>
                        ) : timeSlots.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <CalendarIcon className="h-8 w-8 mb-2" />
                            <p className="text-sm">Không có khung giờ khả dụng</p>
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
                                    className="px-4 py-2 bg-background text-xs font-medium text-muted-foreground sticky top-0 flex items-center gap-2 cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleDateSlots(date)}
                                  >
                                    <Checkbox
                                      checked={allSelected}
                                      className={cn("border-border", someSelected && !allSelected && "data-[state=unchecked]:bg-muted")}
                                      onClick={e => e.stopPropagation()}
                                      onCheckedChange={() => toggleDateSlots(date)}
                                    />
                                    <span>{date}</span>
                                    <span className="text-muted-foreground ml-auto">({slots.length} khung giờ)</span>
                                  </div>
                                  <div className="divide-y">
                                    {slots.map(slot => (
                                      <div key={slot.timeslot_id} className="px-4 py-2 flex items-center gap-2 hover:bg-background cursor-pointer" onClick={() => toggleSlot(slot.timeslot_id)}>
                                        <Checkbox
                                          checked={selectedSlots.has(slot.timeslot_id)}
                                          onCheckedChange={() => toggleSlot(slot.timeslot_id)}
                                          onClick={e => e.stopPropagation()}
                                          className="border-border"
                                        />
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-sm">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                                        <span className="text-xs text-muted-foreground ml-auto">{formatDate(slot.start_time)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <span className="text-xs text-muted-foreground mr-auto">
                          Đã chọn {selectedSlots.size}/{timeSlots.length} khung giờ
                        </span>
                        <Button onClick={() => setShowSlotPicker(false)} className="cursor-pointer">
                          Xong
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Table */}
          {loadingTemplate ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center">
                <Spinner className="h-6 w-6" />
              </CardContent>
            </Card>
          ) : templateItems.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Không có sản phẩm mẫu. Cần có Flash Sale với sản phẩm đang bật.</AlertDescription>
            </Alert>
          ) : (
            <ProductTable
              items={templateItems}
              excludedItems={excludedItems}
              excludedModels={excludedModels}
              onToggleItem={toggleItem}
              onToggleModel={toggleModel}
              isModelExcluded={isModelExcluded}
              criteria={criteria}
              loadingCriteria={loadingCriteria}
              failedModels={failedModels}
              itemEdits={itemEdits}
              onEditModel={updateModelEdit}
              getEffectiveValues={getEffectiveValues}
            />
          )}

          {/* Progress Results */}
          {progressResults.length > 0 && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <h2 className="font-semibold text-foreground">Kết quả</h2>
                {isRunning && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{progressStep}</span>
                      <span className="text-muted-foreground">{progressCurrent}/{timeSlots.filter(s => selectedSlots.has(s.timeslot_id)).length}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${(progressCurrent / Math.max(1, timeSlots.filter(s => selectedSlots.has(s.timeslot_id)).length)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                  {progressResults.map((result, idx) => {
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="flex-shrink-0 border-t bg-card px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/flash-sale')} disabled={isRunning} className="cursor-pointer">
          Hủy
        </Button>
        <Button
          onClick={runSetup}
          disabled={selectedSlots.size === 0 || activeItemCount === 0 || isRunning}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 cursor-pointer"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Đang xử lý... {progressCurrent}/{timeSlots.filter(s => selectedSlots.has(s.timeslot_id)).length}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {leadTimeMinutes > 0 ? 'Lên lịch' : 'Tạo ngay'} ({selectedSlots.size} khung giờ)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ==================== CRITERIA HELPERS ====================

function checkModelCriteria(criteria: CriteriaData | null, discount: number, campaignStock: number): { pass: boolean; reasons: string[] } {
  if (!criteria) return { pass: true, reasons: [] };
  const reasons: string[] = [];

  if (criteria.min_discount && criteria.min_discount > 0 && discount < criteria.min_discount) {
    reasons.push(`Giảm tối thiểu ${criteria.min_discount}% (hiện ${discount}%)`);
  }
  if (criteria.max_discount && criteria.max_discount > 0 && discount > criteria.max_discount) {
    reasons.push(`Giảm tối đa ${criteria.max_discount}% (hiện ${discount}%)`);
  }
  if (criteria.min_promo_stock && criteria.min_promo_stock > 0 && campaignStock < criteria.min_promo_stock) {
    reasons.push(`Tồn kho CT tối thiểu ${criteria.min_promo_stock} (hiện ${campaignStock})`);
  }
  if (criteria.max_promo_stock && criteria.max_promo_stock > 0 && campaignStock > criteria.max_promo_stock) {
    reasons.push(`Tồn kho CT tối đa ${criteria.max_promo_stock} (hiện ${campaignStock})`);
  }

  return { pass: reasons.length === 0, reasons };
}

// ==================== PRODUCT TABLE ====================

interface ProductTableProps {
  items: FlashSaleItem[];
  excludedItems: Set<number>;
  excludedModels: Set<string>;
  onToggleItem: (itemId: number) => void;
  onToggleModel: (itemId: number, modelId: number) => void;
  isModelExcluded: (itemId: number, modelId: number) => boolean;
  criteria: CriteriaData | null;
  loadingCriteria: boolean;
  failedModels: Set<string>;
  itemEdits: Map<string, { promoPrice?: number; campaignStock?: number }>;
  onEditModel: (itemId: number, modelId: number, field: 'promoPrice' | 'campaignStock', value: number) => void;
  getEffectiveValues: (itemId: number, modelId: number, origPromo: number, origStock: number) => { promoPrice: number; campaignStock: number };
}

function ProductTable({ items, excludedItems, excludedModels: _excludedModels, onToggleItem, onToggleModel, isModelExcluded, criteria, loadingCriteria, failedModels, itemEdits: _itemEdits, onEditModel, getEffectiveValues }: ProductTableProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const activeCount = items.filter(i => !excludedItems.has(i.item_id)).length;

  return (
    <Card>
      <CardContent className="p-0">
        {/* Criteria details */}
        {loadingCriteria && (
          <div className="px-4 py-3 bg-background border-b flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="h-3 w-3" /> Đang kiểm tra tiêu chí Flash Sale...
          </div>
        )}
        {criteria && (
          <div className="px-4 py-3 bg-info/10/70 border-b space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-info">
              <AlertCircle className="h-3.5 w-3.5" />
              Tiêu chí tham gia Flash Sale
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
              {criteria.min_discount != null && criteria.min_discount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Giảm giá tối thiểu:</span>
                  <span className="font-medium text-info">{criteria.min_discount}%</span>
                </div>
              )}
              {criteria.max_discount != null && criteria.max_discount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Giảm giá tối đa:</span>
                  <span className="font-medium text-info">{criteria.max_discount}%</span>
                </div>
              )}
              {criteria.min_promo_stock != null && criteria.min_promo_stock > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tồn kho CT tối thiểu:</span>
                  <span className="font-medium text-info">{criteria.min_promo_stock}</span>
                </div>
              )}
              {criteria.max_promo_stock != null && criteria.max_promo_stock > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tồn kho CT tối đa:</span>
                  <span className="font-medium text-info">{criteria.max_promo_stock}</span>
                </div>
              )}
              {criteria.min_product_rating != null && criteria.min_product_rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Rating tối thiểu:</span>
                  <span className="font-medium text-info">{criteria.min_product_rating}</span>
                </div>
              )}
              {criteria.min_order_total != null && criteria.min_order_total > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Đơn hàng 30 ngày:</span>
                  <span className="font-medium text-info">≥{criteria.min_order_total}</span>
                </div>
              )}
              {criteria.min_repetition_day != null && criteria.min_repetition_day > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Không lặp trong:</span>
                  <span className="font-medium text-info">{criteria.min_repetition_day} ngày</span>
                </div>
              )}
              {criteria.max_days_to_ship != null && criteria.max_days_to_ship > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Giao tối đa:</span>
                  <span className="font-medium text-info">{criteria.max_days_to_ship} ngày</span>
                </div>
              )}
              {criteria.need_lowest_price && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Giá thấp nhất 7 ngày:</span>
                  <span className="font-medium text-warning">Bắt buộc</span>
                </div>
              )}
              {criteria.must_not_pre_order && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Hàng Pre-Order:</span>
                  <span className="font-medium text-warning">Không được</span>
                </div>
              )}
            </div>
            {failedModels.size > 0 && (
              <div className="text-xs text-warning flex items-center gap-1.5 pt-1">
                <XCircle className="h-3.5 w-3.5" />
                {failedModels.size} phân loại chưa đạt tiêu chí — đã tự động tắt
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-2 bg-background/80 border-b flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{activeCount}/{items.length} sản phẩm được chọn</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead className="bg-background border-b sticky top-0 z-10">
              <tr>
                <th className="h-11 px-4 text-left font-medium text-muted-foreground text-xs">Thông tin sản phẩm</th>
                <th className="h-11 px-3 text-right font-medium text-muted-foreground text-xs">Giá gốc</th>
                <th className="h-11 px-3 text-right font-medium text-muted-foreground text-xs">Giá khuyến mãi</th>
                <th className="h-11 px-3 text-center font-medium text-muted-foreground text-xs">Chiết khấu</th>
                <th className="h-11 px-3 text-center font-medium text-muted-foreground text-xs">Tồn kho CT</th>
                <th className="h-11 px-3 text-center font-medium text-muted-foreground text-xs">Tồn kho KD/Tổng</th>
                <th className="h-11 px-3 text-center font-medium text-muted-foreground text-xs">Giới hạn ĐH</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <ProductRow
                  key={item.item_id}
                  item={item}
                  expanded={expandedItems.has(item.item_id)}
                  onToggleExpand={() => toggleExpand(item.item_id)}
                  isItemExcluded={excludedItems.has(item.item_id)}
                  onToggleItem={() => onToggleItem(item.item_id)}
                  onToggleModel={onToggleModel}
                  isModelExcluded={isModelExcluded}
                  criteria={criteria}
                  failedModels={failedModels}
                  onEditModel={onEditModel}
                  getEffectiveValues={getEffectiveValues}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductRow({ item, expanded, onToggleExpand, isItemExcluded, onToggleItem, onToggleModel, isModelExcluded, criteria, failedModels, onEditModel, getEffectiveValues }: {
  item: FlashSaleItem;
  expanded: boolean;
  onToggleExpand: () => void;
  isItemExcluded: boolean;
  onToggleItem: () => void;
  onToggleModel: (itemId: number, modelId: number) => void;
  isModelExcluded: (itemId: number, modelId: number) => boolean;
  criteria: CriteriaData | null;
  failedModels: Set<string>;
  onEditModel: (itemId: number, modelId: number, field: 'promoPrice' | 'campaignStock', value: number) => void;
  getEffectiveValues: (itemId: number, modelId: number, origPromo: number, origStock: number) => { promoPrice: number; campaignStock: number };
}) {
  const hasModels = item.models && item.models.length > 0;
  const modelsToShow = expanded ? item.models : item.models?.slice(0, 5);
  const itemImage = getItemImage(item);

  return (
    <>
      {/* Item Header */}
      <tr className={cn("border-b bg-background/50", isItemExcluded && "opacity-40")}>
        <td colSpan={7} className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={!isItemExcluded}
              onCheckedChange={onToggleItem}
              className="flex-shrink-0"
            />
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {itemImage ? (
                <ImageWithZoom
                  src={itemImage}
                  alt={item.item_name || `Item #${item.item_id}`}
                  className="w-full h-full object-cover"
                  zoomSize={280}
                />
              ) : (
                <div className="w-8 h-8 bg-muted rounded" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground truncate block">
                {item.item_name || `Item #${item.item_id}`}
              </span>
              <span className="text-xs text-muted-foreground">Item ID: {item.item_id}</span>
            </div>
          </div>
        </td>
      </tr>

      {/* Model Rows or Single Item */}
      {hasModels ? (
        <>
          {modelsToShow?.map(model => {
            const origPromo = model.input_promotion_price || model.promotion_price_with_tax || 0;
            const origStock = model.campaign_stock ?? 0;
            const { promoPrice: effPromo, campaignStock: effStock } = getEffectiveValues(item.item_id, model.model_id, origPromo, origStock);
            const discount = calcDiscount(model.original_price, effPromo);
            const modelPurchaseLimit = model.purchase_limit ?? item.purchase_limit;
            const modelKey = `${item.item_id}:${model.model_id}`;
            const isFailed = failedModels.has(modelKey);
            const excluded = isItemExcluded || isModelExcluded(item.item_id, model.model_id);
            const criteriaCheck = checkModelCriteria(criteria, discount, effStock);
            const isEdited = effPromo !== origPromo || effStock !== origStock;
            const noStock = (model.stock ?? 0) === 0;

            return (
              <tr key={model.model_id} className={cn("border-b hover:bg-background/50", (excluded || isFailed) && "opacity-40", noStock && !excluded && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 pl-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-shrink-0">
                            <Checkbox
                              checked={!excluded}
                              onCheckedChange={() => {
                                if (!isFailed) onToggleModel(item.item_id, model.model_id);
                              }}
                              disabled={isItemExcluded || isFailed}
                              className={cn(
                                isFailed && "opacity-50 cursor-not-allowed",
                                noStock && !isFailed && "cursor-pointer"
                              )}
                            />
                          </span>
                        </TooltipTrigger>
                        {isFailed && (
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs font-medium mb-1">Chưa đạt tiêu chí:</p>
                            <ul className="text-xs space-y-0.5">
                              {criteriaCheck.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                            </ul>
                          </TooltipContent>
                        )}
                        {noStock && !isFailed && (
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">Hết hàng (stock = 0). Bấm để thêm lại với stock mặc định = 1.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <div className="min-w-0">
                      <span className="text-sm text-muted-foreground truncate block">
                        {model.model_name || `SKU #${model.model_id}`}
                      </span>
                      {isFailed && (
                        <span className="text-[10px] text-warning truncate block">
                          {criteriaCheck.reasons[0]}
                        </span>
                      )}
                      {noStock && !isFailed && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 truncate block">
                          Hết hàng — stock sẽ đặt = 1
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground text-right">{formatPrice(model.original_price)}</td>
                <td className="px-3 py-1">
                  <Input
                    type="number"
                    value={effPromo}
                    onChange={e => onEditModel(item.item_id, model.model_id, 'promoPrice', Number(e.target.value))}
                    disabled={excluded}
                    className={cn(
                      "h-8 text-sm text-right w-full font-medium",
                      excluded && "bg-muted cursor-not-allowed",
                      isEdited && effPromo !== origPromo ? "border-info bg-info/10/50" : "",
                      !criteriaCheck.pass ? "border-warning" : ""
                    )}
                    min={0}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {discount > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 text-xs font-medium rounded border",
                      !criteriaCheck.pass && !excluded
                        ? "text-warning border-warning bg-warning/10"
                        : "text-brand border-brand"
                    )}>-{discount}%</span>
                  )}
                </td>
                <td className="px-3 py-1">
                  <Input
                    type="number"
                    value={effStock}
                    onChange={e => onEditModel(item.item_id, model.model_id, 'campaignStock', Number(e.target.value))}
                    disabled={excluded}
                    className={cn(
                      "h-8 text-sm text-center w-full font-medium text-brand",
                      excluded && "bg-muted cursor-not-allowed text-muted-foreground",
                      isEdited && effStock !== origStock ? "border-info bg-info/10/50" : "",
                      !criteriaCheck.pass ? "border-warning" : ""
                    )}
                    min={1}
                  />
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground text-center">{model.stock ?? 0}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground text-center">{modelPurchaseLimit > 0 ? modelPurchaseLimit : '-'}</td>
              </tr>
            );
          })}
          {item.models && item.models.length > 5 && (
            <tr className="border-b">
              <td colSpan={7} className="px-4 py-2">
                <button onClick={onToggleExpand} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer pl-12">
                  {expanded ? (
                    <>Thu gọn <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Hiển thị toàn bộ {item.models.length} phân loại hàng <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              </td>
            </tr>
          )}
        </>
      ) : (() => {
        const origPromo = item.input_promotion_price || item.promotion_price_with_tax || 0;
        const origStock = item.campaign_stock ?? 0;
        const { promoPrice: effPromo, campaignStock: effStock } = getEffectiveValues(item.item_id, 0, origPromo, origStock);
        const discount = calcDiscount(item.original_price, effPromo);
        return (
          <tr className={cn("border-b hover:bg-background/50", isItemExcluded && "opacity-40")}>
            <td className="px-4 py-2.5"><span className="text-sm text-muted-foreground pl-12">-</span></td>
            <td className="px-3 py-2.5 text-sm text-muted-foreground text-right">{formatPrice(item.original_price)}</td>
            <td className="px-3 py-1">
              <Input
                type="number"
                value={effPromo}
                onChange={e => onEditModel(item.item_id, 0, 'promoPrice', Number(e.target.value))}
                className={cn(
                  "h-8 text-sm text-right w-full font-medium",
                  effPromo !== origPromo ? "border-info bg-info/10/50" : ""
                )}
                min={0}
              />
            </td>
            <td className="px-3 py-2.5 text-center">
              {discount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-brand border border-brand rounded">
                  -{discount}%
                </span>
              )}
            </td>
            <td className="px-3 py-1">
              <Input
                type="number"
                value={effStock}
                onChange={e => onEditModel(item.item_id, 0, 'campaignStock', Number(e.target.value))}
                className={cn(
                  "h-8 text-sm text-center w-full font-medium text-brand",
                  effStock !== origStock ? "border-info bg-info/10/50" : ""
                )}
                min={0}
              />
            </td>
            <td className="px-3 py-2.5 text-sm text-muted-foreground text-center">{item.stock ?? 0}</td>
            <td className="px-3 py-2.5 text-sm text-muted-foreground text-center">{item.purchase_limit > 0 ? item.purchase_limit : '-'}</td>
          </tr>
        );
      })()}
    </>
  );
}
