import {useMemo} from "react";
import {navGroups} from "../constants/navigation.js";
import {
  canPerform,
  canViewPage,
  getAllowedMobileNav,
  getAllowedNavigation,
  getDefaultPageForUser,
  hasPermission,
  PERMISSIONS,
} from "../utils/permissions.js";

/**
 * Hook providing memoized permission checks and navigation lists for a given user.
 */
export function usePermissions(user) {
  const role = String(user?.role || "").toLowerCase();
  const isOwner = role === "owner" || user?.id === "local-admin";

  const effectivePermissions = useMemo(() => {
    return user?.effectivePermissions || {};
  }, [user?.effectivePermissions]);

  const allowedNavGroups = useMemo(() => {
    return getAllowedNavigation(navGroups, user);
  }, [user]);

  const allowedMobileNav = useMemo(() => {
    return getAllowedMobileNav(user);
  }, [user]);

  const defaultPage = useMemo(() => {
    return getDefaultPageForUser(user);
  }, [user]);

  return {
    isOwner,
    role,
    employeeId: user?.employeeId ?? null,
    effectivePermissions,
    has: (permissionKey) => hasPermission(user, permissionKey),
    can: (action, resource, context = null) => canPerform(action, resource, context, user),
    canPage: (page) => canViewPage(page, user),
    allowedNavGroups,
    allowedMobileNav,
    defaultPage,
    PERMISSIONS,
  };
}
