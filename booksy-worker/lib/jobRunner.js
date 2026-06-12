import {createWorkerSupabase, workerConfig} from "./supabaseClient.js";
import {runBooksyBot} from "./booksyBot.js";

export const claimNextJobs = async (limit = 1) => {
  const supabase = createWorkerSupabase();
  const {data, error} = await supabase.rpc("claim_booksy_sync_jobs", {
    p_worker_id: workerConfig.workerId,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message || "Failed to claim Booksy jobs");
  }

  return data ?? [];
};

export const finishJob = async (jobId, {success, errorMessage = null, booksyExternalId = null}) => {
  const supabase = createWorkerSupabase();
  const {data, error} = await supabase.rpc("finish_booksy_sync_job", {
    p_job_id: jobId,
    p_success: success,
    p_error_message: errorMessage,
    p_booksy_external_id: booksyExternalId,
    p_worker_id: workerConfig.workerId,
  });

  if (error) {
    throw new Error(error.message || "Failed to finish Booksy job");
  }

  return data;
};

export const processJob = async (job) => {
  console.info(
    `[booksy-worker] Processing job ${job.id} for entry ${job.calendar_entry_id}`,
  );

  try {
    const result = await runBooksyBot(job);
    await finishJob(job.id, {
      success: true,
      booksyExternalId: result.booksyExternalId,
    });
    console.info(`[booksy-worker] Job ${job.id} done`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Booksy automation error";
    console.error(`[booksy-worker] Job ${job.id} failed: ${message}`);
    await finishJob(job.id, {
      success: false,
      errorMessage: message,
    });
  }
};

export const runWorkerLoop = async ({once = false} = {}) => {
  do {
    const jobs = await claimNextJobs(1);

    if (jobs.length === 0) {
      console.info("[booksy-worker] No queued jobs");
    } else {
      for (const job of jobs) {
        await processJob(job);
      }
    }

    if (once) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, workerConfig.pollIntervalMs));
  } while (true);
};
