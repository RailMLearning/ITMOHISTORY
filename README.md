# History Duel

Интерфейс для диалога с двумя историческими мыслителями:
- П. Я. Чаадаев (`west`)
- А. С. Хомяков (`slav`)

Теперь проект включает **frontend + backend**. Бэкенд запускает локальную LLM через **Ollama**, строит RAG-индекс из PDF в `backend/sources` и возвращает список источников для каждого ответа.

## Требования

- Node.js 18+
- Установленная и запущенная [Ollama](https://ollama.com/)
- Загруженная модель (по умолчанию `llama3.1:8b`)
- Модель эмбеддингов Ollama (по умолчанию `nomic-embed-text`)

Пример подготовки Ollama:

```powershell
ollama pull llama3.1:8b
ollama pull nomic-embed-text
ollama serve
```

## Установка

```powershell
npm install
```

## Запуск

Одновременно фронтенд и бэкенд:

```powershell
npm run dev:full
```

По отдельности:

```powershell
npm run server
npm run dev
```

Сборка/пересборка RAG-индекса из PDF:

```powershell
npm run pipeline:full
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

## API

### `GET /api/health`
Проверка доступности Ollama.

### `POST /api/chat`
Тело запроса:

```json
{
  "character": "west",
  "message": "Каков путь России?",
  "sessionId": "optional-session-id",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- `character`: `west` или `slav`
- `message`: текущий вопрос
- `history`: контекст предыдущих реплик

Ответ:

```json
{
  "reply": "...",
  "character": "Пётр Яковлевич Чаадаев",
  "model": "llama3.1:8b",
  "sessionId": "...",
  "sources": [
    {
      "id": "chaadaev_letters",
      "author": "П. Я. Чаадаев",
      "title": "Философические письма",
      "work": "Философические письма",
      "year": "1829–1831",
      "type": "письма",
      "volume": 1,
      "pageStart": 42,
      "pageEnd": 42,
      "fragmentId": "chaadaev_tom_1-p0042-..."
    }
  ]
}
```

### `POST /api/chat/debate`
Тело запроса:

```json
{
  "message": "В чем различие западничества и славянофильства?",
  "sessionId": "optional-session-id",
  "historyByCharacter": {
    "west": [{ "role": "user", "content": "..." }],
    "slav": [{ "role": "user", "content": "..." }]
  }
}
```

Сервер запускает генерацию для двух персонажей параллельно и возвращает два ответа с отдельными списками источников.

## Источники и RAG

Входные документы: PDF в `backend/sources`.

Автоматический пайплайн `pipeline:full` делает:
- извлечение текста постранично;
- нормализацию и чанкинг;
- генерацию эмбеддингов через Ollama;
- построение индекса в `backend/data/rag_index.json`.

Сервер при старте подгружает индекс и использует hybrid retrieval:
- векторный поиск, если эмбеддинги доступны;
- lexical fallback, если эмбеддинги недоступны.

## Переменные окружения

- `PORT` — порт backend (по умолчанию `8787`)
- `OLLAMA_URL` — URL Ollama API (по умолчанию `http://127.0.0.1:11434`)
- `MODEL_NAME` — имя модели Ollama (по умолчанию `llama3.1:8b`)
- `EMBED_MODEL` — модель эмбеддингов (по умолчанию `nomic-embed-text`)
- `RAG_CHUNK_SIZE` — размер чанка в символах (по умолчанию `2200`)
- `RAG_CHUNK_OVERLAP` — overlap чанков (по умолчанию `450`)

Пример:

```powershell
$env:MODEL_NAME="qwen2.5:7b"
npm run server
```

