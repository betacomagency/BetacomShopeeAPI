/**
 * Pagination component for Analytics Orders pages
 */

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (page > 3) result.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        result.push(i);
      }
      if (page < totalPages - 2) result.push('ellipsis');
      result.push(totalPages);
    }
    return result;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-slate-400">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'px-3 py-1 rounded-md text-sm cursor-pointer',
              page === p ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
