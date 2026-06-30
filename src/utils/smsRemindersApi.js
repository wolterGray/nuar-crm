import {supabase} from "../lib/supabase.js";
import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";

const SMS_REMINDERS_STATUS_CACHE_KEY = "visit-sms-reminders:status";

const invokeVisitSmsReminders = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke("visit-sms-reminders", {
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

export const fetchSmsReminderStatus = () =>
  withFunctionStatusCache(SMS_REMINDERS_STATUS_CACHE_KEY, () =>
    invokeVisitSmsReminders({action: "status"}),
  );

export const previewSmsReminders = () =>
  invokeVisitSmsReminders({action: "preview"});

export const processSmsReminders = async () => {
  clearFunctionStatusCache(SMS_REMINDERS_STATUS_CACHE_KEY);
  return invokeVisitSmsReminders({action: "process"});
};

export const sendSmsReminderTest = ({message, phone}) =>
  invokeVisitSmsReminders({
    action: "test",
    message,
    phone,
  });
