import {supabase} from "../lib/supabase.js";

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
  invokeInactiveFollowUp({action: "status"});

export const previewInactiveFollowUp = () =>
  invokeInactiveFollowUp({action: "preview"});

export const processInactiveFollowUp = () =>
  invokeInactiveFollowUp({action: "process"});

export const sendInactiveFollowUpTest = ({message, phone}) =>
  invokeInactiveFollowUp({
    action: "test",
    message,
    phone,
  });
