import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/components/**',
        'src/pages/**',
        'src/test/**',
        'src/**/*.d.ts',
        'src/hooks/use-toast.ts',
        'src/hooks/useSyncData.ts',
        'src/hooks/useShopPerformance.ts',
        'src/hooks/useRealtimeData.ts',
        'src/hooks/useActivityLogs.ts',
        'src/hooks/useApiCallLogs.ts',
        'src/hooks/useApiRegistry.ts',
        'src/hooks/useDashboardData.ts',
        'src/hooks/useShopeeAuth.ts',
        'src/hooks/useAuth.ts',
        'src/hooks/useApiCallStats.ts',
        'src/hooks/usePushLogs.ts',
        'src/contexts/AuthContext.tsx',
        'src/contexts/ShopeeAuthContext.tsx',
        'src/contexts/PermissionsContext.tsx',
        'src/lib/shopee/flash-sale/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
