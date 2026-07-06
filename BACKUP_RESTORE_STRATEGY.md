# Backup / Export / Restore Strategy

Date: 2026-07-06

## Current Database And Deploy Model

The current backend database is PostgreSQL, accessed through Prisma.

Key files:

- Prisma schema: `backend/prisma/schema.prisma`
- Prisma migrations: `backend/prisma/migrations/*/migration.sql`
- Backend env examples:
  - `backend/.env.example`
  - `backend/.env.production.example`
- Backend deploy/update flow:
  - `npm run prisma:generate`
  - `npm run prisma:deploy`
  - restart backend process

`DATABASE_URL` is the source of truth for the Prisma database connection.

## What Exists Now

| Item | Status | Notes |
| --- | --- | --- |
| Prisma migrations | Exists | `backend/prisma/migrations` contains the deployable schema history |
| Prisma deploy script | Exists | `backend/package.json` has `prisma:deploy` |
| Local Docker PostgreSQL | Removed | Local backend/Postgres is no longer used; local frontend calls Hetzner backend |
| Frontend JSON backup helpers | Exists | `src/utils/backupRestore.js`, `src/utils/backupFormat.js`; useful for UI snapshot import/export, not a full DB dump |
| Seed data | Partial/legacy | `src/data/seed.js` is frontend seed/static data, not Prisma seed |
| DB backup script | Backend-only | Run `npm run db:backup` inside `backend/` on Hetzner when needed |
| Restore script | Intentionally not added | Restore is destructive and must remain manual/checklisted for now |
| Dump docs | Added here | See commands below |

## What Was Missing

- No safe npm command for DB-level PostgreSQL export.
- No central restore checklist.
- No documented difference between frontend JSON snapshot and full database dump.
- No `.gitignore` protection for local dump files.
- No backup-related env placeholders.

## Backup / Export

### Preferred Hetzner Backend Command

Run on the Hetzner backend host from `/opt/nuar-crm/backend`:

```bash
npm run db:backup
```

This runs `backend/scripts/backup-db.js`, which:

- reads `DATABASE_URL` from `backend/.env`;
- runs `pg_dump`;
- writes a custom-format dump into `backend/backups/` by default;
- never writes to the database;
- never runs restore.

Optional env fields:

```bash
BACKUP_DIR=backups
PGDUMP_PATH=/usr/bin/pg_dump
```

Use `PGDUMP_PATH` only if `pg_dump` is not available in `PATH`.

### Manual pg_dump Command

Custom dump format:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file "backups/nuar-crm-$(date +%Y%m%d-%H%M%S).dump"
```

Plain SQL format:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl --file "backups/nuar-crm-$(date +%Y%m%d-%H%M%S).sql"
```

## Restore Checklist

Do not restore directly into production without a maintenance window and a fresh backup.

1. Identify target database:
   - production
2. Stop writes:
   - stop backend or put CRM into maintenance mode;
   - make sure no frontend session is actively writing.
3. Create a fresh pre-restore backup:

```bash
npm run db:backup
```

4. Verify the dump file exists and has non-zero size.
5. Restore into a clean staging database first, when a staging database exists.
6. Run migrations after restore if the dump is older than the current code:

```bash
cd backend
npm run prisma:deploy
```

7. Validate schema:

```bash
cd backend
npx prisma validate
```

8. Start backend and run smoke checks:
   - login;
   - clients list;
   - calendar state;
   - payment journal;
   - day close summary;
   - payroll summary.
9. Only after staging/local verification, repeat the restore for production if needed.

## Restore Commands

Custom dump into an empty target database:

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl "backups/nuar-crm.dump"
```

Plain SQL:

```bash
psql "$DATABASE_URL" < "backups/nuar-crm.sql"
```

## Important Safety Notes

- Restore is destructive when `--clean` is used.
- Never commit dump files. `.gitignore` now excludes:
  - `backups/`
  - `backend/backups/`
  - `*.dump`
  - `*.sql`
  - `*.backup`
- Keep production dumps outside the repo and encrypted or stored in restricted access storage.
- Frontend JSON backup is not a replacement for DB backup. It may miss backend-only tables such as `AuditLog`, `ErrorEvent`, `NotificationDelivery`, ledger records, and migration metadata.

## Migration Process

Expected backend deployment process:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
pm2 restart nuar-backend --update-env
```

Before applying new migrations to production:

1. Create DB backup.
2. Apply migrations on staging copy, when available.
3. Run smoke checks.
4. Apply production migration.
5. Verify backend health and critical CRM flows.

## What To Automate Later

1. Scheduled daily `pg_dump` with rotation, for example 7 daily + 4 weekly backups.
2. Encrypted offsite copy to cloud storage.
3. Automated backup verification:
   - restore latest dump into a disposable database;
   - run `prisma validate`;
   - run a small read-only smoke script.
4. Owner-only backend endpoint or admin screen that reports backup freshness, without exposing dump download publicly.
5. Separate staging database for restore drills.
6. Runbook for emergency rollback after failed migration.
