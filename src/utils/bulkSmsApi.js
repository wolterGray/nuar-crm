import {supabase} from "../lib/supabase.js";

const invokeBulkSms = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke("bulk-sms-send", {
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

export const fetchBulkSmsStatus = () => invokeBulkSms({action: "status"});

export const sendBulkSmsCampaign = ({
  recipients = [],
  segmentId = "",
  templateName = "",
}) =>
  invokeBulkSms({
    action: "send",
    recipients: recipients
      .filter((item) => item.status === "ready")
      .map((item) => ({
        clientId: item.clientId,
        clientName: item.clientName,
        message: item.message,
        phone: item.phone,
      })),
    segmentId,
    templateName,
  });

export const sendBulkSmsTest = ({message, phone}) =>
  invokeBulkSms({
    action: "test",
    message,
    phone,
  });
