import {supabase} from "../lib/supabase.js";

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
  invokeVisitSmsReminders({action: "status"});

export const previewSmsReminders = () =>
  invokeVisitSmsReminders({action: "preview"});

export const processSmsReminders = () =>
  invokeVisitSmsReminders({action: "process"});

export const sendSmsReminderTest = ({message, phone}) =>
  invokeVisitSmsReminders({
    action: "test",
    message,
    phone,
  });
