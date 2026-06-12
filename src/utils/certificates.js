import {getTodayInput} from "./dateHelpers.js";
import {shiftAppDate} from "./dateUtils.js";
import {toDisplayDate, toInputDate} from "./formatters.jsx";
import {matchesClientRecord} from "./clientLinks.js";
import {toFinanceNumber} from "./finance.js";
import {toVisitNumber} from "./visits.jsx";

export const CERTIFICATE_ARCHIVED_STATUSES = new Set(["Погашен", "Просрочен", "Архив"]);

const CERTIFICATE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateCertificateCode = (existingCodes = []) => {
  const used = new Set(existingCodes.map((code) => String(code).toUpperCase()));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    let suffix = "";

    for (let index = 0; index < 6; index += 1) {
      suffix +=
        CERTIFICATE_CODE_ALPHABET[
          Math.floor(Math.random() * CERTIFICATE_CODE_ALPHABET.length)
        ];
    }

    const code = `NUAR-${suffix}`;

    if (!used.has(code)) {
      return code;
    }
  }

  return `NUAR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
};

export const computeCertificateExpiryDate = (
  purchaseDate,
  validityDays = 365,
) => {
  const baseDate = toInputDate(purchaseDate) || getTodayInput();
  const days = Math.max(1, Number(validityDays) || 365);

  return toDisplayDate(shiftAppDate(baseDate, days));
};

export const isCertificateExpired = (certificate, today = getTodayInput()) => {
  const expiryInput = toInputDate(certificate?.expiryDate);

  if (!expiryInput) {
    return false;
  }

  return expiryInput < today;
};

export const resolveCertificateStatus = (
  remainingBalance,
  nominal,
  status = "Активен",
  expiryDate = "",
) => {
  const remaining = Math.max(0, toFinanceNumber(remainingBalance));
  const total = Math.max(0, toFinanceNumber(nominal));
  const normalizedStatus = String(status ?? "Активен");

  if (remaining <= 0) {
    return "Погашен";
  }

  if (isCertificateExpired({expiryDate})) {
    return "Просрочен";
  }

  if (CERTIFICATE_ARCHIVED_STATUSES.has(normalizedStatus) && remaining > 0) {
    return remaining < total ? "Частично" : "Активен";
  }

  if (remaining < total) {
    return "Частично";
  }

  return "Активен";
};

export const syncCertificateStatus = (certificate) => ({
  ...certificate,
  status: resolveCertificateStatus(
    certificate.remainingBalance,
    certificate.nominal,
    certificate.status,
    certificate.expiryDate,
  ),
});

export const isArchivedCertificate = (certificate) => {
  if (!certificate) {
    return true;
  }

  return CERTIFICATE_ARCHIVED_STATUSES.has(String(certificate.status ?? ""));
};

export const isActiveCertificate = (certificate) =>
  !isArchivedCertificate(certificate);

export const matchesCertificateClient = (certificate, clients = [], clientRef) => {
  if (
    matchesClientRecord(
      {
        client: certificate?.client,
        clientId: certificate?.clientId,
      },
      clients,
      clientRef,
    )
  ) {
    return true;
  }

  if (
    certificate?.recipient &&
    matchesClientRecord(
      {
        client: certificate.recipient,
        clientId: certificate.recipientId,
      },
      clients,
      clientRef,
    )
  ) {
    return true;
  }

  return false;
};

export const getCertificateBalanceLabel = (certificate) => {
  const remaining = toFinanceNumber(certificate?.remainingBalance);
  const nominal = Math.max(toFinanceNumber(certificate?.nominal), remaining);

  return `${remaining} / ${nominal} zł`;
};

export const getCertificateRemainingPercent = (certificate) => {
  const nominal = Math.max(1, toFinanceNumber(certificate?.nominal));

  return Math.round(
    (Math.max(0, toFinanceNumber(certificate?.remainingBalance)) / nominal) * 100,
  );
};

export const computeCertificateRedemptionAmount = (
  certificate,
  visitAmount,
) => {
  const balance = Math.max(0, toFinanceNumber(certificate?.remainingBalance));
  const amount = Math.max(0, toFinanceNumber(visitAmount));

  if (!balance || !amount) {
    return 0;
  }

  return Math.min(balance, amount);
};

export const getVisitCertificateAmountUsed = (visit, certificates = []) => {
  const explicit = toFinanceNumber(visit?.certificateAmountUsed);

  if (explicit > 0) {
    return explicit;
  }

  if (!visit?.certificateUsageId) {
    return 0;
  }

  const certificate = certificates.find(
    (item) => String(item.id) === String(visit.certificateUsageId),
  );

  return computeCertificateRedemptionAmount(certificate, visit?.amount);
};

export const mergeLegacyCertificateSales = (
  visits = [],
  certificates = [],
  createLocalId = () => Date.now(),
) => {
  const linkedSaleVisitIds = new Set(
    certificates.map((item) => item.saleVisitId).filter(Boolean),
  );
  const existingCodes = certificates.map((item) => item.code).filter(Boolean);
  const migrated = [...certificates];

  visits
    .filter(
      (visit) =>
        visit.recordType === "operation" &&
        visit.service === "Продажа сертификата" &&
        !linkedSaleVisitIds.has(visit.id),
    )
    .forEach((visit) => {
      const nominal =
        toVisitNumber(visit.extra) || toVisitNumber(visit.amount) || 0;

      migrated.push(
        syncCertificateStatus({
          id: createLocalId(),
          code: generateCertificateCode(existingCodes),
          client: visit.client || "",
          clientId: visit.clientId || "",
          recipient: visit.client || "",
          recipientId: visit.clientId || "",
          nominal,
          remainingBalance: nominal,
          purchaseDate: visit.date,
          expiryDate: computeCertificateExpiryDate(visit.date),
          payment: visit.payment || "Не указано",
          master: visit.master || "",
          status: nominal > 0 ? "Активен" : "Погашен",
          note: visit.note || "Импорт из журнала оплат",
          saleVisitId: visit.id,
        }),
      );
      existingCodes.push(migrated.at(-1).code);
    });

  return migrated;
};

export const getActiveCertificatesForClient = (
  certificates = [],
  clients = [],
  clientRef,
) =>
  certificates.filter(
    (item) =>
      isActiveCertificate(item) &&
      matchesCertificateClient(item, clients, clientRef),
  );
