# NUAR CRM — контекст для ИИ

> **Полное описание троицы (CRM + админка + сайт)** — в соседнем репозитории:  
> `../lavandi/AGENTS.md` (или `wolterGray/lavandi/AGENTS.md` на GitHub).  
> **Читай тот файл первым**, если задача затрагивает сайт или CMS.

---

## Что это

**nuar-crm** — внутренняя CRM салона NUAR (Варшава): клиенты, визиты, услуги, сотрудники, статистика, задачи.

| | |
|---|---|
| Репозиторий | `wolterGray/nuar-crm` |
| Стек | React 19 + Vite, Node/Express API, Prisma + PostgreSQL |
| Деплой | Hetzner VPS: frontend + backend + PostgreSQL |

---

## Связь с сайтом и админкой

CRM работает через собственный backend на Hetzner. Сайт и CMS могут использовать общие таблицы сайта в PostgreSQL:

| Компонент | Репо | URL |
|-----------|------|-----|
| CRM | `nuar-crm` | Hetzner / `crm.nuarr.pl` |
| Сайт + админка | `lavandi` | https://nuarr.pl, https://nuarr.pl/admin |

### CRM → сайт (автоматически)

- При изменении **цен и длительностей** услуг в CRM данные пишутся backend-роутами сайта в `site_content` (`id = 'main'`, поле `data.services`)
- Legacy frontend sync `src/utils/siteSync.js` оставлен только для старого Supabase-flow и не должен быть основным путём на Hetzner.
- Задержка ~1.2 с, **без кнопок** «опубликовать»
- Админка сайта **не** редактирует цены — только фото и тексты услуг

### CRM → админка (SSO)

- Страница **«Сайт»** (`src/components/pages/SitePage.jsx`)
- Кнопка «Открыть админку» открывает админку сайта. Если включён legacy Supabase-flow, `src/utils/openSiteAdmin.js` может передавать Supabase-сессию.

---

## Backend / база

Основной runtime:

- `backend/` — Node/Express API
- `backend/prisma/schema.prisma` — PostgreSQL-модель CRM
- `backend/.env` — секреты Hetzner (`DATABASE_URL`, JWT, SMS/Telegram/Gmail токены)
- `VITE_BACKEND_URL` — frontend → backend

Общие таблицы сайта:

- `site_content` — JSON CMS сайта (CRM пишет только `services.price/time`)
- `site_images` — бинарные картинки CMS (`dbimg:<id>`)

Supabase-упоминания в frontend (`src/lib/supabase.js`, `siteSync.js`, `openSiteAdmin.js`) считаются legacy. Не развивай их для новых задач, если пользователь явно не просит старый flow.

---

## Структура кода

```
src/
  App.jsx                         # Главное приложение, роутинг через activePage
  components/pages/SitePage.jsx   # Раздел «Сайт»
  utils/siteSync.js               # Legacy синхронизация услуг → site_content
  utils/openSiteAdmin.js          # Legacy SSO/open admin helper
  data/siteServicesCatalog.js     # Каталог услуг сайта для маппинга имён CRM ↔ сайт
backend/
  server.js                       # Express API
  prisma/schema.prisma            # PostgreSQL schema
  routes/                         # CRM/site/automation endpoints
```

Имена услуг CRM маппятся на slug сайта через нормализацию и алиасы (`CRM_NAME_ALIASES` в `siteSync.js`).

---

## Два типа изменений

| Тип | Пример | Нужен push? |
|-----|--------|-------------|
| Данные CRM (визиты, клиенты) | Работа в CRM UI | Нет (живёт в PostgreSQL на Hetzner) |
| Цены услуг | Изменение в каталоге CRM | Нет (backend автообновляет `site_content`) |
| Код CRM | Новая страница, логика | **Да** → push → Hetzner deploy |
| Контент сайта (тексты, фото) | — | **Не в этом репо** → `lavandi` админка |

---

## Команды

```bash
npm run dev
npm run build
npm run lint
```

Backend:

```bash
cd backend
npm run dev
npm run start
npm run prisma:generate
```

---

## Для ИИ: частые задачи

- **Цены на сайте не совпадают** → проверь backend site/CMS routes, маппинг имён услуг и `site_content.data.services`
- **Автоматизация шлёт ошибки** → проверь настройки включения SMS/Telegram/Gmail и backend cron/PM2 на Hetzner
- **Админка просит пароль** → проверь текущий auth-flow сайта в `lavandi`; legacy Supabase SSO не считать основным
- **Фича на сайте/в CMS** → работай в репозитории **`lavandi`**, не здесь
- **Commit + push** — пользователь обычно ожидает после изменений кода

Подробности деплоя, косметики, палитры, маршрутов — в `lavandi/AGENTS.md`.
