/**
 * Header Bar - Mobile menu toggle + Shop Selector
 */

import { Menu } from 'lucide-react';
import ShopSelector from './ShopSelector';

interface BreadcrumbProps {
  onMobileMenuClick?: () => void;
}

export default function Breadcrumb({ onMobileMenuClick }: BreadcrumbProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 h-[73px] flex items-center sticky top-0 z-30">
      <div className="flex items-center justify-between w-full">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMobileMenuClick}
          className="md:hidden p-1 -ml-2 text-slate-500 hover:text-orange-500 flex-shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden md:block flex-1" />

        {/* Shop Selector */}
        <div className="md:w-64 flex-shrink-0">
          <ShopSelector />
        </div>
      </div>
    </div>
  );
}
