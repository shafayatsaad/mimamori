import { describe, it, expect } from 'vitest';
import {
  getNavigationItems,
  filterNavigationItems,
  type NavigationItem,
} from '@/lib/navigation';

describe('getNavigationItems', () => {
  it('returns all 9 navigation items sorted by order', () => {
    const items = getNavigationItems();
    expect(items.length).toBe(9);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].order).toBeGreaterThanOrEqual(items[i - 1].order);
    }
  });

  it('includes expected items with correct fields', () => {
    const items = getNavigationItems();
    const dashboard = items.find((i) => i.name === 'Dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.href).toBe('/dashboard');
    expect(dashboard!.iconId).toBe('dashboard');
    expect(dashboard!.requiredPermissions).toEqual([]);
    expect(dashboard!.visibleTo).toContain('Patient');
    expect(dashboard!.visibleTo).toContain('Caregiver');
  });
});

describe('filterNavigationItems', () => {
  const items: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', iconId: 'dashboard', requiredPermissions: [], visibleTo: ['Patient', 'Caregiver'], order: 1 },
    { name: 'Daily Log', href: '/dashboard/daily-log', iconId: 'daily-log', requiredPermissions: ['Diary'], visibleTo: ['Patient', 'Caregiver'], order: 2 },
    { name: 'Care Team', href: '/dashboard/care-team', iconId: 'care-team', requiredPermissions: [], visibleTo: ['Patient'], order: 4 },
    { name: 'Documents', href: '/dashboard/documents', iconId: 'documents', requiredPermissions: ['Vault'], visibleTo: ['Patient', 'Caregiver'], order: 5 },
    { name: 'Settings', href: '/dashboard/settings', iconId: 'settings', requiredPermissions: [], visibleTo: ['Patient'], order: 8 },
  ];

  it('Patient sees all items (permissions ignored)', () => {
    const result = filterNavigationItems(items, 'Patient', []);
    expect(result.map((i) => i.name)).toEqual([
      'Dashboard', 'Daily Log', 'Care Team', 'Documents', 'Settings',
    ]);
  });

  it('Caregiver without permissions sees only items with no requiredPermissions and visibleTo Caregiver', () => {
    const result = filterNavigationItems(items, 'Caregiver', []);
    const names = result.map((i) => i.name);
    expect(names).toContain('Dashboard');
    expect(names).not.toContain('Daily Log'); // requires Diary
    expect(names).not.toContain('Care Team'); // Patient only
    expect(names).not.toContain('Documents'); // requires Vault
    expect(names).not.toContain('Settings'); // Patient only
  });

  it('Caregiver with Diary permission sees Daily Log', () => {
    const result = filterNavigationItems(items, 'Caregiver', ['Diary']);
    const names = result.map((i) => i.name);
    expect(names).toContain('Daily Log');
    expect(names).not.toContain('Documents');
  });

  it('Caregiver with Vault permission sees Documents', () => {
    const result = filterNavigationItems(items, 'Caregiver', ['Vault']);
    const names = result.map((i) => i.name);
    expect(names).toContain('Documents');
    expect(names).not.toContain('Daily Log');
  });

  it('Caregiver with all permissions sees all Caregiver-visible items', () => {
    const result = filterNavigationItems(items, 'Caregiver', ['Diary', 'Vault']);
    const names = result.map((i) => i.name);
    expect(names).toContain('Dashboard');
    expect(names).toContain('Daily Log');
    expect(names).toContain('Documents');
    expect(names).not.toContain('Care Team');
    expect(names).not.toContain('Settings');
  });

  it('returns empty array for unknown user type', () => {
    const result = filterNavigationItems(items, 'Admin', []);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty items', () => {
    const result = filterNavigationItems([], 'Patient', []);
    expect(result).toEqual([]);
  });
});
