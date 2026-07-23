import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";
import {smsReminders} from "../api/functions.js";

const SMS_REMINDERS_STATUS_CACHE_KEY = "visit-sms-reminders:status";

const invokeVisitSmsReminders = (body) => smsReminders(body);

export const fetchSmsReminderStatus = () =>
  withFunctionStatusCache(SMS_REMINDERS_STATUS_CACHE_KEY, () =>
    invokeVisitSmsReminders({action: "status"}),
  );

export const previewSmsReminders = () => Promise.resolve({due: []});

export const processSmsReminders = async ({reminders = []} = {}) => {
  clearFunctionStatusCache(SMS_REMINDERS_STATUS_CACHE_KEY);
  return invokeVisitSmsReminders({action: "process", reminders});
};

export const sendSmsReminderTest = ({message, phone}) =>
  invokeVisitSmsReminders({
    action: "test",
    message,
    phone,
  });
