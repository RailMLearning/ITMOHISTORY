import { runChunking, runNormalize, runOcrFallback } from "./tasks.js";

async function run() {
  const ocr = await runOcrFallback();
  const normalized = await runNormalize();
  const chunks = await runChunking();
  console.log("[pipeline:chunk] done");
  console.log(`[pipeline:chunk] ocr rows: ${ocr.count}`);
  console.log(`[pipeline:chunk] normalized rows: ${normalized.count}`);
  console.log(`[pipeline:chunk] chunks: ${chunks.count}`);
}

run().catch((error) => {
  console.error("[pipeline:chunk] failed");
  console.error(error);
  process.exitCode = 1;
});
