import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {ALERT_FILTER_STORAGE_KEY, VISITS_STORAGE_KEY, CLIENTS_STORAGE_KEY} from "../constants/storageKeys.js";
import {
  clearCrmCollectionsCache,
  getInitialCrmCollections,
  getScopedKey,
  getStorageScope,
  loadStoredAlertFilter,
  loadStoredClients,
  loadStoredVisits,
  saveScopedValue,
  saveStoredValue,
} from "./crmStorage.js";

describe("crmStorage", () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    clearCrmCollectionsCache();
    globalThis.window = {
      localStorage: {
        getItem: vi.fn((key) => mockStorage[key] ?? null),
        setItem: vi.fn((key, value) => {
          mockStorage[key] = String(value);
        }),
        removeItem: vi.fn((key) => {
          delete mockStorage[key];
        }),
      },
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  it("does not throw when localStorage rejects a write", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.window = {
      localStorage: {
        setItem: vi.fn(() => {
          throw new Error("Quota exceeded");
        }),
      },
    };

    expect(() => saveStoredValue("crm:test", { value: 1 })).not.toThrow();
    expect(saveStoredValue("crm:test", { value: 1 })).toBe(false);
    expect(warning).toHaveBeenCalled();
  });

  it("keeps specialized notification filters between sessions", () => {
    mockStorage[ALERT_FILTER_STORAGE_KEY] = "finance";
    expect(loadStoredAlertFilter()).toBe("finance");

    mockStorage[ALERT_FILTER_STORAGE_KEY] = "closing";
    expect(loadStoredAlertFilter()).toBe("closing");
  });

  describe("storage partitioning and user isolation", () => {
    const ownerUser = { id: 1, role: "owner", email: "owner@nuarr.pl" };
    const staffUser = { id: 5, employeeId: 2, role: "staff", email: "maxim@nuarr.pl" };

    it("resolves correct storage scopes and scoped keys", () => {
      expect(getStorageScope(ownerUser)).toBe("owner");
      expect(getStorageScope(staffUser)).toBe("staff_5");

      const ownerKey = getScopedKey(VISITS_STORAGE_KEY, ownerUser);
      const staffKey = getScopedKey(VISITS_STORAGE_KEY, staffUser);

      expect(ownerKey).toBe(`nuar_crm_owner_${VISITS_STORAGE_KEY}`);
      expect(staffKey).toBe(`nuar_crm_staff_5_${VISITS_STORAGE_KEY}`);
    });

    it("ensures staff cannot read or overwrite owner data in localStorage", () => {
      const ownerVisits = [{ id: 101, client: "VIP Client", price: 500, master: "Olga" }];
      const staffVisits = [{ id: 202, client: "My Client", price: 200, master: "Maxim" }];

      // 1. Owner saves their visits
      saveScopedValue(VISITS_STORAGE_KEY, ownerVisits, ownerUser);
      expect(loadStoredVisits(ownerUser)).toEqual(ownerVisits);

      // 2. Staff user loads visits: must NOT see owner's visits, must default to []
      const loadedByStaff = loadStoredVisits(staffUser);
      expect(loadedByStaff).toEqual([]);

      // 3. Staff user saves their own visits
      saveScopedValue(VISITS_STORAGE_KEY, staffVisits, staffUser);
      expect(loadStoredVisits(staffUser)).toEqual(staffVisits);

      // 4. Owner user reloads: owner visits are completely preserved and untouched
      expect(loadStoredVisits(ownerUser)).toEqual(ownerVisits);
    });

    it("performs non-destructive migration of legacy owner data without data loss", () => {
      const legacyClients = [{ id: 1, name: "Legacy Client" }];
      mockStorage[CLIENTS_STORAGE_KEY] = JSON.stringify(legacyClients);

      // Owner loads: should migrate legacy data into scoped key without removing legacy key
      const clients = loadStoredClients(ownerUser);
      expect(clients).toEqual(legacyClients);

      const scopedOwnerKey = getScopedKey(CLIENTS_STORAGE_KEY, "owner");
      expect(mockStorage[scopedOwnerKey]).toBe(JSON.stringify(legacyClients));
      expect(mockStorage[CLIENTS_STORAGE_KEY]).toBe(JSON.stringify(legacyClients));

      // Staff user loading clients still does not get owner legacy data
      expect(loadStoredClients(staffUser)).toEqual([]);
    });

    it("partitions getInitialCrmCollections by user scope and supports cache clearing", () => {
      const ownerCollections = getInitialCrmCollections(ownerUser);
      const staffCollections = getInitialCrmCollections(staffUser);

      expect(ownerCollections.visits).toBeDefined();
      expect(staffCollections.visits).toEqual([]);
      expect(staffCollections.clients).toEqual([]);

      clearCrmCollectionsCache();
      const freshStaff = getInitialCrmCollections(staffUser);
      expect(freshStaff.visits).toEqual([]);
    });
  });
});
