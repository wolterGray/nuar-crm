import {supabase} from "../lib/supabase.js";
import {
  clearFunctionStatusCache,
  withFunctionStatusCache,
} from "./functionStatusCache.js";

const REVIEW_REQUESTS_STATUS_CACHE_KEY = "visit-review-requests:status";

const invokeVisitReviewRequests = async (body) => {
  if (!supabase) {
    throw new Error("Supabase не настроен");
  }

  const {data, error} = await supabase.functions.invoke("visit-review-requests", {
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

export const fetchReviewRequestStatus = () =>
  withFunctionStatusCache(REVIEW_REQUESTS_STATUS_CACHE_KEY, () =>
    invokeVisitReviewRequests({action: "status"}),
  );

export const previewReviewRequests = () =>
  invokeVisitReviewRequests({action: "preview"});

export const processReviewRequests = async () => {
  clearFunctionStatusCache(REVIEW_REQUESTS_STATUS_CACHE_KEY);
  return invokeVisitReviewRequests({action: "process"});
};

export const sendReviewRequestTest = ({message, phone}) =>
  invokeVisitReviewRequests({
    action: "test",
    message,
    phone,
  });
