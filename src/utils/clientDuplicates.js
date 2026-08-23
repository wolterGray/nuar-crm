import {normalizeClientName} from "./clientLinks.js";

export const normalizeClientPhone = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.startsWith("48") && digits.length === 11) {
    return digits.slice(2);
  }

  return digits;
};

const normalizeHandle = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^https?:\/\/(www\.)?t\.me\//, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");

const compactName = (value) => normalizeClientName(value).replace(/\s+/g, " ");

const getNameTokens = (value) =>
  compactName(value)
    .split(" ")
    .filter((token) => token.length >= 3);

const getNameSimilarity = (left, right) => {
  const leftName = compactName(left);
  const rightName = compactName(right);

  if (!leftName || !rightName) return 0;
  if (leftName === rightName) return 1;
  if (leftName.includes(rightName) || rightName.includes(leftName)) return 0.82;

  const leftTokens = getNameTokens(leftName);
  const rightTokens = getNameTokens(rightName);
  const matches = leftTokens.filter((token) => rightTokens.includes(token)).length;

  return matches / Math.max(leftTokens.length, rightTokens.length, 1);
};

export const findClientDuplicateCandidates = (
  clients = [],
  draft = {},
  {excludeClientId} = {},
) => {
  const name = String(draft.name ?? "").trim();
  const phone = normalizeClientPhone(draft.phone);
  const instagram = normalizeHandle(draft.instagram);
  const telegram = normalizeHandle(draft.telegram);

  if (!name && !phone && !instagram && !telegram) {
    return [];
  }

  return clients
    .filter((client) => String(client?.id) !== String(excludeClientId ?? ""))
    .map((client) => {
      const reasons = [];
      const clientPhone = normalizeClientPhone(client.phone);
      const clientInstagram = normalizeHandle(client.instagram);
      const clientTelegram = normalizeHandle(client.telegram);
      const nameSimilarity = getNameSimilarity(name, client.name);

      if (phone && clientPhone && phone === clientPhone) reasons.push("телефон");
      if (instagram && clientInstagram && instagram === clientInstagram) {
        reasons.push("Instagram");
      }
      if (telegram && clientTelegram && telegram === clientTelegram) {
        reasons.push("Telegram");
      }
      if (name && nameSimilarity >= 1) reasons.push("точное имя");
      else if (name && nameSimilarity >= 0.65) reasons.push("похожее имя");

      return {
        client,
        isBlocking: reasons.some((reason) =>
          ["телефон", "Instagram", "Telegram", "точное имя"].includes(reason),
        ),
        reasons,
        score:
          (phone && clientPhone && phone === clientPhone ? 10 : 0) +
          (instagram && clientInstagram && instagram === clientInstagram ? 8 : 0) +
          (telegram && clientTelegram && telegram === clientTelegram ? 8 : 0) +
          nameSimilarity,
      };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
};
