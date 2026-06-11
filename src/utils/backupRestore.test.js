import {describe, expect, it, vi} from "vitest";
import {createBackupSnapshot, restoreBackupSnapshot} from "./backupRestore.js";

describe("backupRestore", () => {
  it("creates snapshot with version and exportedAt", () => {
    const snapshot = createBackupSnapshot({visits: [], clients: []});

    expect(snapshot.version).toBe(1);
    expect(snapshot.exportedAt).toBeTruthy();
    expect(snapshot.visits).toEqual([]);
  });

  it("restores backup through provided setters", () => {
    const setters = {
      setAppSettings: vi.fn(),
      setCalendarEntries: vi.fn(),
      setClientPackages: vi.fn(),
      setClientProfiles: vi.fn(),
      setCommunicationLog: vi.fn(),
      setDismissedClientAlertIds: vi.fn(),
      setEmployees: vi.fn(),
      setImportDocuments: vi.fn(),
      setImportedMailIds: vi.fn(),
      setMessageTemplates: vi.fn(),
      setNotificationInbox: vi.fn(),
      setPackagesCatalog: vi.fn(),
      setServiceCatalog: vi.fn(),
      setSupplies: vi.fn(),
      setTasks: vi.fn(),
      setVisits: vi.fn(),
    };

    restoreBackupSnapshot(
      {
        calendarEntries: [],
        clientPackages: [],
        clients: [{id: 1, name: "Anna", source: "Instagram"}],
        communicationLog: [],
        dismissedClientAlertIds: [],
        employees: [],
        importDocuments: [],
        importedMailIds: [],
        messageTemplates: [],
        notificationInbox: [],
        packages: [],
        services: [],
        settings: {studioName: "NUAR Test"},
        supplies: [],
        tasks: [],
        visits: [{client: "Anna", commissionType: "Booksy 45%"}],
      },
      {
        defaultAppSettings: {studioName: "NUAR", ownerName: "Влад"},
        setters,
      },
    );

    expect(setters.setVisits).toHaveBeenCalled();
    expect(setters.setClientProfiles).toHaveBeenCalledWith([
      {id: 1, name: "Anna", source: "Booksy"},
    ]);
    expect(setters.setAppSettings).toHaveBeenCalledWith({
      studioName: "NUAR Test",
      ownerName: "Влад",
    });
  });
});
