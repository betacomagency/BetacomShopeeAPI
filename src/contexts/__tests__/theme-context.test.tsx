/**
 * Tests for ThemeContext — theme switching and localStorage persistence
 */

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── matchMedia mock ───────────────────────────────────────────────────────────
function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchChange: (matches: boolean) => {
      listeners.forEach(cb => cb({ matches } as MediaQueryListEvent));
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  });
  return mq;
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ThemeProvider, null, children);

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset document classes
    document.documentElement.classList.remove('light', 'dark');
  });

  describe('default theme', () => {
    it('defaults to system theme when nothing is stored', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('system');
    });

    it('resolves to light when system prefers light', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('resolves to dark when system prefers dark', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.resolvedTheme).toBe('dark');
    });
  });

  describe('getStoredTheme via initial state', () => {
    it('reads stored light theme from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('light');
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('reads stored dark theme from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('falls back to system for unrecognised stored value', () => {
      localStorageMock.getItem.mockReturnValue('invalid-value');
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('system');
    });
  });

  describe('setTheme', () => {
    it('persists chosen theme to localStorage', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('dark'); });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('betacom-theme', 'dark');
    });

    it('updates theme state after setTheme', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('dark'); });

      expect(result.current.theme).toBe('dark');
    });

    it('updates resolvedTheme to light when setTheme("light")', () => {
      mockMatchMedia(true); // system says dark, but we override
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('light'); });

      expect(result.current.resolvedTheme).toBe('light');
    });

    it('updates resolvedTheme to dark when setTheme("dark")', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('dark'); });

      expect(result.current.resolvedTheme).toBe('dark');
    });
  });

  describe('useTheme outside provider', () => {
    it('throws an error when used outside ThemeProvider', () => {
      // Suppress console.error noise from React
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useTheme())).toThrow(
        'useTheme must be used within a ThemeProvider',
      );
      consoleSpy.mockRestore();
    });
  });
});
