import {supabase} from "../lib/supabase.js";
import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";

const INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY = "inactive-client-follow-up:status";

const invokeInactiveFollowUp = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke(
    "inactive-client-follow-up",
    {
      body,
    },
  );

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
};

export const fetchInactiveFollowUpStatus = () =>
  withFunctionStatusCache(INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY, () =>
    invokeInactiveFollowUp({action: "status"}),
  );

export const previewInactiveFollowUp = () =>
  invokeInactiveFollowUp({action: "preview"});

export const processInactiveFollowUp = async () => {
  clearFunctionStatusCache(INACTIVE_FOLLOW_UP_STATUS_CACHE_KEY);
  return invokeInactiveFollowUp({action: "process"});
};

export const sendInactiveFollowUpTest = ({message, phone}) =>
  invokeInactiveFollowUp({
    action: "test",
    message,
    phone,
  });
