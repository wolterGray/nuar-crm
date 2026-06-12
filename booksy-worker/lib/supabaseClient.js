import {createClient} from "@supabase/supabase-js";
import "dotenv/config";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
};

export const workerConfig = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  booksyEmail: required("BOOKSY_EMAIL"),
  booksyPassword: required("BOOKSY_PASSWORD"),
  booksyLoginUrl: process.env.BOOKSY_LOGIN_URL || "https://booksy.com/pro/login",
  booksyBusinessId: process.env.BOOKSY_BUSINESS_ID || "",
  workerId: process.env.WORKER_ID || "local-booksy-worker",
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 5000),
  headless: process.env.BOOKSY_HEADLESS !== "0",
  dryRun: process.env.BOOKSY_DRY_RUN === "1",
};

export const createWorkerSupabase = () =>
  createClient(workerConfig.supabaseUrl, workerConfig.supabaseServiceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
