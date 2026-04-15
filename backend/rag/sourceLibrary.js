import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

export const DATA_DIR = path.join(backendDir, "data");
export const VECTOR_DIR = path.join(DATA_DIR, "vector");

export const ARTIFACT_PATHS = {
  discovery: path.join(DATA_DIR, "discovery.json"),
  ingest: path.join(DATA_DIR, "ingest.jsonl"),
  ocrCache: path.join(DATA_DIR, "ocr_cache.jsonl"),
  normalized: path.join(DATA_DIR, "normalized.jsonl"),
  chunks: path.join(DATA_DIR, "chunks.jsonl"),
  embeddings: path.join(DATA_DIR, "embeddings.jsonl"),
  manifest: path.join(DATA_DIR, "index_manifest.json"),
  vectorIndex: path.join(VECTOR_DIR, "index.json"),
};

export const SOURCE_LIBRARY = {
  chaadaev_tom_1: {
    id: "chaadaev_tom_1",
    character: "west",
    author: "П. Я. Чаадаев",
    title: "Полное собрание сочинений и избранные письма. Том 1",
    work: "Полное собрание сочинений и избранные письма",
    year: "Том 1",
    type: "собрание сочинений",
    volume: 1,
    filePath: path.join(backendDir, "sources", "Chaadaev_P_Polnoe_sobranie_sochineniy_i_izbrannye_pisma_Tom_1.pdf"),
    tags: ["философия", "история", "европа", "россия", "западничество"],
  },
  chaadaev_tom_2: {
    id: "chaadaev_tom_2",
    character: "west",
    author: "П. Я. Чаадаев",
    title: "Полное собрание сочинений и избранные письма. Том 2",
    work: "Полное собрание сочинений и избранные письма",
    year: "Том 2",
    type: "собрание сочинений",
    volume: 2,
    filePath: path.join(backendDir, "sources", "Chaadaev_P_Polnoe_sobranie_sochineniy_i_izbrannye_pisma_Tom_2.pdf"),
    tags: ["письма", "реформы", "европа", "общество", "государство"],
  },
  khomyakov_tom_1: {
    id: "khomyakov_tom_1",
    character: "slav",
    author: "А. С. Хомяков",
    title: "Полное собрание сочинений. Том 1",
    work: "Полное собрание сочинений",
    year: "Том 1",
    type: "собрание сочинений",
    volume: 1,
    filePath: path.join(backendDir, "sources", "хомяков том 1.pdf"),
    tags: ["соборность", "православие", "община", "традиция", "славянофильство"],
  },
  khomyakov_tom_2: {
    id: "khomyakov_tom_2",
    character: "slav",
    author: "А. С. Хомяков",
    title: "Полное собрание сочинений. Том 2",
    work: "Полное собрание сочинений",
    year: "Том 2",
    type: "собрание сочинений",
    volume: 2,
    filePath: path.join(backendDir, "sources", "хомяков том 2.pdf"),
    tags: ["славянофильство", "церковь", "народ", "история", "культура"],
  },
  khomyakov_tom_3: {
    id: "khomyakov_tom_3",
    character: "slav",
    author: "А. С. Хомяков",
    title: "Полное собрание сочинений. Том 3",
    work: "Полное собрание сочинений",
    year: "Том 3",
    type: "собрание сочинений",
    volume: 3,
    filePath: path.join(backendDir, "sources", "хомяков том 3.pdf"),
    tags: ["богословие", "соборность", "традиция", "общество", "россия"],
  },
  khomyakov_tom_8: {
    id: "khomyakov_tom_8",
    character: "slav",
    author: "А. С. Хомяков",
    title: "Полное собрание сочинений. Том 8",
    work: "Полное собрание сочинений",
    year: "Том 8",
    type: "собрание сочинений",
    volume: 8,
    filePath: path.join(backendDir, "sources", "хомяков том 8.pdf"),
    tags: ["публицистика", "полемика", "славянофильство", "общество", "история"],
  },
};

export const CHARACTER_SOURCE_IDS = {
  west: ["chaadaev_tom_1", "chaadaev_tom_2"],
  slav: ["khomyakov_tom_1", "khomyakov_tom_2", "khomyakov_tom_3", "khomyakov_tom_8"],
};

export const EXPECTED_VOLUMES = {
  west: [1, 2],
  slav: [1, 2, 3, 4, 5, 6, 7, 8],
};

export const RAG_INDEX_PATH = path.join(backendDir, "data", "rag_index.json");

export function getSourceEntries() {
  return Object.values(SOURCE_LIBRARY);
}
