# History Duel

Интерфейс для диалога с двумя историческими мыслителями:
- П. Я. Чаадаев (`west`)
- А. С. Хомяков (`slav`)

Теперь проект включает **frontend + backend**. Бэкенд запускает локальную LLM через **Ollama** и задаёт роль через системный промпт.

## Требования

- Node.js 18+
- Установленная и запущенная [Ollama](https://ollama.com/)
- Загруженная модель (по умолчанию `llama3.1:8b`)

Пример подготовки Ollama:

```powershell
ollama pull llama3.1:8b
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
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- `character`: `west` или `slav`
- `message`: текущий вопрос
- `history`: контекст предыдущих реплик

## Переменные окружения

- `PORT` — порт backend (по умолчанию `8787`)
- `OLLAMA_URL` — URL Ollama API (по умолчанию `http://127.0.0.1:11434`)
- `MODEL_NAME` — имя модели Ollama (по умолчанию `llama3.1:8b`)

Пример:

```powershell
$env:MODEL_NAME="qwen2.5:7b"
npm run server
```

