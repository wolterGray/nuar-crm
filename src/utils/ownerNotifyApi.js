import {supabase} from "../lib/supabase.js";
import {withFunctionStatusCache} from "./functionStatusCache.js";

const OWNER_NOTIFY_STATUS_CACHE_KEY = "telegram-daily-digest:owner-notify-status";

const invokeTelegramDigest = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke("telegram-daily-digest", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Не удалось вызвать telegram-daily-digest");
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
};

export const fetchOwnerNotifyStatus = () =>
  withFunctionStatusCache(OWNER_NOTIFY_STATUS_CACHE_KEY, () =>
    invokeTelegramDigest({action: "owner-notify-status"}),
  );

export const testOwnerNotify = () =>
  invokeTelegramDigest({action: "owner-notify-test"});
