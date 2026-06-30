import {supabase} from "../lib/supabase.js";
import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";

const TELEGRAM_DIGEST_STATUS_CACHE_KEY = "telegram-daily-digest:status";

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

export const fetchTelegramDigestStatus = () =>
  withFunctionStatusCache(TELEGRAM_DIGEST_STATUS_CACHE_KEY, () =>
    invokeTelegramDigest({action: "status"}),
  );

export const previewTelegramDigest = () =>
  invokeTelegramDigest({action: "preview"});

export const sendTelegramDigest = async () => {
  clearFunctionStatusCache(TELEGRAM_DIGEST_STATUS_CACHE_KEY);
  return invokeTelegramDigest({action: "process"});
};

export const sendTelegramDigestTest = ({message}) =>
  invokeTelegramDigest({
    action: "test",
    message,
  });
