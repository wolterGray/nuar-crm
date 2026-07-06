import {telegramDigest} from "../api/functions.js";
import {withFunctionStatusCache} from "./functionStatusCache.js";

const OWNER_NOTIFY_STATUS_CACHE_KEY = "telegram-daily-digest:owner-notify-status";

const invokeOwnerNotify = async (body) => {
  const data = await telegramDigest(body);

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
};

export const fetchOwnerNotifyStatus = () =>
  withFunctionStatusCache(OWNER_NOTIFY_STATUS_CACHE_KEY, () =>
    invokeOwnerNotify({action: "owner-notify-status"}),
  );

export const testOwnerNotify = () =>
  invokeOwnerNotify({action: "owner-notify-test"});
