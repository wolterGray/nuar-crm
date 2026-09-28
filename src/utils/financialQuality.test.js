import {describe, expect, it} from "vitest";
import {buildFinancialQualityReport} from "./financialQuality.js";

describe("financialQuality", () => {
  it("flags completed calendar entries without a completed visit", () => {
    const report = buildFinancialQualityReport({
      calendarEntries: [
        {
          id: 1,
          kind: "visit",
          date: "2026-09-28",
          time: "10:00",
          client: "Anna",
          status: "completed",
        },
      ],
      completedVisits: [],
    });

    expect(report.issues[0]).toMatchObject({
      priority: "critical",
      type: "missing_completed_visit",
    });
  });

  it("flags completed visits without employee earnings", () => {
    const report = buildFinancialQualityReport({
      calendarEntries: [
        {
          id: 1,
          kind: "visit",
          date: "2026-09-28",
          time: "10:00",
          client: "Anna",
          status: "completed",
          visitId: 11,
        },
      ],
      completedVisits: [{id: 11, employeeEarnings: []}],
    });

    expect(report.issues[0]).toMatchObject({
      id: "missing-earning-1",
      type: "missing_earning",
    });
  });

  it("flags paired visits with too few earnings", () => {
    const report = buildFinancialQualityReport({
      calendarEntries: [
        {
          id: 1,
          kind: "visit",
          date: "2026-09-28",
          time: "10:00",
          client: "Anna",
          master: "Natali",
          parallelEmployees: [{name: "Natali"}, {name: "Max"}],
          status: "completed",
          visitId: 11,
        },
      ],
      completedVisits: [{id: 11, employeeEarnings: [{id: 100, employeeId: 1}]}],
    });

    expect(report.issues[0]).toMatchObject({
      id: "missing-paired-earning-1",
      type: "missing_paired_earning",
    });
  });

  it("flags package and certificate payments without selected source", () => {
    const report = buildFinancialQualityReport({
      calendarEntries: [
        {
          id: 1,
          kind: "visit",
          date: "2026-09-28",
          payment: "Пакет",
          status: "completed",
          visitId: 11,
        },
        {
          id: 2,
          kind: "visit",
          date: "2026-09-28",
          payment: "Сертификат",
          status: "completed",
          visitId: 12,
        },
      ],
      completedVisits: [
        {id: 11, employeeEarnings: [{id: 100}]},
        {id: 12, employeeEarnings: [{id: 101}]},
      ],
    });

    expect(report.issues.map((issue) => issue.type)).toEqual([
      "missing_package_link",
      "missing_certificate_link",
    ]);
  });
});
