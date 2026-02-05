import * as React from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { Calendar } from "./calendar";

export type DateRangePreset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';
export type CustomMode = 'day' | 'week' | 'month' | 'year' | null;

interface DateRangePickerProps {
  dateRange: DateRangePreset;
  customMode: CustomMode;
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (preset: DateRangePreset) => void;
  onCustomModeChange: (mode: CustomMode) => void;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

const presets = [
  { value: 'today' as const, label: 'Hôm nay' },
  { value: 'yesterday' as const, label: 'Hôm qua' },
  { value: '7days' as const, label: 'Trong 7 ngày qua' },
  { value: '30days' as const, label: 'Trong 30 ngày qua' },
];

const customModes = [
  { value: 'day' as const, label: 'Theo ngày' },
  { value: 'week' as const, label: 'Theo tuần' },
  { value: 'month' as const, label: 'Theo tháng' },
  { value: 'year' as const, label: 'Theo năm' },
];

function getPresetDateRange(preset: DateRangePreset): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return { start: todayStart, end: today };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = subDays(today, 1);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { start: yesterday, end: yesterdayEnd };
    case '7days':
      const sevenDaysAgo = subDays(today, 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return { start: sevenDaysAgo, end: today };
    case '30days':
      const thirtyDaysAgo = subDays(today, 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return { start: thirtyDaysAgo, end: today };
    default:
      return { start: today, end: today };
  }
}

function formatDateRangeLabel(preset: DateRangePreset, startDate: Date, endDate: Date): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');

  switch (preset) {
    case 'today':
      return `Tới ${hours}:${minutes} hôm nay`;
    case 'yesterday':
      return format(startDate, 'dd-MM-yyyy', { locale: vi });
    case '7days':
    case '30days':
      return `${format(startDate, 'dd-MM-yyyy', { locale: vi })} - ${format(endDate, 'dd-MM-yyyy', { locale: vi })}`;
    default:
      if (startDate.getTime() === endDate.getTime()) {
        return format(startDate, 'dd-MM-yyyy', { locale: vi });
      }
      return `${format(startDate, 'dd-MM-yyyy', { locale: vi })} - ${format(endDate, 'dd-MM-yyyy', { locale: vi })}`;
  }
}

export function DateRangePicker({
  dateRange,
  customMode,
  startDate,
  endDate,
  onDateRangeChange,
  onCustomModeChange,
  onStartDateChange,
  onEndDateChange,
  disabled,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());

  const handlePresetSelect = (preset: DateRangePreset) => {
    const { start, end } = getPresetDateRange(preset);
    onDateRangeChange(preset);
    onCustomModeChange(null);
    onStartDateChange(start);
    onEndDateChange(end);
    setOpen(false);
  };

  const handleCustomModeSelect = (mode: CustomMode) => {
    onDateRangeChange('custom');
    onCustomModeChange(mode);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      onStartDateChange(start);
      onEndDateChange(end);
      setOpen(false);
    }
  };

  const handleWeekSelect = (date: Date | undefined) => {
    if (date) {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      onStartDateChange(start);
      onEndDateChange(end);
      setOpen(false);
    }
  };

  const handleMonthSelect = (month: number) => {
    const start = startOfMonth(new Date(selectedYear, month));
    const end = endOfMonth(new Date(selectedYear, month));
    onStartDateChange(start);
    onEndDateChange(end);
    setOpen(false);
  };

  const handleYearSelect = (year: number) => {
    const start = startOfYear(new Date(year, 0));
    const end = endOfYear(new Date(year, 0));
    onStartDateChange(start);
    onEndDateChange(end);
    setOpen(false);
  };

  const displayLabel = React.useMemo(() => {
    const presetLabel = presets.find(p => p.value === dateRange)?.label;
    if (presetLabel && dateRange !== 'custom') {
      return presetLabel;
    }
    if (customMode === 'day') return 'Theo ngày';
    if (customMode === 'week') return 'Theo tuần';
    if (customMode === 'month') return 'Theo tháng';
    if (customMode === 'year') return 'Theo năm';
    return 'Chọn thời gian';
  }, [dateRange, customMode]);

  const dateRangeLabel = formatDateRangeLabel(dateRange, startDate, endDate);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs md:text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          <span className="text-slate-500">Khung Thời Gian</span>
          <span className="font-medium text-slate-800">{displayLabel}</span>
          <span className="text-slate-500 hidden sm:inline">{dateRangeLabel}</span>
          <CalendarIcon className="h-4 w-4 text-slate-500 ml-1" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[200] bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in-0 zoom-in-95 overflow-hidden"
          sideOffset={5}
          align="start"
        >
          <div className="flex min-w-[400px] max-w-[600px]">
            {/* Left Panel - Presets */}
            <div className="w-[180px] border-r border-slate-100 py-2">
              {/* Preset options */}
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm transition-colors",
                    dateRange === preset.value && customMode === null
                      ? "text-orange-600 bg-orange-50"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {preset.label}
                </button>
              ))}

              <div className="border-t border-slate-100 my-2" />

              {/* Custom mode options */}
              {customModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handleCustomModeSelect(mode.value)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between",
                    customMode === mode.value
                      ? "text-orange-600 bg-orange-50"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {mode.label}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>

            {/* Right Panel - Date/Time Selection */}
            <div className="flex-1 p-3">
              {/* Show date range for presets */}
              {dateRange !== 'custom' && customMode === null && (
                <div className="flex items-center justify-center h-full">
                  <span className="text-orange-600 font-medium">
                    {dateRangeLabel}
                  </span>
                </div>
              )}

              {/* Day picker */}
              {customMode === 'day' && (
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleDaySelect}
                  disabled={(date) => date > new Date()}
                  defaultMonth={startDate}
                />
              )}

              {/* Week picker */}
              {customMode === 'week' && (
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleWeekSelect}
                  disabled={(date) => date > new Date()}
                  defaultMonth={startDate}
                />
              )}

              {/* Month picker */}
              {customMode === 'month' && (
                <div className="p-2">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setSelectedYear(y => y - 1)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-lg">{selectedYear}</span>
                    <button
                      onClick={() => setSelectedYear(y => y + 1)}
                      disabled={selectedYear >= new Date().getFullYear()}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => {
                      const isCurrentMonth = selectedYear === new Date().getFullYear() && i === new Date().getMonth();
                      const isFuture = selectedYear === new Date().getFullYear() && i > new Date().getMonth();
                      const isSelected = startDate.getFullYear() === selectedYear && startDate.getMonth() === i;

                      return (
                        <button
                          key={i}
                          onClick={() => handleMonthSelect(i)}
                          disabled={isFuture}
                          className={cn(
                            "py-3 px-2 rounded-lg text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-orange-500 text-white"
                              : isCurrentMonth
                                ? "text-orange-600 bg-orange-50"
                                : isFuture
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          Tháng {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Year picker */}
              {customMode === 'year' && (
                <div className="p-2">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setSelectedYear(y => y - 12)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-lg">
                      {selectedYear - 5} - {selectedYear + 6}
                    </span>
                    <button
                      onClick={() => setSelectedYear(y => y + 12)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => {
                      const year = selectedYear - 5 + i;
                      const isCurrentYear = year === new Date().getFullYear();
                      const isFuture = year > new Date().getFullYear();
                      const isSelected = startDate.getFullYear() === year;

                      return (
                        <button
                          key={year}
                          onClick={() => handleYearSelect(year)}
                          disabled={isFuture}
                          className={cn(
                            "py-3 px-2 rounded-lg text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-orange-500 text-white"
                              : isCurrentYear
                                ? "text-orange-600 bg-orange-50"
                                : isFuture
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Simple version for backward compatibility
interface SimpleDateRangePickerProps {
  dateRange: 'today' | '7days' | '30days';
  selectedDate: Date;
  onDateRangeChange: (range: 'today' | '7days' | '30days') => void;
  onSelectedDateChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

export function SimpleDateRangePicker({
  dateRange,
  selectedDate,
  onDateRangeChange,
  onSelectedDateChange,
  disabled,
  className,
}: SimpleDateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<'menu' | 'day' | 'month'>('menu');
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());

  // Reset view when opening
  React.useEffect(() => {
    if (open) {
      setView('menu');
    }
  }, [open]);

  const handlePresetSelect = (preset: 'today' | '7days' | '30days') => {
    onDateRangeChange(preset);
    if (preset === 'today') {
      onSelectedDateChange(new Date());
    }
    setOpen(false);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onSelectedDateChange(date);
      setOpen(false);
    }
  };

  const handleMonthSelect = (month: number) => {
    const date = endOfMonth(new Date(selectedYear, month));
    const today = new Date();
    onSelectedDateChange(date > today ? today : date);
    setOpen(false);
  };

  const displayLabel = React.useMemo(() => {
    if (dateRange === 'today') return 'Hôm nay';
    if (dateRange === '7days') return '7 ngày';
    if (dateRange === '30days') return '30 ngày';
    return 'Chọn';
  }, [dateRange]);

  const dateRangeLabel = React.useMemo(() => {
    const now = new Date();
    if (dateRange === 'today') {
      return `Tới ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} hôm nay`;
    }
    const days = dateRange === '7days' ? 6 : 29;
    const start = subDays(selectedDate, days);
    return `${format(start, 'dd/MM/yyyy')} - ${format(selectedDate, 'dd/MM/yyyy')}`;
  }, [dateRange, selectedDate]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-medium text-slate-700">{displayLabel}</span>
          <span className="text-slate-400 hidden sm:inline text-[11px]">{dateRangeLabel}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[200] bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in-0 zoom-in-95 overflow-hidden w-[280px]"
          sideOffset={5}
          align="start"
        >
          {/* Menu View */}
          {view === 'menu' && (
            <div className="py-2">
              <button
                onClick={() => handlePresetSelect('today')}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between",
                  dateRange === 'today'
                    ? "text-orange-600 bg-orange-50"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>Hôm nay</span>
                {dateRange === 'today' && (
                  <span className="text-xs text-orange-500">{dateRangeLabel}</span>
                )}
              </button>
              <button
                onClick={() => handlePresetSelect('7days')}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between",
                  dateRange === '7days'
                    ? "text-orange-600 bg-orange-50"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>7 ngày qua</span>
                {dateRange === '7days' && (
                  <span className="text-xs text-orange-500">{dateRangeLabel}</span>
                )}
              </button>
              <button
                onClick={() => handlePresetSelect('30days')}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between",
                  dateRange === '30days'
                    ? "text-orange-600 bg-orange-50"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>30 ngày qua</span>
                {dateRange === '30days' && (
                  <span className="text-xs text-orange-500">{dateRangeLabel}</span>
                )}
              </button>

              <div className="border-t border-slate-100 my-2" />

              <button
                onClick={() => setView('day')}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <span>Theo ngày</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => setView('month')}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <span>Theo tháng</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {/* Day Picker View */}
          {view === 'day' && (
            <div>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setView('menu')}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium">Chọn ngày</span>
              </div>
              <div className="p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDaySelect}
                  disabled={(date) => date > new Date()}
                  defaultMonth={selectedDate}
                />
              </div>
            </div>
          )}

          {/* Month Picker View */}
          {view === 'month' && (
            <div>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setView('menu')}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium">Chọn tháng</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-1.5 hover:bg-slate-100 rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold">{selectedYear}</span>
                  <button
                    onClick={() => setSelectedYear(y => y + 1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                    className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const isFuture = selectedYear === new Date().getFullYear() && i > new Date().getMonth();
                    const isSelected = selectedDate.getFullYear() === selectedYear && selectedDate.getMonth() === i;

                    return (
                      <button
                        key={i}
                        onClick={() => handleMonthSelect(i)}
                        disabled={isFuture}
                        className={cn(
                          "py-2.5 px-2 rounded-lg text-sm font-medium transition-colors",
                          isSelected
                            ? "bg-orange-500 text-white"
                            : isFuture
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        Th {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ==================== ANALYTICS DATE RANGE PICKER ====================

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
}

export type AnalyticsPreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

interface AnalyticsDateRangePickerProps {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
  className?: string;
}

const ANALYTICS_PRESETS: { value: AnalyticsPreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'this_week', label: 'Tuần này' },
  { value: 'last_week', label: 'Tuần trước' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
];

const ANALYTICS_MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const ANALYTICS_DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getAnalyticsPresetRange(preset: AnalyticsPreset): AnalyticsDateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { from: new Date(today), to: new Date(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: new Date(yesterday) };
    }
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - diffToMonday);
      return { from: monday, to: new Date(today) };
    }
    case 'last_week': {
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(today);
      thisMonday.setDate(thisMonday.getDate() - diffToMonday);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastMonday.getDate() - 6);
      return { from: lastMonday, to: lastSunday };
    }
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: firstDay, to: lastDay };
    }
    case 'last_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: firstDay, to: lastDay };
    }
    default:
      return { from: new Date(today), to: new Date(today) };
  }
}

function formatAnalyticsDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isSameDayAnalytics(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isInRangeAnalytics(date: Date, from: Date, to: Date): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return d >= f && d <= t;
}

interface AnalyticsCalendarProps {
  rangeFrom: Date;
  rangeTo: Date;
  onDateClick: (date: Date) => void;
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

function AnalyticsCalendarGrid({ rangeFrom, rangeTo, onDateClick, month, year, onMonthChange, onYearChange }: AnalyticsCalendarProps) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days: (Date | null)[] = [];

  for (let i = 0; i < startDay; i++) {
    const prevDate = new Date(year, month, -startDay + i + 1);
    days.push(prevDate);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    years.push(y);
  }

  return (
    <div className="w-[240px]">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => {
            if (month === 0) {
              onMonthChange(11);
              onYearChange(year - 1);
            } else {
              onMonthChange(month - 1);
            }
          }}
          className="p-1 hover:bg-slate-100 rounded cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>

        <div className="flex items-center gap-1">
          <select
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ANALYTICS_MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            if (month === 11) {
              onMonthChange(0);
              onYearChange(year + 1);
            } else {
              onMonthChange(month + 1);
            }
          }}
          className="p-1 hover:bg-slate-100 rounded cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-1">
        {ANALYTICS_DAY_NAMES.map((day) => (
          <div key={day} className="text-center text-xs text-slate-500 font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {days.map((date, i) => {
          if (!date) return <div key={i} />;

          const isCurrentMonth = date.getMonth() === month;
          const isRangeStart = isSameDayAnalytics(date, rangeFrom);
          const isRangeEnd = isSameDayAnalytics(date, rangeTo);
          const inRange = isInRangeAnalytics(date, rangeFrom, rangeTo);
          const isToday = isSameDayAnalytics(date, new Date());

          return (
            <button
              key={i}
              onClick={() => onDateClick(date)}
              className={cn(
                'w-8 h-7 text-xs cursor-pointer transition-colors',
                !isCurrentMonth && 'text-slate-300',
                isCurrentMonth && !inRange && 'text-slate-700 hover:bg-slate-100',
                inRange && !isRangeStart && !isRangeEnd && 'bg-blue-50 text-blue-700',
                (isRangeStart || isRangeEnd) && 'bg-blue-500 text-white rounded',
                isToday && !isRangeStart && !isRangeEnd && 'font-bold border border-blue-300 rounded'
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsDateRangePicker({ value, onChange, className }: AnalyticsDateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempFrom, setTempFrom] = React.useState(value.from);
  const [tempTo, setTempTo] = React.useState(value.to);
  const [selectingStart, setSelectingStart] = React.useState(true);
  const [leftMonth, setLeftMonth] = React.useState(value.from.getMonth());
  const [leftYear, setLeftYear] = React.useState(value.from.getFullYear());
  const [rightMonth, setRightMonth] = React.useState(value.to.getMonth());
  const [rightYear, setRightYear] = React.useState(value.to.getFullYear());

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    setTempFrom(value.from);
    setTempTo(value.to);
    setLeftMonth(value.from.getMonth());
    setLeftYear(value.from.getFullYear());
    setRightMonth(value.to.getMonth());
    setRightYear(value.to.getFullYear());
  }, [value]);

  const handlePresetClick = React.useCallback((preset: AnalyticsPreset) => {
    const range = getAnalyticsPresetRange(preset);
    setTempFrom(range.from);
    setTempTo(range.to);
    setLeftMonth(range.from.getMonth());
    setLeftYear(range.from.getFullYear());
    setRightMonth(range.to.getMonth());
    setRightYear(range.to.getFullYear());
  }, []);

  const handleDateClick = React.useCallback((date: Date) => {
    if (selectingStart) {
      setTempFrom(date);
      setTempTo(date);
      setSelectingStart(false);
    } else {
      if (date < tempFrom) {
        setTempFrom(date);
        setTempTo(tempFrom);
      } else {
        setTempTo(date);
      }
      setSelectingStart(true);
    }
  }, [selectingStart, tempFrom]);

  const handleApply = React.useCallback(() => {
    onChange({ from: tempFrom, to: tempTo });
    setOpen(false);
  }, [onChange, tempFrom, tempTo]);

  const displayText = `${formatAnalyticsDate(value.from)} - ${formatAnalyticsDate(value.to)}`;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="text-xs text-slate-500 mb-1">Thời gian</div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer bg-white min-w-[180px]"
      >
        <span className="text-slate-700">{displayText}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex">
          {/* Preset options */}
          <div className="border-r border-slate-200 py-2 min-w-[100px]">
            {ANALYTICS_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendars */}
          <div className="p-3">
            {/* Date inputs */}
            <div className="flex gap-3 mb-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Từ ngày</div>
                <input
                  type="text"
                  value={formatAnalyticsDate(tempFrom)}
                  readOnly
                  className="w-[110px] px-2 py-1.5 text-sm border border-slate-200 rounded bg-slate-50"
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Đến ngày</div>
                <input
                  type="text"
                  value={formatAnalyticsDate(tempTo)}
                  readOnly
                  className="w-[110px] px-2 py-1.5 text-sm border border-slate-200 rounded bg-slate-50"
                />
              </div>
            </div>

            {/* Two calendars */}
            <div className="flex gap-3">
              <AnalyticsCalendarGrid
                rangeFrom={tempFrom}
                rangeTo={tempTo}
                onDateClick={handleDateClick}
                month={leftMonth}
                year={leftYear}
                onMonthChange={setLeftMonth}
                onYearChange={setLeftYear}
              />
              <AnalyticsCalendarGrid
                rangeFrom={tempFrom}
                rangeTo={tempTo}
                onDateClick={handleDateClick}
                month={rightMonth}
                year={rightYear}
                onMonthChange={setRightMonth}
                onYearChange={setRightYear}
              />
            </div>

            {/* Apply button */}
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={handleApply}
                className="px-4 py-1.5 bg-teal-600 text-white text-sm font-medium rounded hover:bg-teal-700 transition-colors cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { getAnalyticsPresetRange };
