import express from "express";
import { randomUUID } from "node:crypto";

import { CHARACTER_SOURCE_IDS, SOURCE_LIBRARY } from "./rag/sourceLibrary.js";
import { loadVectorIndex, retrieveHybrid, runFullPipeline } from "./pipeline/tasks.js";

const app = express();
const PORT = process.env.PORT || 8787;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL_NAME = process.env.MODEL_NAME || "llama3.1:8b";

const MAX_HISTORY_ITEMS = 16;
const SESSION_TTL_MS = 1000 * 60 * 60;
const SOURCE_TEXT_STRIP_RE = /\s*интернет-портал «Азбука веры»\s*/gi;

const sessionStore = new Map();
let ragIndex = null;
let ragManifest = null;

app.use(express.json({ limit: "1mb" }));

const CHARACTERS = {
  west: {
    displayName: "Пётр Яковлевич Чаадаев",
    sourceIds: CHARACTER_SOURCE_IDS.west,
    systemPrompt: `Ты играешь роль Петра Яковлевича Чаадаева, русского философа-западника XIX века.

Задача:
- Дать исторически правдоподобный ответ от первого лица.
- Сохранять стиль образованного полемиста, без современного сленга.

Правила:
1) Язык ответа: русский.
2) Форма: 2-4 абзаца, ясно и по существу.
3) Позиция: западничество, ценность европейского исторического опыта, институтов, реформ и рационального анализа.
4) Учитывай контекст диалога и не противоречь своим прошлым тезисам.
5) Не выдумывай буквальные цитаты, архивные номера, точные даты и страницы, если не уверен.
6) Не называй себя ИИ и не выходи из роли.
7) Если вопрос провокационный, отвечай корректно, академично и без оскорблений.
8) Давай аргументы, а не только лозунги.`,
  },
  slav: {
    displayName: "Алексей Степанович Хомяков",
    sourceIds: CHARACTER_SOURCE_IDS.slav,
    systemPrompt: `Ты играешь роль Алексея Степановича Хомякова, русского мыслителя-славянофила XIX века.

Задача:
- Дать исторически правдоподобный ответ от первого лица.
- Сохранять спокойный, убежденный, философский тон.

Правила:
1) Язык ответа: русский.
2) Форма: 2-4 абзаца, без лишней воды.
3) Позиция: соборность, православная традиция, общинность и самобытный путь России.
4) Учитывай контекст диалога и придерживайся последовательной роли.
5) Не выдумывай буквальные цитаты, архивные номера, точные даты и страницы, если не уверен.
6) Не называй себя ИИ и не выходи из роли.
7) Если вопрос провокационный, отвечай корректно, академично и без оскорблений.
8) Давай аргументы и причинно-следственные связи.`,
  },
};

function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, data] of sessionStore.entries()) {
    if (now - data.updatedAt > SESSION_TTL_MS) {
      sessionStore.delete(sessionId);
    }
  }
}

function getOrCreateSession(sessionId) {
  cleanupSessions();

  if (sessionId && sessionStore.has(sessionId)) {
    const existing = sessionStore.get(sessionId);
    existing.updatedAt = Date.now();
    return { sessionId, data: existing };
  }

  const newSessionId = sessionId || randomUUID();
  const initial = {
    updatedAt: Date.now(),
    historyByCharacter: {
      west: [],
      slav: [],
    },
  };

  sessionStore.set(newSessionId, initial);
  return { sessionId: newSessionId, data: initial };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))
    .filter((item) => item.content.length > 0);
}

async function getQueryEmbedding(text) {
  if (!ragManifest?.vectorEnabled || !ragManifest?.embeddingModel) {
    return null;
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ragManifest.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.embeddings?.[0] || data?.embedding || null;
  } catch {
    return null;
  }
}

function buildContextBlock(scoredChunks) {
  if (!Array.isArray(scoredChunks) || scoredChunks.length === 0) {
    return "";
  }

  const excerpts = scoredChunks
    .slice(0, 2)
    .map((item) => {
      const chunk = item.row;
      const contextText = chunk.text.replace(/\s+/g, " ").trim().slice(0, 520);
      const sectionLabel = sanitizeSourceText(chunk.sectionTitle || chunk.chapterTitle || chunk.headingPath || null);
      const locator = sanitizeSourceText(chunk.locatorLabel || `том ${chunk.volume}, стр. ${chunk.pageStart}`);
      const headingPart = sectionLabel ? `, раздел: ${sectionLabel}` : "";
      return `Источник: ${sanitizeSourceText(chunk.author)}, ${sanitizeSourceText(chunk.title)}, ${locator}${headingPart}. Фрагмент ${chunk.fragmentId}. Контекст: ${contextText}...`;
    });

  if (!excerpts.length) {
    return "";
  }

  return `Опирайся на следующий исторический контекст:\n${excerpts.join("\n")}`;
}

function presentSources(scoredChunks) {
  const seen = new Set();
  const result = [];

  for (const item of scoredChunks) {
    const chunk = item.row;
    if (seen.has(chunk.fragmentId)) {
      continue;
    }
    seen.add(chunk.fragmentId);

    result.push({
      id: chunk.sourceId,
      author: sanitizeSourceText(chunk.author),
      title: sanitizeSourceText(chunk.title),
      work: sanitizeSourceText(chunk.work),
      year: sanitizeSourceText(chunk.year),
      type: sanitizeSourceText(chunk.type),
      volume: chunk.volume,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      fragmentId: chunk.fragmentId,
      chapterTitle: sanitizeSourceText(chunk.chapterTitle || null),
      sectionTitle: sanitizeSourceText(chunk.sectionTitle || null),
      headingPath: sanitizeSourceText(chunk.headingPath || null),
      locatorLabel: sanitizeSourceText(chunk.locatorLabel || null),
      quoteSnippet: sanitizeSourceText(chunk.quoteSnippet || null),
      headingConfidence: chunk.headingConfidence || null,
      structureSource: chunk.structureSource || null,
    });

    if (result.length >= 1) {
      break;
    }
  }

  return result.map((source) => ({
    ...source,
    author: sanitizeSourceText(source.author),
    title: sanitizeSourceText(source.title),
    work: sanitizeSourceText(source.work),
    year: sanitizeSourceText(source.year),
    type: sanitizeSourceText(source.type),
    chapterTitle: sanitizeSourceText(source.chapterTitle),
    sectionTitle: sanitizeSourceText(source.sectionTitle),
    headingPath: sanitizeSourceText(source.headingPath),
    locatorLabel: sanitizeSourceText(source.locatorLabel),
    quoteSnippet: sanitizeSourceText(source.quoteSnippet),
  }));
}

function fallbackSourcesByCharacter(character) {
  const ids = CHARACTER_SOURCE_IDS[character] || [];
  return ids.slice(0, 1).map((id) => {
    const source = SOURCE_LIBRARY[id];
    return {
      id: source.id,
      author: sanitizeSourceText(source.author),
      title: sanitizeSourceText(source.title),
      work: sanitizeSourceText(source.work),
      year: sanitizeSourceText(source.year),
      type: sanitizeSourceText(source.type),
      volume: source.volume,
      pageStart: null,
      pageEnd: null,
      fragmentId: null,
      chapterTitle: null,
      sectionTitle: null,
      headingPath: null,
      locatorLabel: null,
      quoteSnippet: null,
      headingConfidence: null,
      structureSource: "fallback",
    };
  });
}

function sanitizeSourceText(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return String(value)
    .replace(SOURCE_TEXT_STRIP_RE, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*[·•\-–—:]+\s*/, "")
    .trim();
}

async function selectSources(character, message) {
  const characterData = CHARACTERS[character];
  const sourceIds = characterData?.sourceIds || [];

  if (!ragIndex || !Array.isArray(ragIndex.vectors) || ragIndex.vectors.length === 0) {
    return { scoredChunks: [], sources: fallbackSourcesByCharacter(character) };
  }

  const queryEmbedding = await getQueryEmbedding(message);
  const scoredChunks = retrieveHybrid({
    vectorIndex: ragIndex,
    message,
    character,
    sourceIds,
    topK: 4,
    queryEmbedding,
  });

  if (!scoredChunks.length) {
    return { scoredChunks: [], sources: fallbackSourcesByCharacter(character) };
  }

  return {
    scoredChunks,
    sources: presentSources(scoredChunks),
  };
}

async function generateCharacterReply({ character, message, history }) {
  const characterData = CHARACTERS[character];
  const selected = await selectSources(character, message);
  const contextBlock = buildContextBlock(selected.scoredChunks);

  const messages = [
    { role: "system", content: characterData.systemPrompt },
    ...(contextBlock ? [{ role: "system", content: contextBlock }] : []),
    ...history,
    { role: "user", content: message.trim() },
  ];

  const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      stream: false,
      options: {
        temperature: 0.55,
        top_p: 0.9,
        num_predict: 500,
      },
      messages,
    }),
  });

  if (!ollamaResp.ok) {
    const details = await ollamaResp.text();
    throw new Error(`Ошибка ответа локальной модели: ${details}`);
  }

  const data = await ollamaResp.json();
  const reply = data?.message?.content?.trim();

  if (!reply) {
    throw new Error("Пустой ответ от модели");
  }

  return {
    reply,
    sources: selected.sources,
    character: characterData.displayName,
  };
}

app.get("/api/health", async (_req, res) => {
  let ollamaReachable = false;
  try {
    const check = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    ollamaReachable = check.ok;
  } catch {
    ollamaReachable = false;
  }

  return res.json({
    ok: true,
    model: MODEL_NAME,
    ollama: OLLAMA_URL,
    ollamaReachable,
    rag: {
      loaded: Boolean(ragIndex),
      vectorEnabled: Boolean(ragManifest?.vectorEnabled),
      embeddingModel: ragManifest?.embeddingModel || null,
      chunks: ragManifest?.totalVectors || 0,
      embeddedVectors: ragManifest?.embeddedVectors || 0,
      createdAt: ragManifest?.createdAt || null,
    },
  });
});

app.post("/api/chat", async (req, res) => {
  const { character, message, history, sessionId } = req.body || {};

  if (!CHARACTERS[character]) {
    return res.status(400).json({ error: "Некорректный персонаж" });
  }

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Пустое сообщение" });
  }

  const preparedHistory = sanitizeHistory(history);
  const session = getOrCreateSession(sessionId);
  const cachedHistory = sanitizeHistory(session.data.historyByCharacter[character]);
  const mergedHistory = preparedHistory.length ? preparedHistory : cachedHistory;

  try {
    const result = await generateCharacterReply({
      character,
      message,
      history: mergedHistory,
    });

    session.data.historyByCharacter[character] = sanitizeHistory([
      ...mergedHistory,
      { role: "user", content: message.trim() },
      { role: "assistant", content: result.reply },
    ]);
    session.data.updatedAt = Date.now();

    return res.json({
      reply: result.reply,
      sources: result.sources,
      character: result.character,
      model: MODEL_NAME,
      sessionId: session.sessionId,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Не удалось обратиться к локальной модели",
      details: error instanceof Error ? error.message : "unknown_error",
    });
  }
});

app.post("/api/chat/debate", async (req, res) => {
  const { message, historyByCharacter, sessionId } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Пустое сообщение" });
  }

  const session = getOrCreateSession(sessionId);
  const westHistory = sanitizeHistory(historyByCharacter?.west || session.data.historyByCharacter.west);
  const slavHistory = sanitizeHistory(historyByCharacter?.slav || session.data.historyByCharacter.slav);

  try {
    const [west, slav] = await Promise.all([
      generateCharacterReply({ character: "west", message, history: westHistory }),
      generateCharacterReply({ character: "slav", message, history: slavHistory }),
    ]);

    session.data.historyByCharacter.west = sanitizeHistory([
      ...westHistory,
      { role: "user", content: message.trim() },
      { role: "assistant", content: west.reply },
    ]);
    session.data.historyByCharacter.slav = sanitizeHistory([
      ...slavHistory,
      { role: "user", content: message.trim() },
      { role: "assistant", content: slav.reply },
    ]);
    session.data.updatedAt = Date.now();

    return res.json({
      sessionId: session.sessionId,
      model: MODEL_NAME,
      question: message.trim(),
      west: { reply: west.reply, sources: west.sources, character: west.character },
      slav: { reply: slav.reply, sources: slav.sources, character: slav.character },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Не удалось выполнить режим диспута",
      details: error instanceof Error ? error.message : "unknown_error",
    });
  }
});

loadVectorIndex()
  .then(async (state) => {
    if (state?.index && state?.manifest) {
      ragIndex = state.index;
      ragManifest = state.manifest;
      console.log(`[backend] rag chunks: ${ragManifest?.totalVectors || 0}`);
      console.log(`[backend] rag vector enabled: ${Boolean(ragManifest?.vectorEnabled)}`);
      return;
    }

    console.log("[backend] no index found, running pipeline:full");
    const built = await runFullPipeline(OLLAMA_URL);
    ragManifest = built.manifest;

    const loaded = await loadVectorIndex();
    ragIndex = loaded?.index || null;
    if (!ragIndex) {
      throw new Error("index_build_failed");
    }

    console.log(`[backend] rag chunks: ${ragManifest?.totalVectors || 0}`);
    console.log(`[backend] rag vector enabled: ${Boolean(ragManifest?.vectorEnabled)}`);
  })
  .catch((error) => {
    console.error("[backend] rag init failed, fallback mode enabled");
    console.error(error);
    ragIndex = null;
    ragManifest = null;
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[backend] running at http://localhost:${PORT}`);
      console.log(`[backend] model: ${MODEL_NAME}`);
      console.log(`[backend] ollama: ${OLLAMA_URL}`);
    });
  });
