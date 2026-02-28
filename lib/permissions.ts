/**
 * Permission_Store — server-side module for managing caregiver permission types.
 *
 * Fetches permission types from the database (PermissionType model) and falls
 * back to hardcoded defaults when the DB is unavailable.
 */

import { prisma } from '@/lib/prisma';

/** Default permission types matching the original hardcoded union. */
export const DEFAULT_PERMISSIONS: string[] = ['Diary', 'Alerts', 'Vault'];

/**
 * Fetch all permission type names from the database.
 * Falls back to DEFAULT_PERMISSIONS if the query fails.
 */
export async function getPermissionTypes(): Promise<string[]> {
  try {
    const rows = await prisma.permissionType.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    if (rows.length === 0) {
      return DEFAULT_PERMISSIONS;
    }
    return rows.map((r) => r.name);
  } catch (error) {
    console.warn('Permission_Store: DB unavailable, using defaults', error);
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Check whether a permission name is valid against a known set.
 */
export function isValidPermission(name: string, validPermissions: string[]): boolean {
  return validPermissions.includes(name);
}
