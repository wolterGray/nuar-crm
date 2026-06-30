import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";
import {bulkSms} from "../api/functions.js";

const BULK_SMS_STATUS_CACHE_KEY = "bulk-sms-send:status";

const invokeBulkSms = async (body) => {
  // Forward the request to the custom backend
  return bulkSms(body);
};

export const fetchBulkSmsStatus = () =>
  withFunctionStatusCache(BULK_SMS_STATUS_CACHE_KEY, () =>
    invokeBulkSms({action: "status"}),
  );

export const sendBulkSmsCampaign = async ({
  recipients = [],
  segmentId = "",
  templateName = "",
}) => {
  clearFunctionStatusCache(BULK_SMS_STATUS_CACHE_KEY);
  return invokeBulkSms({
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
};

export const sendBulkSmsTest = ({message, phone}) =>
  invokeBulkSms({
    action: "test",
    message,
    phone,
  });
