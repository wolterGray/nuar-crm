# NUAR CRM — Backup & Disaster Recovery Strategy (Runbook)

> **Статус:** Production Ready  
> **Обновлено:** Октябрь 2026  
> **Компоненты:** PostgreSQL, Prisma ORM, Hetzner VPS, Node.js Express API.

---

## 1. Обзор архитектуры базы данных и резервного копирования

- **СУБД:** PostgreSQL 16+ на Hetzner VPS.
- **ORM:** Prisma (`backend/prisma/schema.prisma`).
- **Строка подключения:** `DATABASE_URL` в `backend/.env`.
- **Формат резервной копии:** Двоичный кастомный архив PostgreSQL (`--format=custom`, заголовок `PGDMP`).
- **Каталог хранения на сервере:** `/opt/nuar-crm/backend/backups/`.
- **Политика ротации (Retention):** Хранение последних 14 дампов (настраивается через `BACKUP_RETENTION_COUNT`).

---

## 2. Команды управления бэкапами (CLI / npm)

Все команды выполняются в директории `backend/`:

```bash
cd /opt/nuar-crm/backend
```

### 1. Создание резервной копии с автоматической валидацией и ротацией

```bash
# Ручной запуск со стандартным тегом
npm run db:backup

# Запуск с явным указанием тега (daily, weekly, pre-migration)
node scripts/backup-db.js --tag=daily
node scripts/backup-db.js --tag=pre-migration
```

**Что делает скрипт:**
1. Подключается к `DATABASE_URL` и выполняет `pg_dump --format=custom --no-owner --no-acl`.
2. Проверяет сигнатуру файла: размер > 1 КБ и magic header `PGDMP`.
3. Запускает `pg_restore --list` для проверки целостности структуры таблицы оглавления (TOC).
4. Удаляет старые дампы сверх лимита хранения (`maxKeep = 14`), защищая диск VPS от переполнения.
5. Записывает метаданные последнего успешного бэкапа в `backups/latest-backup.json`.

---

### 2. Проверка статуса и свежести бэкапов

```bash
npm run db:backup:status
```

Выводит количество доступных дампов, размер последнего архива, дату создания и статус валидности.

---

### 3. Проверка целостности дампа и тестовое восстановление

```bash
# Структурная валидация последнего дампа (проверка заголовка и TOC)
npm run db:backup:verify

# Валидация конкретного файла
node scripts/verify-backup.js --file=backups/nuar-crm-daily-2026-10-19.dump

# БЕЗОПАСНЫЙ DRY-RUN: Тестовое восстановление в изолированную тестовую базу
TEST_DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/nuar_crm_test" npm run db:backup:verify
```

> [!IMPORTANT]
> **Встроенный предохранитель (Safety Guard):**  
> Скрипт `verify-backup.js` программно блокирует запуск, если `TEST_DATABASE_URL` совпадает с `DATABASE_URL`, или если имя базы данных не содержит `test`, `staging` или `dev`. Восстановление поверх боевой базы невозможно.

---

## 3. Автоматизация на Hetzner VPS (Crontab)

Для обеспечения ежедневных и еженедельных бэкапов на сервере Hetzner настраивается системный cron.

Откройте crontab под пользователем, от которого работает CRM:

```bash
crontab -e
```

Добавьте следующие строки:

```cron
# NUAR CRM — Ежедневный ночной бэкап в 03:00 (Europe/Warsaw)
0 3 * * * cd /opt/nuar-crm/backend && /usr/bin/node scripts/backup-db.js --tag=daily >> /var/log/nuar-crm-backup.log 2>&1

# NUAR CRM — Еженедельная проверка целостности бэкапа по воскресеньям в 04:00
0 4 * * 0 cd /opt/nuar-crm/backend && /usr/bin/node scripts/verify-backup.js >> /var/log/nuar-crm-backup.log 2>&1
```

Ротация файлов происходит автоматически при каждом вызове скрипта (хранятся последние 14 архивов).

---

## 4. Disaster Recovery Runbook (Пошаговые сценарии восстановления)

### Сценарий А: Полный сбой сервера Hetzner / Переезд на новый VPS

Если сервер Hetzner полностью уничтожен или недоступен:

1. **Создайте новый облачный сервер Hetzner (Ubuntu 24.04 LTS / Debian 12).**
2. **Установите системные зависимости:**
   ```bash
   sudo apt update && sudo apt install -y curl git postgresql postgresql-contrib
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```
3. **Настройте PostgreSQL и создайте пользователя и базу:**
   ```bash
   sudo -u postgres psql -c "CREATE USER nuar_user WITH PASSWORD 'STRONG_PASSWORD_HERE';"
   sudo -u postgres psql -c "CREATE DATABASE nuar_production OWNER nuar_user;"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nuar_production TO nuar_user;"
   ```
4. **Склонируйте репозиторий и настройте переменные окружения:**
   ```bash
   git clone https://github.com/wolterGray/nuar-crm.git /opt/nuar-crm
   cd /opt/nuar-crm/backend
   cp .env.production.example .env
   # Впишите в .env актуальные DATABASE_URL, JWT_SECRET, VAPID_*, SMSAPI_TOKEN, ADMIN_*
   npm install
   npm run prisma:generate
   ```
5. **Скопируйте последний дамп (`nuar-crm-*.dump`) на сервер в `/opt/nuar-crm/backend/backups/`.**
6. **Выполните восстановление базы:**
   ```bash
   pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl /opt/nuar-crm/backend/backups/LATEST_DUMP.dump
   ```
7. **Примените актуальные миграции (если код новее дампа):**
   ```bash
   npm run prisma:deploy
   npx prisma validate
   ```
8. **Запустите backend через PM2:**
   ```bash
   pm2 start server.js --name nuar-backend
   pm2 save
   pm2 startup
   ```
9. **Проведите Smoke-тест:**
   ```bash
   curl -I http://localhost:3001/health
   # Проверьте логи
   pm2 logs nuar-backend --lines 50
   ```

---

### Сценарий Б: Локальное повреждение данных или случайное удаление

Если база данных работает, но произошла ошибка или потеря критических данных:

1. **Немедленно остановите backend, чтобы прекратить входящую запись:**
   ```bash
   pm2 stop nuar-backend
   ```
2. **Создайте защитный дамп текущего состояния базы «как есть» перед откатом:**
   ```bash
   cd /opt/nuar-crm/backend
   node scripts/backup-db.js --tag=pre-rollback
   ```
3. **Восстановите проверенную резервную копию:**
   ```bash
   pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/nuar-crm-daily-TARGET_DATE.dump
   ```
4. **Выполните проверку целостности Prisma:**
   ```bash
   npm run prisma:deploy
   ```
5. **Запустите backend:**
   ```bash
   pm2 start nuar-backend
   ```
6. **Проверьте авторизацию и основные экраны CRM (Календарь, Клиенты, Визиты).**

---

### Сценарий В: Откат после неудачной миграции Prisma

Если при деплое новой версии миграция завершилась с ошибкой:

1. Остановите процесс деплоя.
2. Проверьте статус миграций:
   ```bash
   npx prisma migrate status
   ```
3. Если схема повреждена: восстановите дамп, созданный перед деплоем (`--tag=pre-migration`):
   ```bash
   pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/nuar-crm-pre-migration-*.dump
   ```
4. Перезапустите предыдущую стабильную версию бэкенда в PM2.
