export const normalizeClientName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const findClientById = (clients = [], clientId) => {
  if (clientId === undefined || clientId === null || clientId === "") {
    return null;
  }

  return (
    clients.find((client) => String(client.id) === String(clientId)) ?? null
  );
};

export const findClientByName = (clients = [], name) => {
  const normalizedName = normalizeClientName(name);

  if (!normalizedName) {
    return null;
  }

  return (
    clients.find(
      (client) => normalizeClientName(client.name) === normalizedName,
    ) ?? null
  );
};

export const resolveClientName = (clients = [], record = {}) => {
  const linkedClient = findClientById(clients, record.clientId);

  if (linkedClient) {
    return linkedClient.name;
  }

  return String(record.client ?? record.clientName ?? "").trim();
};

export const resolveClientId = (clients = [], record = {}) => {
  const linkedClient =
    findClientById(clients, record.clientId) ??
    findClientByName(clients, record.client ?? record.clientName);

  return linkedClient ? linkedClient.id : "";
};

export const attachClientLink = (clients = [], record = {}) => {
  const clientName = resolveClientName(clients, record);
  const clientId = resolveClientId(clients, {...record, client: clientName});

  return {
    ...record,
    client: clientName,
    ...(clientId ? {clientId} : {}),
  };
};

export const linkRecordToClient = (record, client) => {
  if (!client) {
    return record;
  }

  return {
    ...record,
    client: client.name,
    clientId: client.id,
  };
};

export const matchesClientRecord = (record, clients = [], clientRef) => {
  const client =
    typeof clientRef === "object" && clientRef !== null
      ? clientRef
      : findClientByName(clients, clientRef);
  const clientName =
    typeof clientRef === "string"
      ? clientRef
      : client?.name ?? record?.client ?? "";

  if (
    client?.id &&
    record?.clientId &&
    String(record.clientId) === String(client.id)
  ) {
    return true;
  }

  return (
    normalizeClientName(record?.client) === normalizeClientName(clientName)
  );
};

export const migrateClientLinks = (
  clients = [],
  {visits = [], calendarEntries = [], clientPackages = []} = {},
) => ({
  visits: visits.map((visit) => attachClientLink(clients, visit)),
  calendarEntries: calendarEntries.map((entry) =>
    entry.kind === "visit" ? attachClientLink(clients, entry) : entry,
  ),
  clientPackages: clientPackages.map((packageItem) =>
    attachClientLink(clients, packageItem),
  ),
});

export const migrateCrmSnapshot = (snapshot = {}) => {
  const clients = Array.isArray(snapshot.clients) ? snapshot.clients : [];
  const visits = Array.isArray(snapshot.visits) ? snapshot.visits : [];
  const calendarEntries = Array.isArray(snapshot.calendarEntries)
    ? snapshot.calendarEntries
    : [];
  const clientPackages = Array.isArray(snapshot.clientPackages)
    ? snapshot.clientPackages
    : [];
  const migrated = migrateClientLinks(clients, {
    visits,
    calendarEntries,
    clientPackages,
  });

  return {
    ...snapshot,
    clients,
    ...migrated,
  };
};

export const remapClientRecords = (
  records = [],
  clients = [],
  previousClient,
  nextClient,
  {visitOnly = false} = {},
) =>
  records.map((record) => {
    if (visitOnly && record.kind && record.kind !== "visit") {
      return record;
    }

    if (!matchesClientRecord(record, clients, previousClient ?? nextClient)) {
      return record;
    }

    return linkRecordToClient(record, nextClient);
  });
