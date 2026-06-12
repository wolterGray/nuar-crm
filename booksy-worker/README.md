# Booksy Playwright Worker

Отдельный Node.js worker для отправки визитов из CRM в Booksy Pro.

CRM остаётся источником данных. Пользователь нажимает **«Отправить в Booksy»** в карточке визита → создаётся запись в `booksy_sync_jobs` → worker забирает задачу и запускает Playwright.

## Требования

- Node.js 20+
- Применена SQL-миграция `supabase/migrations/005_booksy_playwright_sync.sql`
- Service Role key Supabase (только для worker, не для frontend)

## Установка

```bash
cd booksy-worker
cp .env.example .env
npm install
npm run install:browsers
```

Заполните `.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOKSY_EMAIL`
- `BOOKSY_PASSWORD`

## Запуск

Из корня репозитория:

```bash
npm run booksy-worker
```

Однократная обработка очереди:

```bash
npm run booksy-worker:once
```

## Локальный тест без Booksy UI

В `.env`:

```env
BOOKSY_DRY_RUN=1
```

Worker пометит job как `done` и обновит `crm_snapshots` без Playwright.

## Что настраивать вручную

1. **`config/selectors.js`** — реальные CSS-селекторы Booksy Pro
2. **`lib/booksyBot.js`** — шаги логина, выбор бизнеса, создание визита/блокировки
3. **`booksyExternalId`** — сейчас demo-id, нужно парсить из Booksy после сохранения

## Безопасность

- Пароль Booksy хранится только в `.env` worker'а
- Service role key не попадает в CRM frontend
- `.env` не коммитить

## Будущий запуск 24/7 на Windows

- Установить Node.js LTS
- Скопировать репозиторий / только `booksy-worker`
- Настроить `.env`
- Запуск через Task Scheduler или `pm2`
- `BOOKSY_HEADLESS=1`
- Логи писать в файл

TODO перед продом:

- [ ] Подтвердить селекторы Booksy Pro PL
- [ ] Обработать 2FA / captcha Booksy
- [ ] Реальный external ID из Booksy
- [ ] Мониторинг failed jobs
