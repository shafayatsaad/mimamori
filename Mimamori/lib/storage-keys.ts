/**
 * Client-safe localStorage key helper.
 *
 * Uses the NEXT_PUBLIC_STORAGE_PREFIX env var when available (works in both
 * client and server contexts), falling back to 'mimamori_'.
 *
 * Config_Service cannot be used directly in client components because it reads
 * process.env (server-only). This module bridges that gap.
 */

export const STORAGE_PREFIX: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STORAGE_PREFIX) || 'mimamori_';

/**
 * Build a namespaced localStorage key.
 *
 * @example storageKey('logs') // => 'mimamori_logs'
 */
export function storageKey(keyName: string): string {
  return STORAGE_PREFIX + keyName;
}
