const AUTH_DEVICE_ID_STORAGE_KEY = "nuar_crm_device_id";

const createDeviceId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getOrCreateAuthDeviceId = (storage = globalThis.localStorage) => {
  try {
    const stored = String(storage?.getItem(AUTH_DEVICE_ID_STORAGE_KEY) || "").trim();
    if (stored) return stored;
    const deviceId = createDeviceId();
    storage?.setItem(AUTH_DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    return createDeviceId();
  }
};

export {AUTH_DEVICE_ID_STORAGE_KEY};
