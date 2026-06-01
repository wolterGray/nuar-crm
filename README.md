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

При первом входе существующая локальная база загружается в Supabase. Далее CRM
получает серверный снимок после авторизации и автоматически сохраняет изменения.
`localStorage` остается локальным кэшем и резервной копией браузера.

## Vercel

1. Импортируйте приватный GitHub-репозиторий в Vercel.
2. Framework Preset: `Vite`.
3. Добавьте environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Вход владельца работает через Supabase Auth. Пароль не хранится в сборке CRM.

### Google-вход и Gmail

1. В Google Cloud создайте OAuth Web Client и включите Gmail API.
2. В consent screen добавьте scope `https://www.googleapis.com/auth/gmail.readonly`.
3. В Supabase откройте Authentication -> Providers -> Google, включите провайдер
   и добавьте Google Client ID и Client Secret.
4. В Google OAuth Client добавьте callback URL из настроек Google-провайдера
   Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.
5. В Supabase Authentication -> URL Configuration укажите Vercel-домен как
   Site URL и добавьте локальный адрес и Vercel-домен в Redirect URLs.

После входа через Google CRM использует выданный токен для чтения Gmail.
Ручной Google OAuth Client ID в настройках остается запасным вариантом.
CRM запрашивает только чтение писем и не получает пароль Gmail.

Для тестового OAuth consent screen добавьте email владельца в Test users.

## Маршруты

`vercel.json` отправляет неизвестные серверу URL в Vite-приложение. Поэтому
ссылка сброса пароля `/reset-password` открывается корректно после публикации,
а неизвестные пути отображают экран `404` внутри CRM.

## Проверка

```bash
npm run lint
npm run build
git diff --check
```
