import {describe, expect, it} from "vitest";
import {navGroups} from "../constants/navigation.js";
import {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  canPerform,
  canViewPage,
  getAllowedMobileNav,
  getAllowedNavigation,
  getDefaultPageForUser,
  hasPermission,
} from "./permissions.js";

describe("Frontend RBAC: permissions.js", () => {
  const ownerUser = {
    id: 1,
    email: "owner@nuarr.pl",
    role: "owner",
  };

  const adminUser = {
    id: 2,
    email: "admin@nuarr.pl",
    role: "admin",
  };

  const staffUser = {
    id: 3,
    email: "master@nuarr.pl",
    role: "staff",
    employeeId: 10,
  };

  const readonlyUser = {
    id: 4,
    email: "auditor@nuarr.pl",
    role: "readonly",
  };

  describe("hasPermission", () => {
    it("owner has all permissions unconditionally", () => {
      expect(hasPermission(ownerUser, PERMISSIONS.CALENDAR_DELETE)).toBe(true);
      expect(hasPermission(ownerUser, PERMISSIONS.USERS_MANAGE)).toBe(true);
      expect(hasPermission(ownerUser, PERMISSIONS.FINANCE_VIEW_SALON_STATS)).toBe(true);
    });

    it("local-admin fallback user has all permissions", () => {
      const localAdmin = {id: "local-admin", role: "owner"};
      expect(hasPermission(localAdmin, PERMISSIONS.USERS_MANAGE)).toBe(true);
    });

    it("staff has assigned permissions but lacks salon management and delete", () => {
      expect(hasPermission(staffUser, PERMISSIONS.CALENDAR_VIEW_ASSIGNED)).toBe(true);
      expect(hasPermission(staffUser, PERMISSIONS.PAYOUTS_VIEW_OWN)).toBe(true);
      expect(hasPermission(staffUser, PERMISSIONS.TASKS_MANAGE)).toBe(true);

      // Forbidden for staff by default
      expect(hasPermission(staffUser, PERMISSIONS.CALENDAR_VIEW_ALL)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.CALENDAR_DELETE)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.CLIENTS_VIEW_CONTACTS)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.CLIENTS_DELETE)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.FINANCE_VIEW_SALON_STATS)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.PAYOUTS_VIEW_ALL)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.CATALOG_VIEW)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.CATALOG_MANAGE)).toBe(false);
      expect(hasPermission(staffUser, PERMISSIONS.USERS_MANAGE)).toBe(false);
    });

    it("custom override takes precedence over role defaults", () => {
      const customStaff = {
        ...staffUser,
        effectivePermissions: {
          ...ROLE_DEFAULT_PERMISSIONS.staff,
          [PERMISSIONS.CATALOG_VIEW]: true,
          [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
        },
      };

      expect(hasPermission(customStaff, PERMISSIONS.CATALOG_VIEW)).toBe(true);
      expect(hasPermission(customStaff, PERMISSIONS.CLIENTS_VIEW_CONTACTS)).toBe(true);
      expect(hasPermission(customStaff, PERMISSIONS.CATALOG_MANAGE)).toBe(false);
    });
  });

  describe("canViewPage", () => {
    it("owner can view all application pages", () => {
      const pages = [
        "today",
        "calendar",
        "clients",
        "club",
        "payments",
        "my-earnings",
        "operations",
        "services",
        "packages",
        "masters",
        "templates",
        "import",
        "statistics",
        "site",
        "settings",
      ];
      pages.forEach((page) => {
        expect(canViewPage(page, ownerUser)).toBe(true);
      });
    });

    it("staff can only view allowed operational pages and my-earnings", () => {
      expect(canViewPage("today", staffUser)).toBe(true);
      expect(canViewPage("calendar", staffUser)).toBe(true);
      expect(canViewPage("clients", staffUser)).toBe(true);
      expect(canViewPage("my-earnings", staffUser)).toBe(true);
      expect(canViewPage("operations", staffUser)).toBe(true);
      expect(canViewPage("settings", staffUser)).toBe(true);

      // Staff cannot view salon finance, statistics, catalog, site, import, or employees
      expect(canViewPage("payments", staffUser)).toBe(false);
      expect(canViewPage("statistics", staffUser)).toBe(false);
      expect(canViewPage("services", staffUser)).toBe(false);
      expect(canViewPage("packages", staffUser)).toBe(false);
      expect(canViewPage("masters", staffUser)).toBe(false);
      expect(canViewPage("templates", staffUser)).toBe(false);
      expect(canViewPage("import", staffUser)).toBe(false);
      expect(canViewPage("site", staffUser)).toBe(false);
      expect(canViewPage("club", staffUser)).toBe(false);
    });

    it("readonly user can view calendar and catalog but not edit or view finance", () => {
      expect(canViewPage("today", readonlyUser)).toBe(true);
      expect(canViewPage("calendar", readonlyUser)).toBe(true);
      expect(canViewPage("clients", readonlyUser)).toBe(true);
      expect(canViewPage("services", readonlyUser)).toBe(true);

      expect(canViewPage("payments", readonlyUser)).toBe(false);
      expect(canViewPage("my-earnings", readonlyUser)).toBe(false);
      expect(canViewPage("operations", readonlyUser)).toBe(false);
      expect(canViewPage("packages", readonlyUser)).toBe(false);
      expect(canViewPage("masters", readonlyUser)).toBe(false);
    });
  });

  describe("canPerform granular actions", () => {
    it("service catalog permissions", () => {
      expect(canPerform("view", "service", null, staffUser)).toBe(false);
      expect(canPerform("create", "service", null, staffUser)).toBe(false);

      expect(canPerform("view", "service", null, adminUser)).toBe(true);
      expect(canPerform("edit", "service", null, adminUser)).toBe(true);
    });

    it("clients contacts protection", () => {
      expect(canPerform("view", "client", null, staffUser)).toBe(true);
      expect(canPerform("view_contacts", "client", null, staffUser)).toBe(false);
      expect(canPerform("delete", "client", null, staffUser)).toBe(false);

      expect(canPerform("view_contacts", "client", null, adminUser)).toBe(true);
      expect(canPerform("delete", "client", null, adminUser)).toBe(true);
    });

    it("calendar entry ownership checks", () => {
      const ownVisit = {employeeId: 10};
      const otherVisit = {employeeId: 20};

      expect(canPerform("create", "calendar_entry", null, staffUser)).toBe(true);
      expect(canPerform("edit", "calendar_entry", ownVisit, staffUser)).toBe(true);
      expect(canPerform("edit", "calendar_entry", otherVisit, staffUser)).toBe(false);
      expect(canPerform("delete", "calendar_entry", ownVisit, staffUser)).toBe(false);

      expect(canPerform("edit", "calendar_entry", otherVisit, adminUser)).toBe(true);
      expect(canPerform("delete", "calendar_entry", otherVisit, adminUser)).toBe(true);
    });
  });

  describe("getDefaultPageForUser", () => {
    it("returns today for owner and staff", () => {
      expect(getDefaultPageForUser(ownerUser)).toBe("today");
      expect(getDefaultPageForUser(staffUser)).toBe("today");
    });

    it("returns settings if user has no operational access", () => {
      const restrictedUser = {
        id: 99,
        role: "custom",
        effectivePermissions: {},
      };
      expect(getDefaultPageForUser(restrictedUser)).toBe("settings");
    });
  });

  describe("getAllowedNavigation", () => {
    it("owner gets all navigation groups without modification", () => {
      const allowed = getAllowedNavigation(navGroups, ownerUser);
      expect(allowed.length).toBe(navGroups.length);
      const allPages = allowed.flatMap((g) => g.items.map((i) => i.page));
      expect(allPages).toContain("today");
      expect(allPages).toContain("payments");
      expect(allPages).toContain("services");
      expect(allPages).toContain("settings");
    });

    it("staff receives tailored groups: no empty groups, 'Мои начисления' and 'Мои клиенты'", () => {
      const allowed = getAllowedNavigation(navGroups, staffUser);

      // Verify no empty groups exist
      allowed.forEach((group) => {
        expect(group.items.length).toBeGreaterThan(0);
      });

      const allPages = allowed.flatMap((g) => g.items.map((i) => i.page));
      expect(allPages).toContain("today");
      expect(allPages).toContain("calendar");
      expect(allPages).toContain("clients");
      expect(allPages).toContain("my-earnings");
      expect(allPages).toContain("operations");
      expect(allPages).toContain("settings");

      // Staff must NOT have salon payments, services, packages, masters, site, templates, import, statistics
      expect(allPages).not.toContain("payments");
      expect(allPages).not.toContain("services");
      expect(allPages).not.toContain("packages");
      expect(allPages).not.toContain("masters");
      expect(allPages).not.toContain("site");
      expect(allPages).not.toContain("statistics");

      // Check tailored labels
      const clientItem = allowed.flatMap((g) => g.items).find((i) => i.page === "clients");
      expect(clientItem.label).toBe("Мои клиенты");

      const earningsItem = allowed.flatMap((g) => g.items).find((i) => i.page === "my-earnings");
      expect(earningsItem.label).toBe("Мои начисления");

      const settingsItem = allowed.flatMap((g) => g.items).find((i) => i.page === "settings");
      expect(settingsItem.label).toBe("Профиль");
    });
  });

  describe("getAllowedMobileNav", () => {
    it("owner receives full mobile bottom bar with 'Визиты'", () => {
      const mobile = getAllowedMobileNav(ownerUser);
      expect(mobile.map((m) => m.page)).toEqual([
        "today",
        "calendar",
        "payments",
        "clients",
        "operations",
      ]);
      expect(mobile.find((m) => m.page === "payments").label).toBe("Визиты");
    });

    it("staff receives mobile bottom bar with 'Начисления' and 'Мои клиенты'", () => {
      const mobile = getAllowedMobileNav(staffUser);
      expect(mobile.map((m) => m.page)).toEqual([
        "today",
        "calendar",
        "my-earnings",
        "clients",
        "operations",
      ]);
      expect(mobile.find((m) => m.page === "my-earnings").label).toBe("Начисления");
      expect(mobile.find((m) => m.page === "clients").label).toBe("Мои клиенты");
    });
  });
});
