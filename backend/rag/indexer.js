import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { RAG_INDEX_PATH, SOURCE_LIBRARY, getSourceEntries } from "./sourceLibrary.js";
import { cosineSimilarity, countTokenMatches, normalizeText, tokenize } from "./textUtils.js";

const DEFAULT_CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 2200);
const DEFAULT_CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 450);
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

function makeChunkId(sourceId, pageStart, offset) {
  const digest = createHash("sha256")
    .update(`${sourceId}:${pageStart}:${offset}`)
    .digest("hex")
    .slice(0, 16);
  return `${sourceId}-p${String(pageStart).padStart(4, "0")}-${digest}`;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function extractPdfPages(filePath) {
  const buffer = await readFile(filePath);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = normalizeText(textContent.items.map((item) => item.str).join(" "));
    pages.push({ pageNumber, text });
  }

  return {
    pageCount: doc.numPages,
    pages,
  };
}

function buildChunksForSource(source, pages, chunkSize, overlap) {
  const chunks = [];

  for (const page of pages) {
    if (!page.text || page.text.length < 50) {
      continue;
    }

    let offset = 0;
    while (offset < page.text.length) {
      const end = Math.min(page.text.length, offset + chunkSize);
      const slice = page.text.slice(offset, end).trim();

      if (slice.length >= 120) {
        chunks.push({
          id: makeChunkId(source.id, page.pageNumber, offset),
          sourceId: source.id,
          character: source.character,
          author: source.author,
          work: source.work,
          title: source.title,
          year: source.year,
          type: source.type,
          volume: source.volume,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          text: slice,
          tags: source.tags,
          embedding: null,
        });
      }

      if (end >= page.text.length) {
        break;
      }

      offset += chunkSize - overlap;
    }
  }

  return chunks;
}

async function embedText(text, ollamaUrl) {
  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`embed_failed: ${details}`);
  }

  const data = await response.json();
  const embedding = data?.embeddings?.[0] || data?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("embed_failed: empty embedding");
  }

  return embedding;
}

async function buildEmbeddings(chunks, ollamaUrl) {
  let vectorEnabled = true;

  for (const chunk of chunks) {
    try {
      chunk.embedding = await embedText(chunk.text, ollamaUrl);
    } catch {
      vectorEnabled = false;
      chunk.embedding = null;
    }
  }

  if (!vectorEnabled) {
    for (const chunk of chunks) {
      chunk.embedding = null;
    }
  }

  return { chunks, vectorEnabled };
}

function summarizeSources(chunks) {
  const bySource = new Map();
  for (const chunk of chunks) {
    bySource.set(chunk.sourceId, (bySource.get(chunk.sourceId) || 0) + 1);
  }
  return Object.fromEntries(bySource.entries());
}

export async function buildRagIndex({ ollamaUrl, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP }) {
  const sourceEntries = getSourceEntries();
  const chunks = [];
  const sourceStats = [];

  for (const source of sourceEntries) {
    if (!(await fileExists(source.filePath))) {
      sourceStats.push({ sourceId: source.id, filePath: source.filePath, loaded: false, reason: "file_not_found" });
      continue;
    }

    const { pages, pageCount } = await extractPdfPages(source.filePath);
    const sourceChunks = buildChunksForSource(source, pages, chunkSize, overlap);
    chunks.push(...sourceChunks);
    sourceStats.push({ sourceId: source.id, filePath: source.filePath, loaded: true, pageCount, chunkCount: sourceChunks.length });
  }

  const embedded = await buildEmbeddings(chunks, ollamaUrl);

  const index = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingModel: EMBED_MODEL,
    vectorEnabled: embedded.vectorEnabled,
    chunkSize,
    overlap,
    sourceStats,
    sourceChunkCounts: summarizeSources(embedded.chunks),
    chunks: embedded.chunks,
  };

  await mkdir(path.dirname(RAG_INDEX_PATH), { recursive: true });
  await writeFile(RAG_INDEX_PATH, JSON.stringify(index), "utf-8");

  return index;
}

export async function loadRagIndex() {
  if (!(await fileExists(RAG_INDEX_PATH))) {
    return null;
  }

  const raw = await readFile(RAG_INDEX_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.chunks)) {
    return null;
  }
  return parsed;
}

export async function shouldRebuildIndex(index) {
  if (!index || !Array.isArray(index.sourceStats)) {
    return true;
  }

  for (const source of Object.values(SOURCE_LIBRARY)) {
    const srcStat = index.sourceStats.find((s) => s.sourceId === source.id);
    if (!srcStat?.loaded) {
      return true;
    }
    try {
      const info = await stat(source.filePath);
      if (new Date(index.createdAt).getTime() < info.mtimeMs) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

export async function ensureRagIndex(ollamaUrl) {
  const loaded = await loadRagIndex();
  if (loaded && !(await shouldRebuildIndex(loaded))) {
    return loaded;
  }
  return buildRagIndex({ ollamaUrl });
}

function lexicalScore(chunk, queryTokens) {
  const tokenHits = countTokenMatches(queryTokens, chunk.text);
  const tagHits = Array.isArray(chunk.tags)
    ? chunk.tags.reduce((acc, tag) => acc + (queryTokens.includes(String(tag).toLowerCase()) ? 1 : 0), 0)
    : 0;
  return tokenHits + tagHits * 2;
}

export function retrieveRelevantChunks({ index, message, character, sourceIds, topK = 4, queryEmbedding = null }) {
  if (!index || !Array.isArray(index.chunks)) {
    return [];
  }

  const queryTokens = tokenize(message);
  const restricted = index.chunks.filter((chunk) => {
    if (character && chunk.character !== character) return false;
    if (Array.isArray(sourceIds) && sourceIds.length > 0 && !sourceIds.includes(chunk.sourceId)) return false;
    return true;
  });

  const scored = restricted
    .map((chunk) => {
      const lex = lexicalScore(chunk, queryTokens);
      const vec = index.vectorEnabled && queryEmbedding && Array.isArray(chunk.embedding)
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      const hybrid = vec * 0.75 + (lex > 0 ? Math.min(lex / 10, 1) * 0.25 : 0);
      return { chunk, score: hybrid, vectorScore: vec, lexicalScore: lex };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
