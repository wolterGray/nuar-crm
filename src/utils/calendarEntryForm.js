import {attachClientLink} from "./clientLinks.js";
import {computeCertificateRedemptionAmount} from "./certificates.js";
import {toDisplayDate} from "./formatters.jsx";
import {normalizeCalendarEntryTiming} from "./calendarEntryTiming.js";
import {toVisitNumber} from "./visits.jsx";

const toCalendarMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

export const buildCalendarEntryFromForm = (
  form,
  {
    certificates = [],
    clientPackages,
    clientProfiles,
    createLocalId,
    editingCalendarEntry,
    getCalendarServiceColor,
    serviceCatalog,
  },
) => {
  const kind = form.get("kind");
  const service = serviceCatalog.find(
    (item) => String(item.id) === String(form.get("serviceId")),
  );
  const packageUsageId = Number(form.get("packageUsageId")) || "";
  const certificateUsageId = form.get("certificateUsageId") || "";
  const selectedCertificate = certificates.find(
    (item) => String(item.id) === String(certificateUsageId),
  );
  const startTime = String(form.get("time") ?? "00:00");
  const endTime = String(form.get("endTime") ?? "00:00");
  const duration =
    kind === "visit"
      ? Number(form.get("duration")) || 60
      : Math.max(15, toCalendarMinutes(endTime) - toCalendarMinutes(startTime));
  const serviceVariant = service?.variants?.find(
    (variant) => Number(variant.duration) === duration,
  );
  const rawAmount = String(form.get("amount") ?? "").trim();
  const entryDraft = {
    id: editingCalendarEntry?.id ?? createLocalId(),
    status: editingCalendarEntry?.status ?? "scheduled",
    completedAt: editingCalendarEntry?.completedAt ?? "",
    visitId: editingCalendarEntry?.visitId ?? "",
    kind,
    date: form.get("date"),
    time: startTime,
    duration,
    master: form.get("master"),
    title: kind === "visit" ? "" : String(form.get("title") ?? "").trim(),
    client: kind === "visit" ? form.get("client") : "",
    serviceId: kind === "visit" ? Number(form.get("serviceId")) : "",
    service: kind === "visit" ? service?.name ?? "" : "",
    amount:
      kind === "visit"
        ? rawAmount === ""
          ? toVisitNumber(serviceVariant?.price)
          : toVisitNumber(rawAmount)
        : 0,
    payment: kind === "visit" ? form.get("payment") : "",
    packageUsageId,
    packageName:
      clientPackages.find((item) => item.id === packageUsageId)?.packageName ?? "",
    packageSessionsUsed: packageUsageId ? 1 : 0,
    certificateUsageId,
    certificateCode: selectedCertificate?.code ?? "",
    certificateAmountUsed:
      kind === "visit" && form.get("payment") === "Сертификат"
        ? computeCertificateRedemptionAmount(
            selectedCertificate,
            rawAmount === ""
              ? toVisitNumber(serviceVariant?.price)
              : toVisitNumber(rawAmount),
          )
        : 0,
    tip: kind === "visit" ? toVisitNumber(form.get("tip")) : 0,
    extra: kind === "visit" ? toVisitNumber(form.get("extra")) : 0,
    debt: kind === "visit" ? toVisitNumber(form.get("debt")) : 0,
    discount: kind === "visit" ? toVisitNumber(form.get("discount")) : 0,
    commissionType:
      kind === "visit"
        ? String(form.get("commissionType") ?? "Без комиссии")
        : "Без комиссии",
    color:
      kind === "visit"
        ? getCalendarServiceColor({
            kind,
            serviceId: form.get("serviceId"),
            service: service?.name,
            color: form.get("color"),
          })
        : form.get("color") || "#748091",
    note: String(form.get("note") ?? "").trim(),
  };
  const linkedEntryDraft =
    kind === "visit" ? attachClientLink(clientProfiles, entryDraft) : entryDraft;

  return normalizeCalendarEntryTiming(linkedEntryDraft, editingCalendarEntry);
};

export const buildJournalVisitUpdateFromEntry = (
  previousVisit,
  entry,
  clientProfiles,
) =>
  attachClientLink(clientProfiles, {
    ...previousVisit,
    date: toDisplayDate(entry.date),
    client: entry.client,
    clientId: entry.clientId,
    master: entry.master,
    service: entry.service,
    duration: entry.duration,
    amount: entry.amount,
    payment: entry.payment || "Не указано",
    packageUsageId: entry.packageUsageId || "",
    packageName: entry.packageName || "",
    packageSessionsUsed: entry.packageSessionsUsed || 0,
    certificateUsageId: entry.certificateUsageId || "",
    certificateCode: entry.certificateCode || "",
    certificateAmountUsed: entry.certificateAmountUsed || 0,
    tip: entry.tip,
    commissionType: entry.commissionType || "Без комиссии",
    extra: entry.extra,
    debt: entry.debt,
    discount: entry.discount,
    note: entry.note || "",
  });
