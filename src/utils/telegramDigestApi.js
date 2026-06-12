import {supabase} from "../lib/supabase.js";

const invokeTelegramDigest = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke("telegram-daily-digest", {
    body,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
};

export const fetchTelegramDigestStatus = () =>
  invokeTelegramDigest({action: "status"});

export const previewTelegramDigest = () =>
  invokeTelegramDigest({action: "preview"});

export const sendTelegramDigest = () =>
  invokeTelegramDigest({action: "process"});

export const sendTelegramDigestTest = ({message}) =>
  invokeTelegramDigest({
    action: "test",
    message,
  });
