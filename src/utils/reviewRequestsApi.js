import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";
import {bulkSms, smsReminders} from "../api/functions.js";

const REVIEW_REQUESTS_STATUS_CACHE_KEY = "visit-review-requests:status";

const invokeVisitReviewRequests = (body) => smsReminders(body);

export const fetchReviewRequestStatus = () =>
  withFunctionStatusCache(REVIEW_REQUESTS_STATUS_CACHE_KEY, async () => {
    const status = await bulkSms({action: "status"});
    return {
      ...status,
      dueCount: 0,
      recentLog: [],
      skippedCount: 0,
    };
  });

export const previewReviewRequests = () => Promise.resolve({due: []});

export const processReviewRequests = async ({requests = []} = {}) => {
  clearFunctionStatusCache(REVIEW_REQUESTS_STATUS_CACHE_KEY);
  return invokeVisitReviewRequests({
    reminders: requests.map((item) => ({
      message: item.message,
      phone: item.phone,
    })),
  });
};

export const sendReviewRequestTest = ({message, phone}) =>
  invokeVisitReviewRequests({
    action: "test",
    message,
    phone,
  });
