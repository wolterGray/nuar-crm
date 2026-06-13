import {
  formatSiteBookingDateForCrm,
  formatSiteBookingTimeForCrm,
  normalizeSiteBookingPhone,
  resolveSiteBookingMaster,
  resolveSiteBookingService,
} from "./siteBooking.js";

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
  const entry = {
    id: createLocalId(),
    kind: "visit",
    status: "scheduled",
    completedAt: "",
    visitId: "",
    date: formatSiteBookingDateForCrm(
      request.preferred_date ?? request.preferredDate,
    ),
    time: formatSiteBookingTimeForCrm(
      request.preferred_time ?? request.preferredTime,
    ),
    duration: service.duration,
    master: resolveSiteBookingMaster(request.preferred_master, employees),
    client: client.name,
    clientId: client.id,
    serviceId: service.serviceId,
    service: service.service,
    amount: service.amount,
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
