# NUAR CRM: Hetzner VPS Deployment Runbook

This is a preparation guide only. Do not run these commands until the target VPS, domain, and production credentials are ready.

## Target Architecture

- VPS: Hetzner, Ubuntu 24.04.
- Frontend: static Vite build served by Nginx, or Vercel frontend pointing to the same backend URL.
- Backend: Node LTS + Express on `127.0.0.1:3001`, managed by PM2.
- Database: PostgreSQL on the VPS.
- ORM: Prisma with `prisma migrate deploy`.
- Public entrypoint: Nginx + HTTPS, for example `https://crm.example.com`.

The production frontend must use an HTTPS backend URL:

```bash
VITE_BACKEND_URL=https://crm.example.com
```

If the frontend remains on Vercel, the same value must be configured in Vercel environment variables and the backend `CORS_ORIGIN` must include the Vercel domain.

## 1. Create Server

1. Create a Hetzner VPS with Ubuntu 24.04.
2. Add an SSH key.
3. Point DNS `A` record, for example `crm.example.com`, to the VPS public IP.
4. SSH into the server:

```bash
ssh root@YOUR_SERVER_IP
```

5. Update packages:

```bash
apt update
apt upgrade -y
apt install -y git curl ufw nginx postgresql postgresql-contrib
```

6. Enable a basic firewall:

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw enable
ufw status
```

## 2. Install Node LTS

Use the current Node LTS from NodeSource or another trusted LTS installer. Example with NodeSource LTS setup:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
node -v
npm -v
```

Install PM2 globally:

```bash
npm install -g pm2
pm2 -v
```

## 3. PostgreSQL

Create a dedicated database and user:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE DATABASE nuar_crm;
CREATE USER nuar_crm WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE nuar_crm TO nuar_crm;
\c nuar_crm
GRANT ALL ON SCHEMA public TO nuar_crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nuar_crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nuar_crm;
\q
```

Production `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://nuar_crm:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/nuar_crm?schema=public
```

The data physically lives on the VPS PostgreSQL data directory managed by the OS package, usually under `/var/lib/postgresql/`.

## 4. Clone And Install

Create an application directory:

```bash
mkdir -p /var/www
cd /var/www
git clone git@github.com:wolterGray/nuar-crm.git
cd nuar-crm
```

Install dependencies:

```bash
npm ci
cd backend
npm ci
cd ..
```

## 5. Environment Variables

Do not commit real env files.

Frontend production env, based on `.env.production.example`:

```bash
cp .env.production.example .env.production
nano .env.production
```

Required frontend variables:

```bash
VITE_BACKEND_URL=https://crm.example.com
VITE_ENABLE_AUTOMATION_STATUS=false
```

Optional frontend variables, only if legacy Supabase/site flows are still used:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SITE_URL=https://nuarr.pl
```

Backend env, based on `backend/.env.production.example`:

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
chmod 600 backend/.env
```

Required backend variables:

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://nuar_crm:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/nuar_crm?schema=public
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME_LONG_PASSWORD
JWT_SECRET=CHANGE_ME_AT_LEAST_32_RANDOM_CHARACTERS
CORS_ORIGIN=https://crm.example.com,https://your-vercel-app.vercel.app
```

Important:

- `JWT_SECRET` must be long, random, and stable. Changing it invalidates all current sessions.
- `ADMIN_PASSWORD` is the CRM admin password. Store it outside git.
- `CORS_ORIGIN` must list exact frontend origins. In production, LAN wildcard behavior is disabled by `NODE_ENV=production`.
- For Vercel frontend, `VITE_BACKEND_URL` must be an HTTPS URL, otherwise browsers will block mixed content.

## 6. Prisma

Generate Prisma Client and apply existing migrations:

```bash
cd /var/www/nuar-crm/backend
npm run prisma:generate
npm run prisma:deploy
```

Check database connection:

```bash
DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" npx prisma db pull --print >/tmp/nuar-prisma-check.txt
```

To inspect data manually:

```bash
psql "postgresql://nuar_crm:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/nuar_crm?schema=public" -c 'SELECT id, name, phone, email, "createdAt" FROM "Client" ORDER BY "createdAt" DESC LIMIT 20;'
```

## 7. Build Frontend

From repo root:

```bash
cd /var/www/nuar-crm
npm run build
```

The static build is created in:

```bash
/var/www/nuar-crm/dist
```

## 8. PM2 Backend

The repo contains `ecosystem.config.js`.

Start backend:

```bash
cd /var/www/nuar-crm
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs nuar-crm-backend
```

Enable PM2 on reboot:

```bash
pm2 save
pm2 startup systemd
```

Run the command printed by `pm2 startup`.

Health check:

```bash
curl http://127.0.0.1:3001/health
```

Expected:

```json
{"status":"ok"}
```

JWT protection check:

```bash
curl -i http://127.0.0.1:3001/api/clients
```

Expected: `401`.

Login check:

```bash
curl -s -X POST http://127.0.0.1:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"CHANGE_ME_LONG_PASSWORD"}'
```

Expected: JSON with `token`.

## 9. Nginx

Use `nginx.conf.example` as a starting point.

Copy it to Nginx sites:

```bash
cp /var/www/nuar-crm/nginx.conf.example /etc/nginx/sites-available/nuar-crm
nano /etc/nginx/sites-available/nuar-crm
ln -s /etc/nginx/sites-available/nuar-crm /etc/nginx/sites-enabled/nuar-crm
nginx -t
systemctl reload nginx
```

The example serves:

- static frontend from `/var/www/nuar-crm/dist`;
- `/api/*` through backend `127.0.0.1:3001`;
- `/functions/*` through backend `127.0.0.1:3001`;
- `/health` through backend `127.0.0.1:3001`;
- SPA fallback to `/index.html`.

If the frontend remains on Vercel, Nginx can still expose only backend routes. Keep `/api`, `/functions`, and `/health`; remove the static frontend root only if you do not serve CRM from the VPS.

## 10. SSL With Let's Encrypt

Install Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Issue certificate:

```bash
certbot --nginx -d crm.example.com
```

Test renewal:

```bash
certbot renew --dry-run
```

After SSL is active, update frontend env:

```bash
VITE_BACKEND_URL=https://crm.example.com
```

Then rebuild frontend:

```bash
cd /var/www/nuar-crm
npm run build
```

## 11. PostgreSQL Backups

Create backup directory:

```bash
mkdir -p /var/backups/nuar-crm
chmod 700 /var/backups/nuar-crm
```

Create backup script:

```bash
nano /usr/local/bin/backup-nuar-crm-postgres.sh
```

Script content:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nuar-crm"
DATABASE_URL="postgresql://nuar_crm:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/nuar_crm?schema=public"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/nuar_crm-$STAMP.sql.gz"
find "$BACKUP_DIR" -type f -name "nuar_crm-*.sql.gz" -mtime +14 -delete
```

Enable it:

```bash
chmod 700 /usr/local/bin/backup-nuar-crm-postgres.sh
/usr/local/bin/backup-nuar-crm-postgres.sh
ls -lh /var/backups/nuar-crm
```

Add daily cron:

```bash
crontab -e
```

Cron line:

```cron
0 3 * * * /usr/local/bin/backup-nuar-crm-postgres.sh >/var/log/nuar-crm-backup.log 2>&1
```

Restore example:

```bash
gunzip -c /var/backups/nuar-crm/nuar_crm-YYYYMMDD-HHMMSS.sql.gz | psql "postgresql://nuar_crm:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/nuar_crm?schema=public"
```

Before production, test restoring into a separate database.

## Production Readiness Audit

### NODE_ENV

- Backend uses `process.env.NODE_ENV !== 'production'` to allow local/LAN dev origins.
- Production must set `NODE_ENV=production` in `backend/.env` and PM2 env.
- Vite production build sets `import.meta.env.PROD`; dev/mock controls are hidden in production.

### CORS

- Backend reads `CORS_ORIGIN` as a comma-separated allowlist.
- In production, only exact origins are allowed.
- Include all real frontend origins:
  - `https://crm.example.com` if serving frontend from VPS;
  - Vercel frontend domain if frontend stays on Vercel.

### JWT

- `POST /api/auth/login` is public.
- `/api/*` and `/functions/*` are protected by JWT middleware.
- Missing or invalid `Authorization: Bearer <token>` returns `401`.
- `JWT_SECRET` is required; backend logs a clear error if it is missing.

### Prisma

- Prisma datasource is PostgreSQL via `DATABASE_URL`.
- Migrations exist under `backend/prisma/migrations`.
- Production deployment must run:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
```

### Build Process

- Frontend build: `npm run build`.
- Backend syntax check: `node --check backend/server.js backend/routes/auth.js backend/routes/crud.js`.
- Backend runtime: `node backend/server.js` or PM2 from `ecosystem.config.js`.

### File Upload Paths

Current audit found no backend filesystem upload path:

- no `multer`;
- no `/uploads`;
- no `express.static` upload directory;
- no backend `fs.writeFile` / `createWriteStream` upload pipeline.

Current file-related flows are browser-side:

- backup import reads a selected file in the browser;
- Excel export writes a file from the browser;
- Gmail/Booksy attachments are parsed in memory/state, not persisted as local files by backend.

No VPS persistent upload volume is required right now. If future uploads are added, store them outside the repo, for example `/var/lib/nuar-crm/uploads`, and add backup policy.

## First Deploy Checklist

1. DNS points to VPS public IP.
2. PostgreSQL database and user created.
3. `backend/.env` exists and is `chmod 600`.
4. `NODE_ENV=production`.
5. `DATABASE_URL` points to local VPS PostgreSQL.
6. `JWT_SECRET` is long and random.
7. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are final production credentials.
8. `CORS_ORIGIN` includes the exact production frontend origins.
9. `VITE_BACKEND_URL` is HTTPS and points to the public backend domain.
10. `npm ci` completed in root and `backend`.
11. `npm run build` completed.
12. `npm run prisma:deploy` completed.
13. PM2 backend is online.
14. Nginx config passes `nginx -t`.
15. SSL certificate is issued.
16. `/health` returns `{"status":"ok"}` over HTTPS.
17. `/api/clients` without token returns `401`.
18. Login returns JWT token.
19. `/api/clients` with token returns CRM data.
20. PostgreSQL backup script creates a valid `.sql.gz`.
21. Restore has been tested on a separate database.

## Risks Before First Production Deploy

- The app uses a single admin credential, not per-user accounts or roles.
- JWT is stored in `localStorage`; HTTPS and XSS hygiene are mandatory.
- There is no explicit login rate limiting yet. Add Nginx or Express rate limiting before public exposure.
- Backup restore must be tested before relying on backups.
- If frontend is served from Vercel, backend must be public HTTPS and CORS must include the Vercel domain.
- If frontend is served from HTTPS but backend remains HTTP, browser requests will be blocked as mixed content.
- Some optional automation/site integrations still reference Supabase env variables. They should remain disabled unless configured intentionally.
- PM2 logs need retention/rotation (`pm2 install pm2-logrotate`) before long-running production use.
- PostgreSQL runs on the same VPS; server disk failure means backups are critical and should eventually be copied off-server.
- Secrets are file-based in `backend/.env`; restrict SSH access and file permissions.
