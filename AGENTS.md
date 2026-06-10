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
| Стек | React 19 + Vite, Supabase Auth + Postgres |
| Деплой | Vercel (отдельный проект от сайта) |

---

## Связь с сайтом и админкой

Три части делят **один Supabase**:

| Компонент | Репо | URL |
|-----------|------|-----|
| CRM | `nuar-crm` | Vercel |
| Сайт + админка | `lavandi` | https://nuarr.pl, https://nuarr.pl/admin |

### CRM → сайт (автоматически)

- При изменении **цен и длительностей** услуг в CRM данные пишутся в `site_content` (`id = 'main'`, поле `data.services`)
- Реализация: `src/utils/siteSync.js` → `publishServicesToSite()`
- Задержка ~1.2 с, **без кнопок** «опубликовать»
- Админка сайта **не** редактирует цены — только фото и тексты услуг

### CRM → админка (SSO)

- Страница **«Сайт»** (`src/components/pages/SitePage.jsx`)
- Кнопка «Открыть админку» → `src/utils/openSiteAdmin.js` передаёт Supabase-сессию в `nuarr.pl/admin#access_token=...`
- Повторный логин в админку **не нужен**

---

## Supabase

Переменные окружения (Vercel / `.env.production`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Таблицы CRM (существующие) + общие с сайтом:

- `site_content` — JSON CMS сайта (CRM пишет только `services.price/time`)
- `site_images` — бинарные картинки CMS (`dbimg:<id>`)

Миграции CMS лежат в **`lavandi/supabase/migrations/`**, не в этом репо.

---

## Структура кода

```
src/
  App.jsx                         # Главное приложение, роутинг через activePage
  components/pages/SitePage.jsx   # Раздел «Сайт»
  utils/siteSync.js               # Синхронизация услуг → site_content
  utils/openSiteAdmin.js          # Открытие админки с SSO
  data/siteServicesCatalog.js     # Каталог услуг сайта для маппинга имён CRM ↔ сайт
  lib/supabase.js                 # Клиент Supabase
```

Имена услуг CRM маппятся на slug сайта через нормализацию и алиасы (`CRM_NAME_ALIASES` в `siteSync.js`).

---

## Два типа изменений

| Тип | Пример | Нужен push? |
|-----|--------|-------------|
| Данные CRM (визиты, клиенты) | Работа в CRM UI | Нет (живёт в Supabase payload CRM) |
| Цены услуг | Изменение в каталоге CRM | Нет (авто в `site_content`) |
| Код CRM | Новая страница, логика | **Да** → push → Vercel |
| Контент сайта (тексты, фото) | — | **Не в этом репо** → `lavandi` админка |

---

## Команды

```bash
npm run dev
npm run build
npm run lint
```

---

## Для ИИ: частые задачи

- **Цены на сайте не совпадают** → проверь `siteSync.js`, маппинг имён услуг, `site_content.data.services` в Supabase
- **Админка просит пароль** → SSO из CRM или Supabase Auth; на проде нужны VITE_* в сборке `lavandi`
- **Фича на сайте/в CMS** → работай в репозитории **`lavandi`**, не здесь
- **Commit + push** — пользователь обычно ожидает после изменений кода

Подробности деплоя, косметики, палитры, маршрутов — в `lavandi/AGENTS.md`.
