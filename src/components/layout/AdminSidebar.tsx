/**
 * AdminSidebar - Sidebar riêng cho Admin Panel
 * Layout matching với Sidebar chính, accent màu info (blue)
 */

import { useEffect } from 'react';
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, ArrowLeft } from 'lucide-react';
import { adminMenuItems } from '@/config/admin-menu-config';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function AdminSidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleLeafClick = () => {
    if (window.innerWidth < 768 && onMobileClose) {
      onMobileClose();
    }
  };

  // Khóa scroll body khi sidebar mở trên mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-dvh bg-sidebar transition-all duration-300 z-50 flex flex-col',
          'border-r border-sidebar-border/50',
          collapsed ? 'md:w-[72px]' : 'md:w-[260px]',
          'w-[260px]',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo Section */}
        <Link
          to="/admin"
          className={cn(
            'flex items-center gap-3 h-[72px]',
            'hover:bg-sidebar-hover transition-colors cursor-pointer group',
            collapsed ? 'px-4 justify-center' : 'px-5'
          )}
        >
          <img
            src="/logo_betacom.png"
            alt="BETACOM"
            className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
          />
          <h1 className={cn(
            'font-bold text-lg text-destructive tracking-tight transition-all duration-300',
            collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
          )}>
            Betacom Admin
          </h1>
        </Link>

        {/* Menu Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          {adminMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-info/10 text-info'
                    : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground',
                  collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                )}
                onClick={handleLeafClick}
              >
                <div className={cn(
                  'flex items-center justify-center rounded-lg transition-colors',
                  isActive ? 'text-info' : 'text-sidebar-muted group-hover:text-foreground',
                  collapsed ? '' : 'w-8 h-8'
                )}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span className={cn(
                  'font-medium text-sm whitespace-nowrap transition-all duration-300',
                  isActive ? 'text-info' : '',
                  collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                )}>
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Back to User Pages button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              handleLeafClick();
              navigate('/dashboard');
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
              'text-sidebar-foreground hover:bg-info/10 hover:text-info',
              'transition-all duration-200 cursor-pointer group',
              collapsed ? 'justify-center' : ''
            )}
            title="Trang người dùng"
          >
            <ArrowLeft className="w-[18px] h-[18px] text-sidebar-muted group-hover:text-info transition-colors" />
            <span className={cn(
              'font-medium text-sm whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
            )}>
              Trang người dùng
            </span>
          </button>
        </div>

        {/* User Profile Section */}
        <div className="border-t border-sidebar-border/50 p-3">
          <div className={cn(
            'flex items-center rounded-xl p-2 hover:bg-sidebar-hover transition-colors cursor-pointer group',
            collapsed ? 'justify-center' : 'gap-3'
          )}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                {profile?.full_name?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  'U'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-sidebar" />
            </div>

            {/* User Info */}
            <div className={cn(
              'flex-1 min-w-0 transition-all duration-300 overflow-hidden',
              collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
            )}>
              <p className="text-sm font-semibold text-foreground truncate">
                {profile?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={signOut}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl',
              'text-red-400 hover:bg-red-500/10 hover:text-red-300',
              'transition-all duration-200 cursor-pointer',
              collapsed ? 'justify-center' : ''
            )}
            title="Đăng xuất"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className={cn(
              'font-medium text-sm whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
            )}>
              Đăng xuất
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
