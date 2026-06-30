# NUAR CRM Backend: запуск на Windows mini PC

Эта инструкция поднимает только локальную PostgreSQL-базу и backend. Frontend остаётся на текущей Supabase-интеграции, к backend не подключается.

## Что установить

- Git
- Node.js LTS
- Docker Desktop

## Первый запуск

```bat
git clone <repo-url>
cd <project>\backend
copy .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start
```

## Проверка

В новом терминале:

```bat
curl http://localhost:3001/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## Как остановить

Остановить backend: `Ctrl+C` в терминале, где запущен `npm run start`.

Остановить PostgreSQL:

```bat
docker compose down
```

Данные PostgreSQL сохраняются в Docker volume `pgdata`.

## Как сделать backup

Из папки `backend`:

```bat
docker compose exec -T db pg_dump -U postgres -d nuar_crm > backup.sql
```

Файл `backup.sql` появится в текущей папке.

## Как восстановить backup

Из папки `backend`, при запущенном контейнере PostgreSQL:

```bat
docker compose exec -T db psql -U postgres -d nuar_crm < backup.sql
```

Если нужно восстановить в чистую базу, сначала остановите backend, затем пересоздайте БД или volume осознанно. Не удаляйте volume с рабочими данными без свежего backup.
