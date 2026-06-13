import {findClientById, findClientByName} from "./clientLinks.js";

export const extractMessageName = (fullName) => {
  let name = String(fullName ?? "").trim();

  if (!name) {
    return "";
  }

  const referredMatch = name.match(/^(.+?)\s+(?:от|od)\s+.+/iu);

  if (referredMatch?.[1]) {
    name = referredMatch[1].trim();
  }

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    name = parts[0];
  }

  return name.replace(/[.,!?;:]+$/u, "").trim();
};

export const getClientMessageName = (client) => {
  const explicit = String(client?.messageName ?? "").trim();

  if (explicit) {
    return explicit;
  }

  return extractMessageName(client?.name);
};

export const resolveClientMessageName = (
  clientProfiles = [],
  {client, clientId, clientName} = {},
) => {
  const linkedClient =
    findClientById(clientProfiles, clientId) ??
    findClientByName(clientProfiles, client ?? clientName) ??
    (typeof client === "object" && client !== null ? client : null);

  if (linkedClient) {
    return getClientMessageName(linkedClient);
  }

  return extractMessageName(client ?? clientName);
};
