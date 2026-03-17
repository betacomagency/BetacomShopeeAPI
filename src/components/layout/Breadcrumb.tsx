/**
 * Header Bar - Mobile menu toggle + Shop Selector + Theme Toggle
 */

import { Menu, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import ShopSelector from './ShopSelector';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface BreadcrumbProps {
  onMobileMenuClick?: () => void;
}

export default function Breadcrumb({ onMobileMenuClick }: BreadcrumbProps) {
  return (
    <div className="bg-card border-b border-border px-6 h-[73px] flex items-center sticky top-0 z-30">
      <div className="flex items-center justify-between w-full gap-2">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMobileMenuClick}
          className="md:hidden p-1 -ml-2 text-muted-foreground hover:text-brand flex-shrink-0 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden md:block flex-1" />

        {/* API Docs */}
        <Link
          to="/docs"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm font-medium cursor-pointer"
          title="Tài liệu API Shopee"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">API Docs</span>
        </Link>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Shop Selector */}
        <div className="md:w-64 flex-shrink-0">
          <ShopSelector />
        </div>
      </div>
    </div>
  );
}
