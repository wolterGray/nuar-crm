# NUAR CRM

Локальная CRM массажной студии на React и Vite.

## Локальный запуск

```bash
npm install
npm run dev
```

Создайте `.env.local` по примеру `.env.example`.

## Supabase

1. Откройте SQL Editor в панели Supabase.
2. Выполните файл `supabase/schema.sql`.
3. В Authentication создайте пользователя-владельца CRM.

Первая серверная схема хранит единый JSON-снимок CRM с Row Level Security.
Доступ к снимку получает только авторизованный владелец. После стабилизации
интеграций данные можно постепенно разнести по отдельным таблицам.

## Vercel

1. Импортируйте приватный GitHub-репозиторий в Vercel.
2. Framework Preset: `Vite`.
3. Добавьте environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_LOCAL_CRM_LOGIN
VITE_LOCAL_CRM_PASSWORD
```

`VITE_LOCAL_CRM_LOGIN` и `VITE_LOCAL_CRM_PASSWORD` используются временно.
После подключения Supabase Auth их нужно удалить из Vercel.

## Проверка

```bash
npm run lint
npm run build
git diff --check
```
