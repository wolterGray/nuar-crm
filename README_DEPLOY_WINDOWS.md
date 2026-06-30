# NUAR CRM Backend: запуск на Windows mini PC

Эта инструкция поднимает только локальную PostgreSQL-базу и backend. Frontend остаётся на текущей Supabase-интеграции, к backend не подключается.

## Что установить

- Git
- Node.js LTS
- Docker Desktop
- PM2:

```bat
npm install -g pm2
```

## Первый запуск

```bat
git clone <repo-url>
cd <project>\backend
copy .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:deploy
```

### Первый запуск backend через PM2

Из корня проекта:

```bat
scripts\windows\start-backend.bat
```

Скрипт перейдёт в `backend` и запустит `server.js` через PM2 с именем процесса `nuar-backend`.

Проверить процесс:

```bat
pm2 status
```

## Проверка

В PowerShell или CMD:

```bat
curl http://localhost:3001/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## Обновление backend после git push

После того как изменения запушены с Mac, на Windows mini PC из корня проекта выполните:

```bat
scripts\windows\update-backend.bat
```

Скрипт делает:

```bat
git pull origin main
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
pm2 restart nuar-backend --update-env
```

Если процесса `nuar-backend` ещё нет, скрипт запустит его через PM2.

## Как остановить

Остановить backend:

```bat
scripts\windows\stop-backend.bat
```

Остановить PostgreSQL:

```bat
cd <project>\backend
docker compose down
```

Данные PostgreSQL сохраняются в Docker volume `pgdata`.

## Как сделать backup

Из папки `backend`:

```bat
cd <project>\backend
docker compose exec -T db pg_dump -U postgres -d nuar_crm > backup.sql
```

Файл `backup.sql` появится в текущей папке.

## Как восстановить backup

Из папки `backend`, при запущенном контейнере PostgreSQL:

```bat
cd <project>\backend
docker compose exec -T db psql -U postgres -d nuar_crm < backup.sql
```

Если нужно восстановить в чистую базу, сначала остановите backend, затем пересоздайте БД или volume осознанно. Не удаляйте volume с рабочими данными без свежего backup.
