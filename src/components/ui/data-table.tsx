
import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ============================================
// Helper Cell Components (for legacy DataTable usage)
// ============================================

interface CellShopInfoProps {
  logo?: string | null;
  name: string;
  shopId?: number;
  region?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function CellShopInfo({ logo, name, shopId, region, onRefresh, refreshing }: CellShopInfoProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {logo ? (
          <img src={logo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{name}</p>
          {onRefresh && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={refreshing}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <svg className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {region}{region && shopId && ' - '}{shopId && <span className="font-mono text-muted-foreground">{shopId}</span>}
        </p>
      </div>
    </div>
  );
}

interface CellBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function CellBadge({ children, variant = 'default' }: CellBadgeProps) {
  const variantClasses = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", variantClasses[variant])}>
      {children}
    </span>
  );
}

interface CellTextProps {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  className?: string;
}

export function CellText({ children, mono, muted, className }: CellTextProps) {
  return (
    <span className={cn(
      "text-sm",
      mono && "font-mono",
      muted ? "text-muted-foreground" : "text-foreground",
      className
    )}>
      {children}
    </span>
  );
}

interface CellActionsProps {
  children: React.ReactNode;
}

export function CellActions({ children }: CellActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {children}
    </div>
  );
}

// ============================================
// Simple DataTable (Legacy API for backward compatibility)
// ============================================

interface SimpleColumn<TData> {
  key: string;
  header: string;
  width?: string;
  render: (item: TData) => React.ReactNode;
  /** Hide this column on mobile (shown in card view) */
  hideOnMobile?: boolean;
  /** Show this column as primary info in mobile card header */
  mobileHeader?: boolean;
  /** Show this column as badge/tag in mobile card */
  mobileBadge?: boolean;
}

interface SimpleDataTableProps<TData> {
  columns: SimpleColumn<TData>[];
  data: TData[];
  keyExtractor: (item: TData) => string | number;
  emptyMessage?: string;
  emptyDescription?: string;
  loading?: boolean;
  loadingMessage?: string;
  /** Enable mobile card view (default: true) */
  mobileCardView?: boolean;
}

export function SimpleDataTable<TData>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "Không có dữ liệu",
  emptyDescription,
  loading = false,
  loadingMessage = "Đang tải...",
  mobileCardView = true,
}: SimpleDataTableProps<TData>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Get column groups for mobile view
  const headerColumn = columns.find(col => col.mobileHeader);
  const badgeColumn = columns.find(col => col.mobileBadge);
  const actionColumn = columns.find(col => col.key === 'actions');

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground">{emptyMessage}</p>
          {emptyDescription && (
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className={cn("overflow-x-auto", mobileCardView && "hidden md:block")}>
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="h-11 px-4 text-left align-middle font-medium text-muted-foreground text-sm whitespace-nowrap"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-border transition-colors hover:bg-accent"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 align-middle text-sm">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      {mobileCardView && (
        <div className="md:hidden divide-y">
          {data.map((item) => (
            <div key={keyExtractor(item)} className="p-4 space-y-3">
              {/* Card Header: Primary info + Badge + Actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {headerColumn && headerColumn.render(item)}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {badgeColumn && badgeColumn.render(item)}
                </div>
              </div>

              {/* Card Actions */}
              {actionColumn && (
                <div className="flex justify-end pt-2 border-t border-border">
                  {actionColumn.render(item)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// TanStack DataTable (Advanced features)
// ============================================

export interface DataTablePaginationInfo {
  pageIndex: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  previousPage: () => void;
  nextPage: () => void;
  setPageIndex: (index: number) => void;
  totalRows: number;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  showColumnToggle?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  /** Callback to expose pagination info externally */
  onPaginationChange?: (info: DataTablePaginationInfo) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Tìm kiếm...",
  pageSize = 20,
  showColumnToggle = false,
  showSearch = false,
  showPagination = true,
  emptyMessage = "Không có dữ liệu",
  loading = false,
  loadingMessage = "Đang tải...",
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Expose pagination info to parent - use ref to avoid infinite loops
  const tableRef = React.useRef(table);
  tableRef.current = table;

  const stablePreviousPage = React.useCallback(() => tableRef.current.previousPage(), []);
  const stableNextPage = React.useCallback(() => tableRef.current.nextPage(), []);
  const stableSetPageIndex = React.useCallback((index: number) => tableRef.current.setPageIndex(index), []);

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  React.useEffect(() => {
    if (onPaginationChange) {
      onPaginationChange({
        pageIndex,
        pageCount,
        canPreviousPage: pageIndex > 0,
        canNextPage: pageIndex < pageCount - 1,
        previousPage: stablePreviousPage,
        nextPage: stableNextPage,
        setPageIndex: stableSetPageIndex,
        totalRows,
      });
    }
  }, [pageIndex, pageCount, totalRows, onPaginationChange, stablePreviousPage, stableNextPage, stableSetPageIndex]);

  return (
    <div className="w-full">
      {/* Toolbar */}
      {(showSearch || showColumnToggle) && (
        <div className="flex items-center justify-between py-3 px-4 border-b border-border bg-muted/50">
          {showSearch && searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className="max-w-sm h-9 bg-card"
            />
          )}
          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto">
                  Cột hiển thị <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full">
          {/* Fixed Header */}
          <thead className="bg-muted border-b border-border sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      className="h-11 px-4 text-left align-middle font-medium text-muted-foreground text-sm whitespace-nowrap"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span className="ml-1">
                              {{
                                asc: <ChevronUp className="h-4 w-4" />,
                                desc: <ChevronDown className="h-4 w-4" />,
                              }[header.column.getIsSorted() as string] ?? (
                                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          {/* Body with loading state */}
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="h-48">
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">{loadingMessage}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-border transition-colors hover:bg-accent data-[state=selected]:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && !loading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/50">
          <div className="text-sm text-muted-foreground">
            Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            <span className="ml-2 text-muted-foreground">
              ({table.getFilteredRowModel().rows.length} kết quả)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                const pageIndex = table.getState().pagination.pageIndex;
                const pageCount = table.getPageCount();
                let pageNum: number;

                if (pageCount <= 5) {
                  pageNum = i;
                } else if (pageIndex < 3) {
                  pageNum = i;
                } else if (pageIndex > pageCount - 4) {
                  pageNum = pageCount - 5 + i;
                } else {
                  pageNum = pageIndex - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageIndex === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => table.setPageIndex(pageNum)}
                    className={cn(
                      "h-8 w-8 p-0",
                      pageIndex === pageNum && "bg-brand hover:bg-brand/90"
                    )}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
