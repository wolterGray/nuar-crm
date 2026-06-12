import {supabase} from "../lib/supabase.js";

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
  invokeVisitReviewRequests({action: "status"});

export const previewReviewRequests = () =>
  invokeVisitReviewRequests({action: "preview"});

export const processReviewRequests = () =>
  invokeVisitReviewRequests({action: "process"});

export const sendReviewRequestTest = ({message, phone}) =>
  invokeVisitReviewRequests({
    action: "test",
    message,
    phone,
  });
