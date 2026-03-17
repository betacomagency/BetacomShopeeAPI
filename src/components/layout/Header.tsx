/**
 * Header Component - Header chính của ứng dụng
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen } from 'lucide-react';
import ShopSelector from './ShopSelector';

export default function Header() {
  const { user, profile, isLoading, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 bg-card border-b border-border z-30 shadow-sm h-16">
      <div className="h-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo_betacom.png"
              alt="BETACOM"
              className="w-10 h-10 rounded-lg object-contain"
            />
            <div>
              <h1 className="font-bold text-xl text-red-500">BETACOM</h1>
            </div>
          </div>

          {/* Right side: API Docs + Shop Selector + User Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* API Docs */}
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm font-medium cursor-pointer"
              title="Tài liệu API Shopee"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">API Docs</span>
            </a>

            {/* Shop Selector - Chuyển đổi giữa các shop */}
            <ShopSelector />

            {/* User Menu */}
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-full animate-pulse" />
                <div className="hidden sm:block space-y-1">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {profile?.full_name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-foreground">
                      {profile?.full_name || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-lg border border-border py-2 z-20">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground truncate">
                          {profile?.full_name || user?.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOut();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 mt-1 cursor-pointer"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
