import {describe, expect, it} from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  getBackupPreview,
  validateBackupStructure,
} from "./backupFormat.js";

const validBackup = {
  version: BACKUP_SCHEMA_VERSION,
  exportedAt: "2026-06-11T10:00:00.000Z",
  visits: [],
  employees: [],
  clients: [],
  services: [],
  packages: [],
  clientPackages: [],
  messageTemplates: [],
  calendarEntries: [],
  settings: {},
};

describe("validateBackupStructure", () => {
  it("accepts a valid backup", () => {
    expect(validateBackupStructure(validBackup)).toEqual({
      ok: true,
      version: 1,
    });
  });

  it("rejects backups without version", () => {
    const result = validateBackupStructure({...validBackup, version: undefined});

    expect(result.ok).toBe(false);
  });

  it("rejects backups newer than current schema", () => {
    const result = validateBackupStructure({
      ...validBackup,
      version: BACKUP_SCHEMA_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("новее");
  });

  it("builds preview counts", () => {
    const preview = getBackupPreview({
      ...validBackup,
      visits: [{id: 1}],
      clients: [{id: 1}, {id: 2}],
    });

    expect(preview.counts.visits).toBe(1);
    expect(preview.counts.clients).toBe(2);
  });
});
