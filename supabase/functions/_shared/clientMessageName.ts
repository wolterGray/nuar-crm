export const extractMessageName = (fullName?: string) => {
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

type ClientProfile = {
  id?: string | number;
  name?: string;
  messageName?: string;
};

export const getClientMessageName = (client?: ClientProfile | null) => {
  const explicit = String(client?.messageName ?? "").trim();

  if (explicit) {
    return explicit;
  }

  return extractMessageName(client?.name);
};

export const resolveClientMessageName = (
  clientProfiles: ClientProfile[] = [],
  {
    client,
    clientId,
    clientName,
  }: {
    client?: string;
    clientId?: string | number;
    clientName?: string;
  } = {},
) => {
  const linkedClient =
    clientProfiles.find((item) => String(item.id) === String(clientId)) ??
    clientProfiles.find(
      (item) =>
        String(item.name ?? "").trim().toLowerCase() ===
        String(client ?? clientName ?? "")
          .trim()
          .toLowerCase(),
    );

  if (linkedClient) {
    return getClientMessageName(linkedClient);
  }

  return extractMessageName(client ?? clientName);
};
