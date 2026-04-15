import { runIndexBuild } from "./tasks.js";

async function run() {
  const manifest = await runIndexBuild();
  console.log("[pipeline:index] done");
  console.log(`[pipeline:index] vectors: ${manifest.totalVectors}`);
  console.log(`[pipeline:index] embedded: ${manifest.embeddedVectors}`);
  console.log(`[pipeline:index] vectorEnabled: ${manifest.vectorEnabled}`);
}

run().catch((error) => {
  console.error("[pipeline:index] failed");
  console.error(error);
  process.exitCode = 1;
});
