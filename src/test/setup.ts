/**
 * Vitest global setup
 * Extends matchers and configures test environment
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-cleanup after each test for @testing-library/react
afterEach(() => {
  cleanup();
});
