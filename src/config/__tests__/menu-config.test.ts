/**
 * Tests for menu-config — menuItems structure and getFeaturePermissions()
 */

import { menuItems, getFeaturePermissions } from '@/config/menu-config';

describe('menuItems', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(menuItems)).toBe(true);
    expect(menuItems.length).toBeGreaterThan(0);
  });

  it('every item has a title and icon', () => {
    for (const item of menuItems) {
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });

  it('items with path have a non-empty string path', () => {
    for (const item of menuItems) {
      if (item.path !== undefined) {
        expect(typeof item.path).toBe('string');
        expect(item.path.startsWith('/')).toBe(true);
      }
    }
  });

  it('children items each have title, icon, and path', () => {
    for (const item of menuItems) {
      if (item.children) {
        for (const child of item.children) {
          expect(typeof child.title).toBe('string');
          expect(child.icon).toBeDefined();
          expect(typeof child.path).toBe('string');
          expect(child.path.startsWith('/')).toBe(true);
        }
      }
    }
  });

  it('contains a dashboard home item', () => {
    const home = menuItems.find(i => i.path === '/dashboard');
    expect(home).toBeDefined();
    expect(home?.permissionKey).toBe('home');
  });

  it('contains a flash-sale item with children', () => {
    const flashSale = menuItems.find(i => i.permissionKey === 'flash-sale');
    expect(flashSale).toBeDefined();
    expect(flashSale?.children?.length).toBeGreaterThan(0);
  });
});

describe('getFeaturePermissions', () => {
  it('returns a non-empty array', () => {
    const perms = getFeaturePermissions();
    expect(Array.isArray(perms)).toBe(true);
    expect(perms.length).toBeGreaterThan(0);
  });

  it('every permission has key, label, icon, and description', () => {
    const perms = getFeaturePermissions();
    for (const perm of perms) {
      expect(typeof perm.key).toBe('string');
      expect(perm.key.length).toBeGreaterThan(0);
      expect(typeof perm.label).toBe('string');
      expect(perm.icon).toBeDefined();
      expect(typeof perm.description).toBe('string');
    }
  });

  it('includes home permission', () => {
    const perms = getFeaturePermissions();
    const home = perms.find(p => p.key === 'home');
    expect(home).toBeDefined();
  });

  it('includes flash-sale permission', () => {
    const perms = getFeaturePermissions();
    const flashSale = perms.find(p => p.key === 'flash-sale');
    expect(flashSale).toBeDefined();
  });

  it('includes settings/profile permission with group Cài đặt', () => {
    const perms = getFeaturePermissions();
    const profilePerm = perms.find(p => p.key === 'settings/profile');
    expect(profilePerm).toBeDefined();
    expect(profilePerm?.group).toBe('Cài đặt');
  });

  it('permission keys use expected slug patterns (no spaces)', () => {
    const perms = getFeaturePermissions();
    for (const perm of perms) {
      expect(perm.key).not.toContain(' ');
    }
  });

  it('produces no duplicate permission keys', () => {
    const perms = getFeaturePermissions();
    const keys = perms.map(p => p.key);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});
