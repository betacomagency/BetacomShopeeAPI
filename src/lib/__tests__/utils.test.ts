/**
 * Tests for cn() utility — clsx + tailwind-merge combinator
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('ignores undefined values', () => {
    expect(cn(undefined, 'foo')).toBe('foo');
  });

  it('ignores null values', () => {
    expect(cn(null, 'bar')).toBe('bar');
  });

  it('ignores false values', () => {
    expect(cn(false, 'baz')).toBe('baz');
  });

  it('handles conditional object syntax', () => {
    expect(cn({ 'bg-red-500': true, 'bg-blue-500': false })).toBe('bg-red-500');
  });

  it('merges conflicting background colors from object syntax', () => {
    expect(cn('bg-red-500', { 'bg-blue-500': true })).toBe('bg-blue-500');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates identical classes', () => {
    // twMerge keeps last of conflicting utilities; identical non-conflicting classes are kept once
    const result = cn('flex', 'flex');
    expect(result).toBe('flex');
  });
});
