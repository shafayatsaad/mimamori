import { describe, it, expect } from 'vitest';
import { storageKey, STORAGE_PREFIX } from '../lib/storage-keys';

describe('storage-keys', () => {
  it('STORAGE_PREFIX defaults to "mimamori_"', () => {
    expect(STORAGE_PREFIX).toBe('mimamori_');
  });

  it('storageKey concatenates prefix with key name', () => {
    expect(storageKey('logs')).toBe('mimamori_logs');
    expect(storageKey('caregivers')).toBe('mimamori_caregivers');
    expect(storageKey('docs')).toBe('mimamori_docs');
    expect(storageKey('profile')).toBe('mimamori_profile');
    expect(storageKey('appointments')).toBe('mimamori_appointments');
    expect(storageKey('hydration_logs')).toBe('mimamori_hydration_logs');
    expect(storageKey('invites')).toBe('mimamori_invites');
  });

  it('storageKey handles empty key name', () => {
    expect(storageKey('')).toBe('mimamori_');
  });
});
