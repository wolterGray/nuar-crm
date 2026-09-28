import {getEntryMasters} from "./parallelVisits.js";

const normalizePayment = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("ł", "l");

const getVisitPayload = (visit) =>
  visit?.payload && typeof visit.payload === "object" ? visit.payload : visit ?? {};

const getEntryVisit = (entry, completedVisits = []) => {
  const entryVisitId = Number(entry?.visitId);
  if (Number.isInteger(entryVisitId) && entryVisitId > 0) {
    const byVisitId = completedVisits.find((visit) => Number(visit.id) === entryVisitId);
    if (byVisitId) return byVisitId;
  }

  const entryId = Number(entry?.id);
  if (!Number.isInteger(entryId) || entryId <= 0) return null;

  return completedVisits.find((visit) => Number(visit.calendarEntryId) === entryId) ?? null;
};

const getEarnings = (visit) => {
  if (Array.isArray(visit?.employeeEarnings)) return visit.employeeEarnings;
  if (visit?.employeeEarning) return [visit.employeeEarning];
  return [];
};

const isCompletedVisitEntry = (entry) =>
  entry?.kind === "visit" && String(entry.status ?? "") === "completed";

const isPackagePayment = (entry) => {
  const payment = normalizePayment(entry?.payment);
  return payment.includes("пакет") || payment.includes("pakiet") || payment.includes("package");
};

const isCertificatePayment = (entry) => {
  const payment = normalizePayment(entry?.payment);
  return (
    payment.includes("сертификат") ||
    payment.includes("certyfikat") ||
    payment.includes("certificate")
  );
};

const buildIssue = ({entry, id, message, priority = "action", title, type}) => ({
  action: "calendar",
  date: entry?.date ?? "",
  entryId: entry?.id ?? "",
  id,
  message,
  priority,
  title,
  type,
});

export const buildFinancialQualityReport = ({
  calendarEntries = [],
  completedVisits = [],
} = {}) => {
  const issues = [];

  calendarEntries.filter(isCompletedVisitEntry).forEach((entry) => {
    const visit = getEntryVisit(entry, completedVisits);
    const payload = getVisitPayload(visit);
    const earnings = getEarnings(visit);
    const masters = getEntryMasters(entry);
    const expectedEarningsCount = Math.max(
      1,
      Number(entry.parallelParticipants ?? entry.payload?.parallelParticipants) ||
        masters.length ||
        1,
    );
    const label = `${entry.date || ""} ${entry.time || ""} · ${entry.client || "Клиент"}`.trim();

    if (!visit) {
      issues.push(
        buildIssue({
          entry,
          id: `completed-without-visit-${entry.id}`,
          message: label,
          priority: "critical",
          title: "Завершённый визит не попал в финансы",
          type: "missing_completed_visit",
        }),
      );
      return;
    }

    if (earnings.length === 0) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-earning-${entry.id}`,
          message: label,
          priority: "critical",
          title: "Нет начисления сотруднику",
          type: "missing_earning",
        }),
      );
    } else if (expectedEarningsCount > 1 && earnings.length < expectedEarningsCount) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-paired-earning-${entry.id}`,
          message: `${label} · начислений ${earnings.length}/${expectedEarningsCount}`,
          priority: "critical",
          title: "Парный визит начислен не всем",
          type: "missing_paired_earning",
        }),
      );
    }

    if (isPackagePayment(entry) && !Number(entry.packageUsageId ?? payload.packageUsageId)) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-package-link-${entry.id}`,
          message: label,
          priority: "critical",
          title: "Пакетная оплата без выбранного пакета",
          type: "missing_package_link",
        }),
      );
    }

    if (isCertificatePayment(entry) && !Number(entry.certificateUsageId ?? payload.certificateUsageId)) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-certificate-link-${entry.id}`,
          message: label,
          priority: "critical",
          title: "Сертификат без выбранного сертификата",
          type: "missing_certificate_link",
        }),
      );
    }
  });

  const priorityOrder = {critical: 0, action: 1, info: 2};
  const sortedIssues = issues.sort(
    (left, right) =>
      (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2) ||
      String(left.date).localeCompare(String(right.date)),
  );

  return {
    criticalCount: sortedIssues.filter((issue) => issue.priority === "critical").length,
    issues: sortedIssues,
    ok: sortedIssues.length === 0,
    warningCount: sortedIssues.filter((issue) => issue.priority === "action").length,
  };
};
