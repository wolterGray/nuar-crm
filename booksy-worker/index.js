import {runWorkerLoop} from "./lib/jobRunner.js";
import {workerConfig} from "./lib/supabaseClient.js";

const once = process.argv.includes("--once");

console.info(
  `[booksy-worker] Starting as ${workerConfig.workerId} (poll=${workerConfig.pollIntervalMs}ms, dryRun=${workerConfig.dryRun})`,
);

runWorkerLoop({once}).catch((error) => {
  console.error("[booksy-worker] Fatal error:", error);
  process.exit(1);
});
