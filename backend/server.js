import express from "express";

const app = express();
const PORT = process.env.PORT ||8787;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL_NAME = process.env.MODEL_NAME || "llama3.1:8b";

app.use(express.json({ limit: "1mb" }));

const CHARACTERS = {
 west: {
 displayName: "Пётр Яковлевич Чаадаев",
 systemPrompt: `Ты играешь роль Петра Яковлевича Чаадаева — русского философа-западника XIX века.

Правила ответа:
1) Отвечай на русском языке.
2) Говори в первом лице, как историческая личность.
3) Стиль: интеллектуальный, сдержанный, полемичный; допускаются архаичные обороты, но текст должен быть понятен современному пользователю.
4) Опирайся на идеи западничества: критика исторической отсталости России, ценность европейского опыта, важность реформ, рационального мышления и развития институтов.
5) Не выдумывай точные цитаты и даты, если не уверен. Лучше оговори степень уверенности.
6) Не выходи из роли и не упоминай, что ты ИИ.
7) Пиши кратко и содержательно:2–5 абзацев.`,
 },
 slav: {
 displayName: "Алексей Степанович Хомяков",
 systemPrompt: `Ты играешь роль Алексея Степановича Хомякова — русского философа-славянофила XIX века.

Правила ответа:
1) Отвечай на русском языке.
2) Говори в первом лице, как историческая личность.
3) Стиль: спокойный, убеждённый, философский; допускаются архаичные обороты, но текст должен быть понятен современному пользователю.
4) Опирайся на идеи славянофильства: соборность, православная традиция, общинность, самобытный путь России, критика слепого копирования Запада.
5) Не выдумывай точные цитаты и даты, если не уверен. Лучше оговори степень уверенности.
6) Не выходи из роли и не упоминай, что ты ИИ.
7) Пиши кратко и содержательно:2–5 абзацев.`,
 },
};

function sanitizeHistory(history) {
 if (!Array.isArray(history)) return [];

 return history
 .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
 .slice(-12)
 .map((item) => ({
 role: item.role,
 content: item.content.trim(),
 }))
 .filter((item) => item.content.length >0);
}

app.get("/api/health", async (_req, res) => {
 try {
 const check = await fetch(`${OLLAMA_URL}/api/tags`);
 if (!check.ok) {
 return res.status(503).json({
 ok: false,
 message: "Ollama недоступна",
 });
 }

 return res.json({
 ok: true,
 model: MODEL_NAME,
 ollama: OLLAMA_URL,
 });
 } catch {
 return res.status(503).json({
 ok: false,
 message: "Не удалось подключиться к Ollama",
 });
 }
});

app.post("/api/chat", async (req, res) => {
 const { character, message, history } = req.body || {};

 if (!CHARACTERS[character]) {
 return res.status(400).json({ error: "Некорректный персонаж" });
 }

 if (typeof message !== "string" || !message.trim()) {
 return res.status(400).json({ error: "Пустое сообщение" });
 }

 const characterData = CHARACTERS[character];
 const preparedHistory = sanitizeHistory(history);

 const messages = [
 { role: "system", content: characterData.systemPrompt },
 ...preparedHistory,
 { role: "user", content: message.trim() },
 ];

 try {
 const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 model: MODEL_NAME,
 stream: false,
 options: {
 temperature:0.7,
 num_predict:450,
 },
 messages,
 }),
 });

 if (!ollamaResp.ok) {
 const details = await ollamaResp.text();
 return res.status(502).json({
 error: "Ошибка ответа локальной модели",
 details,
 });
 }

 const data = await ollamaResp.json();
 const reply = data?.message?.content?.trim();

 if (!reply) {
 return res.status(502).json({ error: "Пустой ответ от модели" });
 }

 return res.json({
 reply,
 character: characterData.displayName,
 model: MODEL_NAME,
 });
 } catch (error) {
 return res.status(500).json({
 error: "Не удалось обратиться к локальной модели",
 details: error instanceof Error ? error.message : "unknown_error",
 });
 }
});

app.listen(PORT, () => {
 console.log(`[backend] running at http://localhost:${PORT}`);
 console.log(`[backend] model: ${MODEL_NAME}`);
 console.log(`[backend] ollama: ${OLLAMA_URL}`);
});
