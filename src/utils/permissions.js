// Centralized RBAC permissions registry and helpers for NUAR CRM frontend.

export const PERMISSIONS = {
  // Календарь и записи
  CALENDAR_VIEW_ALL: "calendar.view_all",
  CALENDAR_VIEW_ASSIGNED: "calendar.view_assigned",
  CALENDAR_MANAGE_ALL: "calendar.manage_all",
  CALENDAR_MANAGE_ASSIGNED: "calendar.manage_assigned",
  CALENDAR_DELETE: "calendar.delete",

  // Клиенты
  CLIENTS_VIEW: "clients.view",
  CLIENTS_VIEW_CONTACTS: "clients.view_contacts",
  CLIENTS_MANAGE: "clients.manage",
  CLIENTS_DELETE: "clients.delete",

  // Финансы и касса
  FINANCE_VIEW_SALON_STATS: "finance.view_salon_stats",
  FINANCE_DAY_CLOSE: "finance.day_close",
  PAYOUTS_VIEW_ALL: "payouts.view_all",
  PAYOUTS_VIEW_OWN: "payouts.view_own",
  PAYOUTS_MANAGE: "payouts.manage",

  // Каталог и сотрудники
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  EMPLOYEES_MANAGE: "employees.manage",
  TASKS_MANAGE: "tasks.manage",

  // Пользователи и безопасность
  USERS_MANAGE: "users.manage",
  LOGS_VIEW: "logs.view",
};

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

export const ROLE_DEFAULT_PERMISSIONS = {
  owner: ALL_PERMISSION_KEYS.reduce((acc, key) => ({...acc, [key]: true}), {}),
  admin: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: true,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
    [PERMISSIONS.CLIENTS_MANAGE]: true,
    [PERMISSIONS.CLIENTS_DELETE]: true,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: true,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: true,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: true,
    [PERMISSIONS.CATALOG_VIEW]: true,
    [PERMISSIONS.CATALOG_MANAGE]: true,
    [PERMISSIONS.EMPLOYEES_MANAGE]: true,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: true,
  },
  manager: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
    [PERMISSIONS.CLIENTS_MANAGE]: true,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: true,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_VIEW]: true,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
  staff: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: false,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: false,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: false,
    [PERMISSIONS.CLIENTS_MANAGE]: false,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: false,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_VIEW]: false,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
  readonly: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: false,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: false,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: false,
    [PERMISSIONS.CLIENTS_MANAGE]: false,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: false,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: false,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_VIEW]: true,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: false,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
};

/**
 * Returns true if the user has the specified permission key.
 * The owner role always has full access.
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "owner" || user.id === "local-admin") return true;

  if (user.effectivePermissions && typeof user.effectivePermissions === "object") {
    return Boolean(user.effectivePermissions[permissionKey]);
  }

  // Fallback to role defaults if effective permissions not yet resolved
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.staff;
  return Boolean(defaults[permissionKey]);
}

/**
 * Determines whether a user has permission to view a specific page.
 */
export function canViewPage(page, user) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "owner" || user.id === "local-admin") return true;

  switch (page) {
    case "today":
    case "calendar":
      return (
        hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
        hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ASSIGNED)
      );

    case "clients":
      return hasPermission(user, PERMISSIONS.CLIENTS_VIEW);

    case "club":
      return (
        hasPermission(user, PERMISSIONS.CLIENTS_MANAGE) ||
        hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)
      );

    case "payments":
      // Salon-wide revenue and all payroll
      return (
        hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS) ||
        hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_ALL)
      );

    case "my-earnings":
      // Personal earnings for staff/masters
      return hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_OWN);

    case "operations":
      return (
        hasPermission(user, PERMISSIONS.TASKS_MANAGE) ||
        hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE)
      );

    case "services":
      return (
        hasPermission(user, PERMISSIONS.CATALOG_VIEW) ||
        hasPermission(user, PERMISSIONS.CATALOG_MANAGE)
      );

    case "packages":
      return (
        hasPermission(user, PERMISSIONS.CATALOG_MANAGE) ||
        hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)
      );

    case "masters":
      return hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE);

    case "templates":
      return (
        hasPermission(user, PERMISSIONS.CLIENTS_MANAGE) ||
        hasPermission(user, PERMISSIONS.USERS_MANAGE) ||
        hasPermission(user, PERMISSIONS.CATALOG_MANAGE)
      );

    case "import":
      return hasPermission(user, PERMISSIONS.USERS_MANAGE);

    case "statistics":
      return hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS);

    case "site":
      return hasPermission(user, PERMISSIONS.USERS_MANAGE);

    case "settings":
      // All authenticated users can view settings (profile/theme/password for staff; full for admin/owner)
      return true;

    default:
      return false;
  }
}

/**
 * Checks whether user can perform a specific granular action on a resource.
 */
export function canPerform(action, resource, context = null, user = null) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "owner" || user.id === "local-admin") return true;

  switch (resource) {
    case "service":
      if (action === "view") {
        return (
          hasPermission(user, PERMISSIONS.CATALOG_VIEW) ||
          hasPermission(user, PERMISSIONS.CATALOG_MANAGE)
        );
      }
      return hasPermission(user, PERMISSIONS.CATALOG_MANAGE);

    case "client":
      if (action === "view") return hasPermission(user, PERMISSIONS.CLIENTS_VIEW);
      if (action === "view_contacts") return hasPermission(user, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
      if (action === "delete") return hasPermission(user, PERMISSIONS.CLIENTS_DELETE);
      return hasPermission(user, PERMISSIONS.CLIENTS_MANAGE);

    case "calendar_entry":
      if (action === "view") {
        return (
          hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
          hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ASSIGNED)
        );
      }
      if (action === "delete") return hasPermission(user, PERMISSIONS.CALENDAR_DELETE);
      if (action === "create") {
        return (
          hasPermission(user, PERMISSIONS.CALENDAR_MANAGE_ALL) ||
          hasPermission(user, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED)
        );
      }
      if (action === "edit" || action === "move" || action === "status") {
        if (hasPermission(user, PERMISSIONS.CALENDAR_MANAGE_ALL)) return true;
        if (hasPermission(user, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED)) {
          if (!context) return true;
          const entryEmpId = context.employeeId || context.masterId;
          const userEmpId = user.employeeId;
          if (!entryEmpId || !userEmpId) return true;
          return Number(entryEmpId) === Number(userEmpId);
        }
        return false;
      }
      return false;

    case "finance":
      if (action === "view_salon_stats") return hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
      if (action === "day_close") return hasPermission(user, PERMISSIONS.FINANCE_DAY_CLOSE);
      return false;

    case "payouts":
      if (action === "view_all") return hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_ALL);
      if (action === "view_own") return hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_OWN);
      if (action === "manage") return hasPermission(user, PERMISSIONS.PAYOUTS_MANAGE);
      return false;

    case "tasks":
      if (action === "complete") return true;
      return hasPermission(user, PERMISSIONS.TASKS_MANAGE);

    case "employees":
      return hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE);

    case "users":
      return hasPermission(user, PERMISSIONS.USERS_MANAGE);

    case "site":
      return hasPermission(user, PERMISSIONS.USERS_MANAGE);

    case "logs":
      return hasPermission(user, PERMISSIONS.LOGS_VIEW);

    default:
      return false;
  }
}

/**
 * Returns the default initial page for a user based on their permissions.
 */
export function getDefaultPageForUser(user) {
  if (!user) return "today";
  if (canViewPage("today", user)) return "today";
  if (canViewPage("calendar", user)) return "calendar";
  if (canViewPage("clients", user)) return "clients";
  if (canViewPage("my-earnings", user)) return "my-earnings";
  if (canViewPage("payments", user)) return "payments";
  return "settings";
}

/**
 * Filters the desktop navigation groups to only include allowed sections and items.
 * Removes empty groups and ensures role-aware labels (e.g. "Мои начисления" for staff).
 */
export function getAllowedNavigation(rawNavGroups, user) {
  if (!user) return [];

  const isOwner = String(user.role || "").toLowerCase() === "owner";
  const hasSalonFinance = hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
  const hasOwnPayouts = hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_OWN);

  return rawNavGroups
    .map((group) => {
      const allowedItems = group.items
        .map((item) => {
          // If staff without salon stats, replace "payments" with "my-earnings"
          if (item.page === "payments" && !hasSalonFinance && hasOwnPayouts) {
            return {
              label: "Мои начисления",
              page: "my-earnings",
              icon: "receipt",
            };
          }

          // If staff without all-calendar rights, show "Мои клиенты"
          if (
            item.page === "clients" &&
            !hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) &&
            user.employeeId
          ) {
            return {
              ...item,
              label: "Мои клиенты",
            };
          }

          // If staff, settings tab is "Профиль"
          if (item.page === "settings" && !hasPermission(user, PERMISSIONS.USERS_MANAGE) && !isOwner) {
            return {
              ...item,
              label: "Профиль",
              icon: "user",
            };
          }

          return item;
        })
        .filter((item) => canViewPage(item.page, user));

      return {
        ...group,
        items: allowedItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * Returns allowed items for the mobile bottom navigation bar.
 */
export function getAllowedMobileNav(user) {
  if (!user) return [];

  const hasSalonFinance = hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
  const hasOwnPayouts = hasPermission(user, PERMISSIONS.PAYOUTS_VIEW_OWN);
  const isStaff = !hasSalonFinance && hasOwnPayouts;

  const baseItems = [
    {label: "Сегодня", page: "today", icon: "sun"},
    {label: "Календарь", page: "calendar", icon: "calendarDays"},
    isStaff
      ? {label: "Начисления", page: "my-earnings", icon: "receipt"}
      : {label: "Визиты", page: "payments", icon: "receipt"},
    {
      label: isStaff ? "Мои клиенты" : "Клиенты",
      page: "clients",
      icon: "users",
    },
    {label: "Работа", page: "operations", icon: "clipboardList"},
  ];

  return baseItems.filter((item) => canViewPage(item.page, user));
}
