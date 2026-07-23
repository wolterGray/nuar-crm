import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";
import {telegramDigest} from "../api/functions.js";

const TELEGRAM_DIGEST_STATUS_CACHE_KEY = "telegram-daily-digest:status";

const invokeTelegramDigest = (body) => telegramDigest(body);

export const fetchTelegramDigestStatus = () =>
  withFunctionStatusCache(TELEGRAM_DIGEST_STATUS_CACHE_KEY, () =>
    invokeTelegramDigest({action: "status"}),
  );

export const previewTelegramDigest = () => Promise.resolve({message: null});

export const sendTelegramDigest = async ({chatId, text} = {}) => {
  clearFunctionStatusCache(TELEGRAM_DIGEST_STATUS_CACHE_KEY);
  return invokeTelegramDigest({action: "process", chatId, text});
};

export const sendTelegramDigestTest = ({message}) =>
  invokeTelegramDigest({
    action: "test",
    message,
  });
