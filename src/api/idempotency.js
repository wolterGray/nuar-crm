const mutationKeys = new Map();
const KEY_TTL_MS = 30_000;

const createKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getMutationKey = (scope, payload) => {
  const fingerprint = `${scope}:${JSON.stringify(payload)}`;
  const now = Date.now();
  const existing = mutationKeys.get(fingerprint);
  if (existing && existing.expiresAt > now) return existing.key;

  const key = createKey();
  mutationKeys.set(fingerprint, {expiresAt: now + KEY_TTL_MS, key});

  if (mutationKeys.size > 100) {
    mutationKeys.forEach((entry, candidate) => {
      if (entry.expiresAt <= now) mutationKeys.delete(candidate);
    });
  }

  return key;
};
