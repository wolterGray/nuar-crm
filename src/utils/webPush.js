import {
  disablePushSubscription,
  fetchPushConfig,
  fetchPushSubscriptionStatus,
  registerPushSubscription,
} from "../api/pushNotifications.js";

const urlBase64ToUint8Array = (value) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

export const isIosDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalonePwa = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

export const getWebPushCapability = () => {
  if (!window.isSecureContext) return {supported: false, reason: "secure-context"};
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return {supported: false, reason: "browser"};
  }
  if (isIosDevice() && !isStandalonePwa()) {
    return {supported: false, reason: "ios-install-required"};
  }
  return {supported: true, reason: null};
};

export const getServiceWorkerRegistration = async () => {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing || navigator.serviceWorker.register("/sw.js", {scope: "/"});
};

export const getBrowserPushSubscription = async () => {
  if (!getWebPushCapability().supported) return null;
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
};

export const getCurrentPushState = async () => {
  const capability = getWebPushCapability();
  if (!capability.supported) return {...capability, state: "unsupported"};
  if (Notification.permission === "denied") return {...capability, state: "blocked"};

  const browserSubscription = await getBrowserPushSubscription();
  if (!browserSubscription) return {...capability, state: "disconnected"};
  const serverState = await fetchPushSubscriptionStatus(browserSubscription.endpoint);
  return {
    ...capability,
    browserSubscription,
    state: serverState.active ? "connected" : "disconnected",
  };
};

export const enableWebPush = async () => {
  const capability = getWebPushCapability();
  if (!capability.supported) return {...capability, state: "unsupported"};

  const config = await fetchPushConfig();
  if (!config.configured || !config.publicKey) {
    throw new Error("Web Push ещё не настроен на сервере");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {...capability, state: permission === "denied" ? "blocked" : "disconnected"};
  }

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    userVisibleOnly: true,
  });
  await registerPushSubscription(subscription, {
    deviceName: isIosDevice() ? "iPhone / iPad" : navigator.platform || "Browser",
    platform: isIosDevice() ? "ios" : navigator.userAgentData?.platform || navigator.platform || null,
  });
  return {...capability, browserSubscription: subscription, state: "connected"};
};

export const disableWebPush = async () => {
  const subscription = await getBrowserPushSubscription().catch(() => null);
  if (subscription) {
    await disablePushSubscription(subscription.endpoint).catch(() => null);
    await subscription.unsubscribe().catch(() => false);
  }
  return {state: "disconnected"};
};

export const detachWebPushOnLogout = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  await disableWebPush();
};
