import { runFullPipeline } from "./tasks.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

async function run() {
  try {
    console.log("[pipeline] full run started");
    const result = await runFullPipeline(OLLAMA_URL);
    console.log("[pipeline] full run completed");
    console.log(`[pipeline] discovered files: ${result.discovery.files.length}`);
    console.log(`[pipeline] ingest rows: ${result.ingest.count}`);
    console.log(`[pipeline] normalized rows: ${result.normalized.count}`);
    console.log(`[pipeline] chunks: ${result.chunks.count}`);
    console.log(`[pipeline] embedded rows: ${result.embeddings.embedded}/${result.embeddings.count}`);
    console.log(`[pipeline] vector enabled: ${result.manifest.vectorEnabled}`);
  } catch (error) {
    console.error("[pipeline] build failed");
    console.error(error);
    process.exitCode = 1;
  }
}

run();
