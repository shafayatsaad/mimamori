import navigationConfig from '@/config/navigation.json';

export interface NavigationItem {
  name: string;
  href: string;
  iconId: string;
  requiredPermissions: string[];
  visibleTo: string[];
  order: number;
}

/**
 * Returns all navigation items from the config, sorted by order.
 */
export function getNavigationItems(): NavigationItem[] {
  return [...navigationConfig.items].sort((a, b) => a.order - b.order);
}

/**
 * Filters navigation items based on user type and permissions.
 *
 * Rules:
 * - An item is visible if userType is in visibleTo.
 * - For patients (non-caregivers), requiredPermissions are ignored — they have full access.
 * - For caregivers, all requiredPermissions must be present in the user's permissions.
 */
export function filterNavigationItems(
  items: NavigationItem[],
  userType: string,
  permissions: string[]
): NavigationItem[] {
  return items.filter((item) => {
    // User type must be in visibleTo
    if (!item.visibleTo.includes(userType)) {
      return false;
    }

    // Patients skip permission checks
    if (userType !== 'Caregiver') {
      return true;
    }

    // Caregivers must have all required permissions
    if (item.requiredPermissions.length > 0) {
      return item.requiredPermissions.every((perm) => permissions.includes(perm));
    }

    return true;
  });
}
