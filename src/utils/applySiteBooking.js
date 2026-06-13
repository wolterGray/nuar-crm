import {
  formatSiteBookingInputDate,
  formatSiteBookingTimeForCrm,
  normalizeSiteBookingPhone,
  resolveSiteBookingMaster,
  resolveSiteBookingService,
} from "./siteBooking.js";
import {
  calculateSiteBookingPrice,
  findEmployeeForMaster,
} from "./siteBookingPricing.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

export const applySiteBookingRequest = (
  request,
  {
    calendarEntries,
    clientProfiles,
    createLocalId,
    employees = [],
    getCalendarServiceColor,
    serviceCatalog = [],
  },
) => {
  let nextClients = [...clientProfiles];
  let nextCalendarEntries = [...calendarEntries];
  const clientName = String(request.client_name ?? request.clientName ?? "").trim();
  const clientPhone = normalizeSiteBookingPhone(
    request.client_phone ?? request.clientPhone,
  );
  const clientEmail = String(request.client_email ?? request.clientEmail ?? "").trim();

  let client = nextClients.find(
    (candidate) =>
      clientEmail && normalizeText(candidate.email) === normalizeText(clientEmail),
  );
  client ??= nextClients.find(
    (candidate) =>
      clientPhone &&
      normalizeSiteBookingPhone(candidate.phone) === clientPhone,
  );
  client ??= nextClients.find(
    (candidate) => normalizeText(candidate.name) === normalizeText(clientName),
  );

  if (!client) {
    client = {
      id: createLocalId(),
      name: clientName,
      phone: clientPhone,
      email: clientEmail,
      birthday: "",
      instagram: "",
      telegram: "",
      source: "Сайт",
      preference: resolveSiteBookingMaster(request.preferred_master, employees),
      status: "Новый",
      tags: "site",
      note: "Заявка с nuarr.pl",
    };
    nextClients = [client, ...nextClients];
  }

  const service = resolveSiteBookingService(request, serviceCatalog);
  const master = resolveSiteBookingMaster(request.preferred_master, employees);
  const employee = findEmployeeForMaster(master, employees);
  const preferredTime = formatSiteBookingTimeForCrm(
    request.preferred_time ?? request.preferredTime,
  );
  const pricing = calculateSiteBookingPrice({
    basePrice: service.amount,
    date:
      formatSiteBookingInputDate(request.preferred_date ?? request.preferredDate) ||
      String(request.preferred_date ?? request.preferredDate ?? ""),
    employee,
    time: preferredTime,
  });
  const entry = {
    id: createLocalId(),
    kind: "visit",
    status: "scheduled",
    completedAt: "",
    visitId: "",
    date: formatSiteBookingInputDate(
      request.preferred_date ?? request.preferredDate,
    ) ||
      String(request.preferred_date ?? request.preferredDate ?? "").slice(0, 10),
    time: preferredTime,
    duration: service.duration,
    master,
    client: client.name,
    clientId: client.id,
    serviceId: service.serviceId,
    service: service.service,
    amount: pricing.subtotal,
    discount: pricing.discountPercent,
    payment: "Не указано",
    packageUsageId: "",
    packageName: "",
    packageSessionsUsed: 0,
    color: getCalendarServiceColor({
      kind: "visit",
      serviceId: service.serviceId,
      service: service.service,
    }),
    note: request.note
      ? `С сайта: ${request.note}`
      : "Заявка с nuarr.pl",
    externalSource: "site",
    externalBookingId: request.id,
  };

  nextCalendarEntries = [...nextCalendarEntries, entry];

  return {
    calendarEntryId: entry.id,
    nextCalendarEntries,
    nextClients,
  };
};
