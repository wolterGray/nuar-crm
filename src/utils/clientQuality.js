import {normalizeClientName} from "./clientLinks.js";

const normalizePhoneKey = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.startsWith("48") && digits.length === 11) {
    return digits.slice(2);
  }

  return digits;
};

const isBlank = (value) => !String(value ?? "").trim();

const groupByKey = (clients = [], getKey) => {
  const groups = new Map();

  clients.forEach((client) => {
    const key = getKey(client);

    if (!key) {
      return;
    }

    const current = groups.get(key) ?? [];
    current.push(client);
    groups.set(key, current);
  });

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({key, clients: group}));
};

export const buildClientQualityReport = (clients = []) => {
  const missingPhone = clients.filter((client) => isBlank(client.phone));
  const missingSource = clients.filter((client) => isBlank(client.source));
  const missingMessageLanguage = clients.filter((client) =>
    isBlank(client.messageLanguage),
  );
  const duplicatePhones = groupByKey(clients, (client) =>
    normalizePhoneKey(client.phone),
  );
  const duplicateNames = groupByKey(clients, (client) =>
    normalizeClientName(client.name),
  );
  const issuesCount =
    missingPhone.length +
    missingSource.length +
    missingMessageLanguage.length +
    duplicatePhones.length +
    duplicateNames.length;

  return {
    duplicateNames,
    duplicatePhones,
    hasIssues: issuesCount > 0,
    issuesCount,
    missingMessageLanguage,
    missingPhone,
    missingSource,
    score:
      clients.length === 0
        ? 100
        : Math.max(
            0,
            Math.round(
              100 -
                (issuesCount /
                  Math.max(1, clients.length * 3 + duplicatePhones.length)) *
                  100,
            ),
          ),
    totalClients: clients.length,
  };
};
