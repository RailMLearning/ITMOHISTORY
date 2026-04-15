import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  ARTIFACT_PATHS,
  CHARACTER_SOURCE_IDS,
  DATA_DIR,
  EXPECTED_VOLUMES,
  SOURCE_LIBRARY,
  VECTOR_DIR,
  getSourceEntries,
} from "../rag/sourceLibrary.js";
import { cosineSimilarity, normalizeText, tokenize } from "../rag/textUtils.js";

const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 2200);
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 450);
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

const STRUCTURE_CONFIDENCE = {
  outline: 0.96,
  heuristic: 0.74,
  propagated: 0.62,
  fallback: 0.3,
};

function lineKey(sourceId, pageNumber) {
  return `${sourceId}#${pageNumber}`;
}

function makeFragmentId(sourceId, pageStart, offset) {
  const digest = createHash("sha256").update(`${sourceId}:${pageStart}:${offset}`).digest("hex").slice(0, 16);
  return `${sourceId}-p${String(pageStart).padStart(4, "0")}-${digest}`;
}

function compactLabel(value) {
  return normalizeText(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeading(line) {
  const candidate = compactLabel(line);
  if (!candidate || candidate.length < 4 || candidate.length > 130) return false;
  if (!/[A-Za-zА-Яа-яЁё]/.test(candidate)) return false;

  const wordCount = candidate.split(/\s+/).length;
  if (wordCount > 16) return false;

  if (/^(ПИСЬМО|ГЛАВА|ЧАСТЬ|РАЗДЕЛ|ПРИЛОЖЕНИЕ|КОММЕНТАРИИ|ВАРИАНТЫ)\b/i.test(candidate)) {
    return true;
  }

  if (/^[IVXLCDM]{1,8}[.)\-\s]/.test(candidate)) {
    return true;
  }

  if (/^[A-ZА-ЯЁ0-9"'()\-\s.,:;]+$/.test(candidate) && wordCount <= 12) {
    return true;
  }

  return false;
}

function detectHeuristicStructure(lines, text) {
  const candidates = Array.isArray(lines) ? lines.slice(0, 8).map((line) => compactLabel(line)).filter(Boolean) : [];
  const heading = candidates.find((line) => isLikelyHeading(line));

  if (heading) {
    return {
      chapterTitle: null,
      sectionTitle: heading,
      headingPath: heading,
      headingConfidence: STRUCTURE_CONFIDENCE.heuristic,
      structureSource: "heuristic",
    };
  }

  const firstSentence = compactLabel(String(text || "").slice(0, 180));
  if (firstSentence.length >= 20 && firstSentence.length <= 120) {
    return {
      chapterTitle: null,
      sectionTitle: firstSentence,
      headingPath: firstSentence,
      headingConfidence: STRUCTURE_CONFIDENCE.fallback,
      structureSource: "fallback",
    };
  }

  return {
    chapterTitle: null,
    sectionTitle: null,
    headingPath: null,
    headingConfidence: STRUCTURE_CONFIDENCE.fallback,
    structureSource: "fallback",
  };
}

async function resolveOutlineDestPage(doc, dest) {
  try {
    let resolved = dest;
    if (typeof dest === "string") {
      resolved = await doc.getDestination(dest);
    }

    if (!Array.isArray(resolved) || !resolved[0]) {
      return null;
    }

    const pageIndex = await doc.getPageIndex(resolved[0]);
    if (!Number.isInteger(pageIndex) || pageIndex < 0) {
      return null;
    }

    return pageIndex + 1;
  } catch {
    return null;
  }
}

async function flattenOutlineEntries(doc, items, trail = [], out = []) {
  if (!Array.isArray(items) || items.length === 0) return out;

  for (const item of items) {
    const cleanTitle = compactLabel(item?.title);
    const nextTrail = cleanTitle ? [...trail, cleanTitle] : [...trail];
    const pageNumber = await resolveOutlineDestPage(doc, item?.dest);

    if (pageNumber && nextTrail.length > 0) {
      out.push({ pageNumber, path: nextTrail });
    }

    if (Array.isArray(item?.items) && item.items.length > 0) {
      await flattenOutlineEntries(doc, item.items, nextTrail, out);
    }
  }

  return out;
}

function resolveOutlineStructure(pageNumber, outlineEntries) {
  if (!Array.isArray(outlineEntries) || outlineEntries.length === 0) {
    return null;
  }

  let selected = null;
  for (const entry of outlineEntries) {
    if (entry.pageNumber <= pageNumber) {
      selected = entry;
      continue;
    }
    break;
  }

  if (!selected || !Array.isArray(selected.path) || selected.path.length === 0) {
    return null;
  }

  return {
    chapterTitle: selected.path[0] || null,
    sectionTitle: selected.path[selected.path.length - 1] || null,
    headingPath: selected.path.join(" / "),
    headingConfidence: STRUCTURE_CONFIDENCE.outline,
    structureSource: "outline",
  };
}

function propagateStructure(rows) {
  const bySource = new Map();
  for (const row of rows) {
    const key = row.sourceId;
    if (!bySource.has(key)) {
      bySource.set(key, []);
    }
    bySource.get(key).push(row);
  }

  for (const sourceRows of bySource.values()) {
    sourceRows.sort((a, b) => a.pageNumber - b.pageNumber);

    let previous = null;
    for (const row of sourceRows) {
      const hasStructure = Boolean(row.sectionTitle || row.chapterTitle || row.headingPath);
      if (hasStructure) {
        previous = {
          chapterTitle: row.chapterTitle || null,
          sectionTitle: row.sectionTitle || null,
          headingPath: row.headingPath || null,
          headingConfidence: row.headingConfidence || STRUCTURE_CONFIDENCE.heuristic,
        };
        continue;
      }

      if (previous) {
        row.chapterTitle = previous.chapterTitle;
        row.sectionTitle = previous.sectionTitle;
        row.headingPath = previous.headingPath;
        row.headingConfidence = Math.min(previous.headingConfidence, STRUCTURE_CONFIDENCE.propagated);
        row.structureSource = "propagated";
      }
    }

    let next = null;
    for (let idx = sourceRows.length - 1; idx >= 0; idx -= 1) {
      const row = sourceRows[idx];
      const hasStructure = Boolean(row.sectionTitle || row.chapterTitle || row.headingPath);
      if (hasStructure) {
        next = {
          chapterTitle: row.chapterTitle || null,
          sectionTitle: row.sectionTitle || null,
          headingPath: row.headingPath || null,
          headingConfidence: row.headingConfidence || STRUCTURE_CONFIDENCE.heuristic,
        };
        continue;
      }

      if (next) {
        row.chapterTitle = next.chapterTitle;
        row.sectionTitle = next.sectionTitle;
        row.headingPath = next.headingPath;
        row.headingConfidence = Math.min(next.headingConfidence, STRUCTURE_CONFIDENCE.propagated);
        row.structureSource = "propagated";
      }
    }

    for (const row of sourceRows) {
      if (!row.structureSource) {
        row.structureSource = "fallback";
      }
      if (!Number.isFinite(row.headingConfidence)) {
        row.headingConfidence = STRUCTURE_CONFIDENCE.fallback;
      }
    }
  }

  return rows;
}

function buildLocatorLabel(row) {
  const pageLabel = `стр. ${row.pageNumber}`;
  const detail = row.sectionTitle || row.chapterTitle || null;
  if (!detail) return pageLabel;
  return `${pageLabel}, ${detail}`;
}

function buildQuoteSnippet(text) {
  const compact = compactLabel(text);
  if (!compact) return null;

  const punctuated = compact.match(/^(.{40,240}?[.!?])(\s|$)/);
  if (punctuated && punctuated[1]) {
    return punctuated[1].trim();
  }

  return compact.slice(0, 180);
}

async function ensureDataDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(VECTOR_DIR, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, payload) {
  await ensureDataDirs();
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function writeJsonl(filePath, rows) {
  await ensureDataDirs();
  const data = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(filePath, data.length ? `${data}\n` : "", "utf-8");
}

async function readJson(filePath, fallback = null) {
  if (!(await fileExists(filePath))) return fallback;
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function readJsonl(filePath) {
  if (!(await fileExists(filePath))) return [];
  const raw = await readFile(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function extractPdfPages(filePath) {
  const buffer = await readFile(filePath);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const outline = await doc.getOutline().catch(() => null);
  const outlineEntries = await flattenOutlineEntries(doc, outline || []);
  outlineEntries.sort((a, b) => a.pageNumber - b.pageNumber);
  const pages = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const rawItems = content.items
      .filter((item) => typeof item?.str === "string" && item.str.trim().length > 0)
      .map((item) => ({
        str: item.str.trim(),
        y: Math.round(item.transform?.[5] || 0),
        x: Math.round(item.transform?.[4] || 0),
      }));

    const lineMap = new Map();
    for (const item of rawItems) {
      if (!lineMap.has(item.y)) {
        lineMap.set(item.y, []);
      }
      lineMap.get(item.y).push(item);
    }

    const lines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map((entry) =>
        normalizeText(
          entry[1]
            .sort((left, right) => left.x - right.x)
            .map((item) => item.str)
            .join(" ")
        )
      )
      .map((line) => compactLabel(line))
      .filter(Boolean);

    const text = normalizeText(lines.join(" "));
    pages.push({ pageNumber, text, lines: lines.slice(0, 10) });
  }

  return { pageCount: doc.numPages, pages, outlineEntries };
}

export async function runDiscovery() {
  const entries = getSourceEntries();
  const files = [];

  for (const source of entries) {
    const exists = await fileExists(source.filePath);
    files.push({
      fileName: path.basename(source.filePath),
      sourceId: source.id,
      character: source.character,
      volume: source.volume,
      exists,
      filePath: source.filePath,
    });
  }

  const discoveredByCharacter = {};
  for (const character of Object.keys(EXPECTED_VOLUMES)) {
    const found = files.filter((f) => f.character === character && f.exists).map((f) => f.volume);
    const expected = EXPECTED_VOLUMES[character] || [];
    const missing = expected.filter((volume) => !found.includes(volume));
    discoveredByCharacter[character] = {
      expectedVolumes: expected,
      foundVolumes: found.sort((a, b) => a - b),
      missingVolumes: missing,
    };
  }

  const payload = {
    createdAt: new Date().toISOString(),
    files,
    byCharacter: discoveredByCharacter,
  };

  await writeJson(ARTIFACT_PATHS.discovery, payload);
  return payload;
}

export async function runIngest() {
  const entries = getSourceEntries();
  const rows = [];
  const summary = [];

  for (const source of entries) {
    if (!(await fileExists(source.filePath))) {
      summary.push({ sourceId: source.id, loaded: false, reason: "file_not_found" });
      continue;
    }

    const { pageCount, pages, outlineEntries } = await extractPdfPages(source.filePath);
    let poorPages = 0;
    let structuredPages = 0;

    for (const page of pages) {
      const quality = page.text.length >= 120 ? "ok" : "poor";
      if (quality === "poor") poorPages += 1;

      const outlineStructure = resolveOutlineStructure(page.pageNumber, outlineEntries);
      const heuristicStructure = outlineStructure ? null : detectHeuristicStructure(page.lines, page.text);
      const structure = outlineStructure || heuristicStructure;
      if (structure?.sectionTitle || structure?.chapterTitle) {
        structuredPages += 1;
      }

      rows.push({
        sourceId: source.id,
        character: source.character,
        volume: source.volume,
        pageNumber: page.pageNumber,
        text: page.text,
        quality,
        ocrNeeded: quality === "poor",
        extractionMethod: "pdfjs",
        chapterTitle: structure?.chapterTitle || null,
        sectionTitle: structure?.sectionTitle || null,
        headingPath: structure?.headingPath || null,
        headingConfidence: structure?.headingConfidence || STRUCTURE_CONFIDENCE.fallback,
        structureSource: structure?.structureSource || "fallback",
      });
    }

    summary.push({ sourceId: source.id, loaded: true, pageCount, poorPages, structuredPages });
  }

  await writeJsonl(ARTIFACT_PATHS.ingest, rows);
  return { count: rows.length, summary };
}

export async function runOcrFallback() {
  const ingestRows = await readJsonl(ARTIFACT_PATHS.ingest);
  const tesseract = spawnSync("tesseract", ["--version"], { encoding: "utf-8" });
  const ocrAvailable = tesseract.status === 0;

  const rows = ingestRows
    .filter((row) => row.ocrNeeded)
    .map((row) => ({
      sourceId: row.sourceId,
      pageNumber: row.pageNumber,
      ocr_available: ocrAvailable,
      ocr_applied: false,
      ocr_skipped: true,
      reason: ocrAvailable ? "ocr_not_configured_for_pdf_pages" : "ocr_binary_not_found",
      text: row.text,
    }));

  await writeJsonl(ARTIFACT_PATHS.ocrCache, rows);
  return { count: rows.length, ocrAvailable };
}

function normalizePageText(text) {
  return normalizeText(text)
    .replace(/\b\d{1,4}\b(?=\s*$)/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function runNormalize() {
  const ingestRows = await readJsonl(ARTIFACT_PATHS.ingest);
  const ocrRows = await readJsonl(ARTIFACT_PATHS.ocrCache);
  const ocrMap = new Map(ocrRows.map((row) => [lineKey(row.sourceId, row.pageNumber), row]));

  const rows = ingestRows.map((row) => {
    const ocr = ocrMap.get(lineKey(row.sourceId, row.pageNumber));
    const selectedText = ocr?.ocr_applied ? ocr.text : row.text;
    return {
      ...row,
      text: normalizePageText(selectedText),
      usedOcr: Boolean(ocr?.ocr_applied),
      ocr_skipped: Boolean(ocr?.ocr_skipped),
      chapterTitle: row.chapterTitle || null,
      sectionTitle: row.sectionTitle || null,
      headingPath: row.headingPath || null,
      headingConfidence: row.headingConfidence || STRUCTURE_CONFIDENCE.fallback,
      structureSource: row.structureSource || "fallback",
    };
  });

  const propagatedRows = propagateStructure(rows);

  await writeJsonl(ARTIFACT_PATHS.normalized, propagatedRows);
  return { count: propagatedRows.length };
}

export async function runChunking() {
  const normalizedRows = await readJsonl(ARTIFACT_PATHS.normalized);
  const chunks = [];

  for (const row of normalizedRows) {
    const text = row.text || "";
    if (text.length < 120) continue;

    let offset = 0;
    while (offset < text.length) {
      const end = Math.min(text.length, offset + CHUNK_SIZE);
      const slice = text.slice(offset, end).trim();
      if (slice.length >= 120) {
        const source = SOURCE_LIBRARY[row.sourceId];
        chunks.push({
          fragmentId: makeFragmentId(row.sourceId, row.pageNumber, offset),
          sourceId: row.sourceId,
          character: row.character,
          author: source.author,
          title: source.title,
          work: source.work,
          year: source.year,
          type: source.type,
          volume: row.volume,
          pageStart: row.pageNumber,
          pageEnd: row.pageNumber,
          chapterTitle: row.chapterTitle || null,
          sectionTitle: row.sectionTitle || null,
          headingPath: row.headingPath || null,
          headingConfidence: row.headingConfidence || STRUCTURE_CONFIDENCE.fallback,
          structureSource: row.structureSource || "fallback",
          locatorLabel: buildLocatorLabel(row),
          quoteSnippet: buildQuoteSnippet(slice),
          tags: source.tags,
          text: slice,
        });
      }

      if (end >= text.length) break;
      offset += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  await writeJsonl(ARTIFACT_PATHS.chunks, chunks);
  return { count: chunks.length };
}

async function embedWithRetry(text, ollamaUrl, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${ollamaUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      });

      if (!response.ok) {
        lastError = new Error(await response.text());
        continue;
      }

      const payload = await response.json();
      const embedding = payload?.embeddings?.[0] || payload?.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        lastError = new Error("empty_embedding");
        continue;
      }

      return { embedding, error: null };
    } catch (error) {
      lastError = error;
    }
  }

  return { embedding: null, error: String(lastError?.message || "embed_failed") };
}

export async function runEmbeddings(ollamaUrl) {
  const chunks = await readJsonl(ARTIFACT_PATHS.chunks);
  const out = [];

  for (const chunk of chunks) {
    const result = await embedWithRetry(chunk.text, ollamaUrl);
    out.push({
      ...chunk,
      embedding: result.embedding,
      embedError: result.error,
    });
  }

  await writeJsonl(ARTIFACT_PATHS.embeddings, out);

  const ok = out.filter((row) => Array.isArray(row.embedding)).length;
  return { count: out.length, embedded: ok, vectorEnabled: ok > 0 };
}

function lexicalScore(row, queryTokens) {
  const haystack = [row.text, row.sectionTitle, row.chapterTitle, row.headingPath, row.quoteSnippet]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let tokenHits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) tokenHits += 1;
  }

  let tagHits = 0;
  for (const tag of row.tags || []) {
    const tagLower = String(tag).toLowerCase();
    if (queryTokens.includes(tagLower)) tagHits += 1;
  }

  let headingHits = 0;
  const headingStack = [row.sectionTitle, row.chapterTitle, row.headingPath].filter(Boolean).join(" ").toLowerCase();
  for (const token of queryTokens) {
    if (headingStack.includes(token)) headingHits += 1;
  }

  return tokenHits + tagHits * 2 + headingHits * 2.5;
}

export async function runIndexBuild() {
  const rows = await readJsonl(ARTIFACT_PATHS.embeddings);
  const vectors = rows.map((row) => ({
    ...row,
    embedding: Array.isArray(row.embedding) ? row.embedding : null,
  }));

  const vectorEnabled = vectors.some((v) => Array.isArray(v.embedding));

  const indexPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingModel: EMBED_MODEL,
    vectors,
  };

  const manifest = {
    version: 1,
    createdAt: indexPayload.createdAt,
    vectorEnabled,
    embeddingModel: EMBED_MODEL,
    totalVectors: vectors.length,
    embeddedVectors: vectors.filter((v) => Array.isArray(v.embedding)).length,
    files: {
      discovery: ARTIFACT_PATHS.discovery,
      ingest: ARTIFACT_PATHS.ingest,
      ocrCache: ARTIFACT_PATHS.ocrCache,
      normalized: ARTIFACT_PATHS.normalized,
      chunks: ARTIFACT_PATHS.chunks,
      embeddings: ARTIFACT_PATHS.embeddings,
      index: ARTIFACT_PATHS.vectorIndex,
    },
  };

  await writeJson(ARTIFACT_PATHS.vectorIndex, indexPayload);
  await writeJson(ARTIFACT_PATHS.manifest, manifest);

  return manifest;
}

export async function runFullPipeline(ollamaUrl) {
  const discovery = await runDiscovery();
  const ingest = await runIngest();
  const ocr = await runOcrFallback();
  const normalized = await runNormalize();
  const chunks = await runChunking();
  const embeddings = await runEmbeddings(ollamaUrl);
  const manifest = await runIndexBuild();

  return { discovery, ingest, ocr, normalized, chunks, embeddings, manifest };
}

export async function loadVectorIndex() {
  const index = await readJson(ARTIFACT_PATHS.vectorIndex, null);
  const manifest = await readJson(ARTIFACT_PATHS.manifest, null);
  if (!index || !manifest) {
    return null;
  }
  return { index, manifest };
}

export function retrieveHybrid({ vectorIndex, message, character, sourceIds, topK = 4, queryEmbedding = null }) {
  const vectors = Array.isArray(vectorIndex?.vectors) ? vectorIndex.vectors : [];
  const queryTokens = tokenize(message);

  const scoped = vectors.filter((row) => {
    if (character && row.character !== character) return false;
    if (Array.isArray(sourceIds) && sourceIds.length > 0 && !sourceIds.includes(row.sourceId)) return false;
    return true;
  });

  const scored = scoped
    .map((row) => {
      const lex = lexicalScore(row, queryTokens);
      const vec = queryEmbedding && Array.isArray(row.embedding) ? cosineSimilarity(queryEmbedding, row.embedding) : 0;
      const score = vec * 0.75 + Math.min(lex / 12, 1) * 0.25;
      return { row, score, lex, vec };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
