# Облачная версия

Публичный сайт: https://history-duel.pages.dev/

React-интерфейс размещён в Cloudflare Pages. Серверный прокси `pages-worker.mjs` обращается к отдельному Worker с RAG. Ключ backend передаётся только между серверами. Посетителю не нужен аккаунт или включённый ноутбук владельца.

## Что работает в облаке

- Генерация: Workers AI, `@cf/qwen/qwen3-30b-a3b-fp8`, два параллельных запроса с разными ролями.
- Эмбеддинги: `@cf/baai/bge-m3`, 1024 измерения; корпус и вопросы используют одну модель.
- Корпус: 4504 фрагмента из шести PDF. У Чаадаева — 2327, у Хомякова — 2177.
- Поиск: Vectorize по смыслу и FTS5 в D1 по словам, слияние рангов с весами 75/25. В контекст идут до двух фрагментов своего автора.
- История: до восьми последних сообщений для каждой роли, передаётся из браузера.
- Кэш: до 24 часов для первых вопросов без истории; сохраняются только настоящие ответы модели.

Ответы — учебная ИИ-реконструкция. Корпус включает редакционные вступления и комментарии. Метаданные источника и страница PDF помогают проверять контекст, но не гарантируют точность каждого тезиса модели.

## Сборка интерфейса

Из корня репозитория:

```sh
npm ci
npm run build:cloud
npm run test:cloud
```

Конфигурации в Git содержат только примеры. Скопируйте `cloud/wrangler.pages.example.jsonc` в `cloud/wrangler.jsonc`, укажите URL своего backend. Создайте проект Pages и установите секрет через интерактивный ввод:

```sh
npx wrangler pages secret put BACKEND_TOKEN --project-name history-duel
npx wrangler pages deploy dist --config cloud/wrangler.jsonc --project-name history-duel --branch main
```

Не помещайте BACKEND_TOKEN в переменные с префиксом VITE_: они встраиваются в браузерный JavaScript. Реальные конфигурации Wrangler, `.env`, `.dev.vars`, логи и локальные данные исключены из Git.

## Backend и корпус

Скопируйте `cloud/backend/wrangler.example.jsonc` в `cloud/backend/wrangler.jsonc`. Создайте свои D1 и Vectorize (1024 измерения, cosine), заполните ID своей базы. Account ID и ID рабочей базы владельца в репозитории не публикуются.

```sh
npx wrangler d1 create history-duel-corpus
npx wrangler vectorize create history-duel-bge --dimensions=1024 --metric=cosine
cd cloud/backend
node prepare-corpus.mjs
npx wrangler d1 execute history-duel-corpus --remote --file=data/corpus.sql --config wrangler.jsonc
```

Для пересчёта эмбеддингов задайте CLOUDFLARE_ACCOUNT_ID и CLOUDFLARE_API_TOKEN только в локальном окружении процесса, затем запустите `node embed-corpus.mjs`. Скрипт сохраняет контрольные файлы в игнорируемом каталоге data/. Он не читает токены из профиля рабочего компьютера.

```sh
npx wrangler vectorize upsert history-duel-bge --file=data/vectors.ndjson --batch-size=500
npx wrangler deploy --config wrangler.jsonc
npx wrangler secret put GATEWAY_TOKEN --config wrangler.jsonc
```

GATEWAY_TOKEN у Worker и BACKEND_TOKEN у Pages должны совпадать. Введите одно и то же случайное значение через секреты сервисов. В исходниках значений секретов нет.

Workers AI, Vectorize и D1 имеют ограничения бесплатных тарифов. При исчерпании квоты приложение показывает ошибку. Платный тариф автоматически кодом не подключается.

## Проверка перед публикацией

```sh
gitleaks git . --log-opts=--all --redact=100
git diff --cached --name-only
```

Workflow Secret scan проверяет историю при push и pull request. `docs/visuals` содержит информативные PNG и редактируемые SVG; личные материалы заявки и видеозаписи в репозиторий не включены.
