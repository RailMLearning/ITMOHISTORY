import { runEmbeddings } from "./tasks.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

async function run() {
  const result = await runEmbeddings(OLLAMA_URL);
  console.log("[pipeline:embed] done");
  console.log(`[pipeline:embed] rows: ${result.count}`);
  console.log(`[pipeline:embed] embedded: ${result.embedded}`);
  console.log(`[pipeline:embed] vectorEnabled: ${result.vectorEnabled}`);
}

run().catch((error) => {
  console.error("[pipeline:embed] failed");
  console.error(error);
  process.exitCode = 1;
});
