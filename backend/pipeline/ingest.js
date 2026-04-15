import { runDiscovery, runIngest } from "./tasks.js";

async function run() {
  const discovery = await runDiscovery();
  const ingest = await runIngest();
  console.log("[pipeline:ingest] done");
  console.log(`[pipeline:ingest] files: ${discovery.files.length}`);
  console.log(`[pipeline:ingest] rows: ${ingest.count}`);
}

run().catch((error) => {
  console.error("[pipeline:ingest] failed");
  console.error(error);
  process.exitCode = 1;
});
