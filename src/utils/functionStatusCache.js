const DEFAULT_STATUS_CACHE_TTL_MS = 60_000;

const statusCache = new Map();

export const clearFunctionStatusCache = (keyPrefix = "") => {
  if (!keyPrefix) {
    statusCache.clear();
    return;
  }

  for (const key of statusCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      statusCache.delete(key);
    }
  }
};

export const withFunctionStatusCache = async (
  key,
  loader,
  ttlMs = DEFAULT_STATUS_CACHE_TTL_MS,
) => {
  const cached = statusCache.get(key);

  if (cached && Date.now() - cached.cachedAt < ttlMs) {
    return cached.data;
  }

  const data = await loader();
  statusCache.set(key, {cachedAt: Date.now(), data});
  return data;
};
