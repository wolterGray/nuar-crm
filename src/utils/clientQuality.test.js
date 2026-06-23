import {describe, expect, it} from "vitest";
import {buildClientQualityReport} from "./clientQuality.js";

describe("clientQuality", () => {
  it("detects duplicate contacts and missing client fields", () => {
    const report = buildClientQualityReport([
      {
        id: 1,
        name: "Anna Kowalska",
        phone: "+48 600 123 456",
        source: "Instagram",
        messageLanguage: "Польский",
      },
      {
        id: 2,
        name: "anna kowalska",
        phone: "600123456",
        source: "",
        messageLanguage: "",
      },
      {
        id: 3,
        name: "Piotr",
        phone: "",
        source: "Booksy",
        messageLanguage: "Польский",
      },
    ]);

    expect(report.duplicatePhones).toHaveLength(1);
    expect(report.duplicateNames).toHaveLength(1);
    expect(report.missingPhone).toHaveLength(1);
    expect(report.missingSource).toHaveLength(1);
    expect(report.missingMessageLanguage).toHaveLength(1);
    expect(report.hasIssues).toBe(true);
  });
});
