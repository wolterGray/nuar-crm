import {describe, expect, it} from "vitest";
import {
  computeCertificateExpiryDate,
  computeCertificateRedemptionAmount,
  generateCertificateCode,
  getCertificateRemainingPercent,
  isActiveCertificate,
  mergeLegacyCertificateSales,
  resolveCertificateStatus,
  syncCertificateStatus,
} from "./certificates.js";

describe("certificates", () => {
  it("generates unique certificate codes", () => {
    const first = generateCertificateCode();
    const second = generateCertificateCode([first]);

    expect(first).toMatch(/^NUAR-[A-Z0-9]{6}$/);
    expect(second).not.toBe(first);
  });

  it("resolves certificate status from balance", () => {
    expect(resolveCertificateStatus(0, 500)).toBe("Погашен");
    expect(resolveCertificateStatus(250, 500)).toBe("Частично");
    expect(resolveCertificateStatus(500, 500)).toBe("Активен");
  });

  it("computes redemption amount", () => {
    expect(
      computeCertificateRedemptionAmount({remainingBalance: 300}, 450),
    ).toBe(300);
    expect(
      computeCertificateRedemptionAmount({remainingBalance: 500}, 250),
    ).toBe(250);
  });

  it("computes remaining percent", () => {
    expect(
      getCertificateRemainingPercent({nominal: 400, remainingBalance: 100}),
    ).toBe(25);
  });

  it("migrates legacy certificate sales from visits", () => {
    const migrated = mergeLegacyCertificateSales(
      [
        {
          id: "sale-1",
          recordType: "operation",
          service: "Продажа сертификата",
          client: "Anna",
          date: "01.06.2026",
          extra: 400,
          payment: "Наличные",
        },
      ],
      [],
      () => "cert-1",
    );

    expect(migrated).toHaveLength(1);
    expect(migrated[0].nominal).toBe(400);
    expect(migrated[0].saleVisitId).toBe("sale-1");
    expect(isActiveCertificate(migrated[0])).toBe(true);
  });

  it("syncs expired certificates", () => {
    const certificate = syncCertificateStatus({
      nominal: 500,
      remainingBalance: 500,
      expiryDate: "01.01.2020",
      status: "Активен",
    });

    expect(certificate.status).toBe("Просрочен");
  });

  it("computes expiry date from purchase date", () => {
    expect(computeCertificateExpiryDate("2026-06-01", 30)).toBe("01.07.2026");
  });
});
