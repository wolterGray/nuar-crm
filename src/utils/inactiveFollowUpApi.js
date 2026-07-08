import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";
import {bulkSms, smsReminders} from "../api/functions.js";

const INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY = "inactive-client-follow-up:status";

const invokeInactiveFollowUp = (body) => smsReminders(body);

export const fetchInactiveFollowUpStatus = () =>
  withFunctionStatusCache(INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY, () =>
    bulkSms({action: "status"}).then((status) => ({
      ...status,
      dueCount: 0,
      recentLog: [],
      skippedCount: 0,
    })),
  );

export const previewInactiveFollowUp = () => Promise.resolve({due: []});

export const processInactiveFollowUp = async ({followUps = []} = {}) => {
  clearFunctionStatusCache(INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY);
  return invokeInactiveFollowUp({
    reminders: followUps.map((item) => ({
      message: item.message,
      phone: item.phone,
    })),
  });
};

export const sendInactiveFollowUpTest = ({message, phone}) =>
  invokeInactiveFollowUp({
    action: "test",
    message,
    phone,
  });
