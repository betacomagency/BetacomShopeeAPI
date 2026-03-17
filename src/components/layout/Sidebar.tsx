/**
 * Sidebar Component - E-Commerce Style Navigation
 * Premium dark sidebar with Shopee-inspired orange accents
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, LogOut, Sparkles } from 'lucide-react';
import { menuItems, type MenuItem } from '@/config/menu-config';
import { usePermissionsContext } from '@/contexts/PermissionsContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { hasFeature } = usePermissionsContext();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const handleLeafClick = () => {
    if (window.innerWidth < 768 && onMobileClose) {
      onMobileClose();
    }
  };

  // Lock body scroll when mobile sidebar is open
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

  // Filter menu items by permissions
  const filteredMenuItems = menuItems
    .filter(item => {
      if (item.permissionKey && !hasFeature(item.permissionKey)) return false;
      return true;
    })
    .map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child =>
            !child.permissionKey || hasFeature(child.permissionKey)
          ),
        };
      }
      return item;
    })
    .filter(item => !item.children || item.children.length > 0);

  const toggleMenu = (title: string) => {
    setExpandedMenu((prev) => (prev === title ? null : title));
  };

  const isMenuActive = (item: MenuItem) => {
    if (item.path) return location.pathname === item.path;
    if (item.children) return item.children.some((child) => location.pathname === child.path);
    return false;
  };

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
          to="/dashboard"
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
            'font-bold text-xl text-destructive tracking-tight transition-all duration-300',
            collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
          )}>
            BETACOM
          </h1>
        </Link>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          {/* Section Label */}
          {!collapsed && (
            <p className="text-[10px] font-semibold text-sidebar-muted uppercase tracking-wider px-3 mb-3">
              Menu chính
            </p>
          )}

          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isMenuActive(item);
            const isExpanded = expandedMenu === item.title;
            const hasChildren = item.children && item.children.length > 0;

            if (hasChildren) {
              return (
                <div key={item.title} className="space-y-0.5">
                  <button
                    onClick={() => !collapsed && toggleMenu(item.title)}
                    className={cn(
                      'w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer group',
                      isActive
                        ? 'bg-sidebar-primary/10 text-sidebar-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground',
                      collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center rounded-lg transition-all',
                      isActive
                        ? 'text-sidebar-primary'
                        : 'text-sidebar-muted group-hover:text-foreground',
                      collapsed ? '' : 'w-8 h-8'
                    )}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <span className={cn(
                      'font-medium text-sm flex-1 text-left whitespace-nowrap transition-all duration-300',
                      collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                    )}>
                      {item.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-all duration-200 text-sidebar-muted',
                        isExpanded ? 'rotate-180 text-sidebar-foreground' : '',
                        collapsed ? 'hidden' : ''
                      )}
                    />
                  </button>

                  {/* Submenu */}
                  {!collapsed && (
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200 ease-out',
                        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="ml-5 pl-4 border-l-2 border-sidebar-border/50 space-y-0.5 py-1">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = location.pathname === child.path;
                          return (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
                                isChildActive
                                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
                                  : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground'
                              )}
                              onClick={handleLeafClick}
                            >
                              <ChildIcon className={cn(
                                'w-4 h-4 transition-colors',
                                isChildActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-muted group-hover:text-foreground'
                              )} />
                              <span className="font-medium text-[13px]">
                                {child.title}
                              </span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // External link items
            if (item.openInNewTab && item.path) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center rounded-xl transition-all duration-200 cursor-pointer group',
                    'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground',
                    collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                  )}
                  onClick={handleLeafClick}
                >
                  <div className={cn(
                    'flex items-center justify-center rounded-lg text-sidebar-muted group-hover:text-foreground transition-colors',
                    collapsed ? '' : 'w-8 h-8'
                  )}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <span className={cn(
                    'font-medium text-sm whitespace-nowrap transition-all duration-300',
                    collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                  )}>
                    {item.title}
                  </span>
                </a>
              );
            }

            // Regular nav items
            return (
              <NavLink
                key={item.path}
                to={item.path!}
                className={cn(
                  'flex items-center rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
                    : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground',
                  collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                )}
                onClick={handleLeafClick}
              >
                <div className={cn(
                  'flex items-center justify-center rounded-lg transition-colors',
                  isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-muted group-hover:text-foreground',
                  collapsed ? '' : 'w-8 h-8'
                )}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span className={cn(
                  'font-medium text-sm whitespace-nowrap transition-all duration-300',
                  collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                )}>
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Admin Panel Button - Only for admins */}
        {hasFeature('admin-panel') && (
          <div className="px-3 pb-2">
            <button
              onClick={() => {
                handleLeafClick();
                navigate('/admin');
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30',
                'text-blue-400 hover:from-blue-600/30 hover:to-purple-600/30',
                'transition-all duration-200 cursor-pointer group',
                collapsed ? 'justify-center' : ''
              )}
              title="Admin Panel"
            >
              <Sparkles className="w-[18px] h-[18px] group-hover:text-blue-300 transition-colors" />
              <span className={cn(
                'font-medium text-sm whitespace-nowrap transition-all duration-300',
                collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
              )}>
                Admin Panel
              </span>
            </button>
          </div>
        )}

        {/* User Profile Section */}
        <div className="border-t border-sidebar-border/50 p-3">
          <div className={cn(
            'flex items-center rounded-xl p-2 hover:bg-sidebar-hover transition-colors cursor-pointer group',
            collapsed ? 'justify-center' : 'gap-3'
          )}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sidebar-primary to-orange-600 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shadow-lg shadow-sidebar-primary/20">
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
