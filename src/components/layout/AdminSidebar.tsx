/**
 * AdminSidebar - Sidebar riêng cho Admin Panel
 * Flat menu (không có children), accent màu blue thay vì red
 */

import { useEffect } from 'react';
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, LogOut, ArrowLeft } from 'lucide-react';
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
      {/* Mobile Overlay/Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-dvh bg-white border-r border-slate-200 transition-all duration-300 z-50 flex flex-col',
          collapsed ? 'md:w-16' : 'md:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo - Admin badge */}
        <Link to="/admin" className="flex items-center gap-3 px-4 border-b border-slate-200 h-[73px] overflow-hidden hover:bg-slate-50 transition-colors cursor-pointer">
          <img
            src="/logo_betacom.png"
            alt="BETACOM"
            className="w-10 h-10 rounded-lg object-contain flex-shrink-0"
          />
          <div className={cn(
            'transition-all duration-300 overflow-hidden whitespace-nowrap',
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}>
            <h1 className="font-bold text-xl text-blue-600">ADMIN</h1>
          </div>
        </Link>

        {/* Menu Items - Flat list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center rounded-lg transition-all duration-200 overflow-hidden cursor-pointer',
                  isActive
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-slate-600 hover:bg-slate-100',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                )}
                onClick={handleLeafClick}
              >
                <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-blue-600' : 'text-slate-500')} />
                <span className={cn(
                  'font-semibold text-sm whitespace-nowrap transition-all duration-300',
                  isActive ? 'text-blue-600' : 'text-slate-700',
                  collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                )}>
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Back to User Pages button */}
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={() => {
              handleLeafClick();
              navigate('/dashboard');
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors overflow-hidden cursor-pointer',
              collapsed ? 'justify-center' : ''
            )}
            title="Trang người dùng"
          >
            <ArrowLeft className="w-5 h-5 flex-shrink-0" />
            <span className={cn(
              'font-medium text-sm whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}>
              Trang người dùng
            </span>
          </button>
        </div>

        {/* Toggle Collapse Button - Ẩn trên mobile */}
        <div className="hidden md:block border-t border-slate-200 p-3">
          <button
            onClick={onToggle}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors overflow-hidden cursor-pointer',
              collapsed ? 'justify-center' : ''
            )}
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <ChevronLeft className={cn(
              'w-5 h-5 flex-shrink-0 transition-transform duration-300',
              collapsed ? 'rotate-180' : ''
            )} />
            <span className={cn(
              'font-medium text-sm whitespace-nowrap transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}>
              Thu gọn
            </span>
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="border-t border-slate-200 p-3 overflow-hidden">
          <div className="space-y-3">
            <div className={cn(
              'flex items-center',
              collapsed ? 'justify-center px-0' : 'gap-3 px-2'
            )}>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {profile?.full_name?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  'U'}
              </div>
              <div className={cn(
                'flex-1 min-w-0 transition-all duration-300 overflow-hidden',
                collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}>
                <p className="text-sm font-medium text-slate-700 truncate whitespace-nowrap">
                  {profile?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-400 truncate whitespace-nowrap">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors overflow-hidden cursor-pointer',
                collapsed ? 'justify-center' : ''
              )}
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={cn(
                'font-medium text-sm whitespace-nowrap transition-all duration-300',
                collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}>
                Đăng xuất
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
