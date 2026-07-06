# FINAL NUAR CRM AUDIT REPORT

Финальный статус: **ready for staged production smoke**.

Этот документ фиксирует итог аудита и hardening-этапов NUAR CRM перед staged production smoke. Он не заменяет ручные чеклисты, а собирает в одном месте, какие финансовые, backend, security, audit, backup и performance-контуры уже закрыты.

## 1. Финансовый контур

Критичные финансовые сценарии переведены с frontend-orchestrated multi-request flow на backend-calculated/backend-transaction flow.

Закрыто:

- Завершение completed visit для ordinary/package/certificate/mixed package+certificate.
- Откат completed visit для ordinary/package/certificate/mixed package+certificate.
- Удаление completed CalendarEntry вместе со связанным Visit и восстановлением package/certificate ledger.
- Редактирование completed visit/payment для ordinary/package/certificate/mixed package+certificate.
- Journal-only package/certificate create/edit/delete через backend transaction endpoints.
- Продажа сертификата переведена с цепочки `createCertificate -> createVisit -> updateCertificate` на backend endpoint.
- Day close теперь считается на backend.
- Payroll summary и mark-paid переведены на backend source of truth.
- Legacy financial CRUD guarded.
- Прямые frontend helper-вызовы `updatePackageBalance` / `updateCertificateBalance` удалены.

Пакеты и сертификаты теперь используют ledger-подход:

- `ClientPackageUsage` для списаний/восстановлений пакетов.
- `CertificateUsage` для списаний/восстановлений сертификатов.
- `revertedAt` используется для защиты от двойного восстановления.
- Уникальные ограничения на usage, связанный с `visitId`, защищают от двойного списания.
- Mixed package+certificate сценарии обрабатываются атомарно: либо оба ledger изменения применены, либо операция отклонена.

Продажа пакета была проверена отдельно. Multi-request financial flow не найден; отдельный endpoint `POST /api/client-packages/sell` не добавлялся, потому что текущая схема не содержит безопасной sale-payment linkage, а искусственное создание Visit могло бы привести к double-counting.

## 2. Backend Transaction Endpoints — Source Of Truth

Текущие backend endpoints, которые являются source of truth для критичных финансовых операций:

- `POST /api/visits/complete`  
  Завершение визита: ordinary/package/certificate/mixed.

- `POST /api/visits/revert-completed`  
  Откат completed visit: ordinary/package/certificate/mixed.

- `POST /api/calendar-entries/delete-completed`  
  Удаление completed CalendarEntry со связанным Visit и восстановлением package/certificate ledger.

- `POST /api/visits/update-completed`  
  Редактирование completed visit/payment: ordinary/package/certificate/mixed.

- `POST /api/visits/journal/financial`  
  Journal-only financial create.

- `PUT /api/visits/journal/:id/financial`  
  Journal-only financial update.

- `POST /api/visits/journal/:id/delete-financial`  
  Journal-only financial delete.

- `POST /api/certificates/sell`  
  Продажа сертификата одной backend transaction.

- `POST /api/day-close-records/close`  
  Backend-calculated закрытие дня.

- `GET /api/payroll/summary`  
  Backend payroll summary.

- `POST /api/payroll/mark-paid`  
  Backend transaction для фиксации выплаты.

Legacy endpoints оставлены для backward compatibility, но guarded:

- `POST /api/day-close-records`
- `PUT /api/day-close-records/:id`
- `POST /api/payroll-records`
- `PUT /api/payroll-records/:id`

Они требуют явного `allowLegacyFinancialWrite: true`, имеют validation guards и пишут AuditLog warning/attempt.

## 3. RBAC

Добавлен минимальный backend RBAC без большого рефакторинга.

Сделано:

- В JWT payload добавлена роль `role: "owner"` для текущего admin login.
- Добавлен backend helper `requireOwner`.
- Owner guard добавлен на наиболее критичные endpoints:
  - payroll summary / mark-paid;
  - day close / close;
  - legacy financial CRUD;
  - employee create/update/delete;
  - settings/config/system state writes;
  - destructive delete routes;
  - опасные write/bulk/destructive routes в `backend/routes/functions.js`.

Текущая модель доступа:

- Реального многоуровневого RBAC пока нет.
- Фактический режим: single-admin / owner.
- Обычные operational routes для CRM оставлены authenticated-only, чтобы не ломать текущий UI.

Что осталось на отдельные этапы:

- Роли `manager`, `master`, `readonly`.
- Frontend RBAC/permission-aware UI.
- Политики доступа к отдельным разделам: финансы, сотрудники, payroll, audit log.

## 4. AuditLog

Сделан AuditLog consistency audit и добавлены минимальные логи в critical gaps.

Сейчас AuditLog покрывает:

- auth/login события;
- completed visit complete/revert/update/delete;
- package usage / restore;
- certificate usage / restore;
- mixed package+certificate financial operations;
- certificate sale;
- day close;
- payroll mark-paid;
- employee changes;
- destructive operations;
- settings/system writes;
- legacy financial write attempts;
- опасные functions routes.

Используется централизованный `loggingService`.

Поведение при ошибках логирования:

- Ошибка AuditLog не должна ломать бизнес-операцию.
- Техническая ошибка уходит в `ErrorEvent` / `console.error`.

Оставшиеся ограничения:

- Нет отдельного AuditLog UI/API для просмотра журнала.
- Read-only события намеренно не логируются массово, чтобы не создавать шум.
- Формат AuditLog стал более последовательным, но исторические записи могут отличаться.

## 5. Validation / Error Hardening

Добавлены backend guards для ключевых финансовых чисел и закрыта утечка raw 500 errors.

Проверки non-negative добавлены/закреплены для:

- `ClientPackage.remainingVisits`
- `ClientPackage.price`
- `Certificate.remainingBalance`
- `Certificate.nominal`
- `DayCloseRecord.total`
- `DayCloseRecord.cash`
- `DayCloseRecord.card`
- `DayCloseRecord.blik`
- `DayCloseRecord.packages`
- `DayCloseRecord.certificates`
- `Visit.amount`
- `Visit.paidAmount`
- `Visit.discount`
- `Visit.debt`
- `Visit.tip`
- `Visit.extra`
- `Visit.certificateAmountUsed`
- `PayrollRecord.amount`
- `PayrollRecord.report.totals.totalPayout`

Error handling:

- `getHttpErrorResponse` теперь не отдаёт raw technical `error.message` наружу для unexpected 500.
- Validation/user-input errors могут возвращать понятные сообщения.
- Unexpected backend errors возвращают generic response, а техническая информация остаётся в server logs / ErrorEvent.

Оставшиеся риски:

- Некоторые старые CRUD routes всё ещё используют простое `Number(req.params.id)`.
- Даты в legacy paths местами парсятся через `new Date`.
- Общий CRUD остаётся широким и требует дальнейшего phased hardening.

## 6. Backup / Restore

Добавлен документ `BACKUP_RESTORE_STRATEGY.md`.

Сделано:

- Описана стратегия backup/export/restore для PostgreSQL/Prisma.
- Добавлен безопасный backup script на базе `pg_dump`.
- Добавлен npm script `db:backup`.
- Добавлены безопасные placeholders для env без секретов.
- Backup/dump файлы исключены из git.
- Restore оставлен ручным checklist-процессом, без автоматического destructive restore.

Что нужно автоматизировать позже:

- Scheduled encrypted backups.
- Offsite backup storage.
- Регулярный restore drill.
- Мониторинг свежести backup.

## 7. Performance

Сделан performance/chunk audit и безопасный cleanup.

Результат:

- `xlsx` вынесен в dynamic import.
- Неключевые страницы lazy-loaded через `React.lazy` / `Suspense`:
  - `TodayPage`
  - `ServicesPage`
  - `PackagesPage`
  - `EmployeesPage`
  - `MessageTemplatesPage`
  - `ImportPage`
  - `SitePage`
- Основной `index` chunk уменьшился примерно с `501 kB` до `399 kB`.
- Vite warning `chunk > 500 kB` снят.

Оставшиеся performance risks:

- `App.jsx` всё ещё большой.
- CSS/vendor chunks требуют отдельного анализа.
- Дальше безопасно выносить тяжёлые modal/page sections и постепенно дробить App state wiring.

## 8. Созданные Audit / Checklist Docs

Созданы и/или обновлены документы:

- `FINANCE_LEGACY_AUDIT.md`
- `AUTH_PERMISSIONS_AUDIT.md`
- `AUDIT_LOG_AUDIT.md`
- `FUNCTIONS_ROUTES_AUDIT.md`
- `VALIDATION_ERROR_HANDLING_AUDIT.md`
- `BACKUP_RESTORE_STRATEGY.md`
- `MANUAL_FINANCE_TEST_CHECKLIST.md`
- `UI_REGRESSION_CHECKLIST.md`
- `PERFORMANCE_CHUNK_AUDIT.md`
- `PRODUCTION_READINESS_CHECKLIST.md`
- `FINAL_NUAR_CRM_AUDIT_REPORT.md`

Ручные проверки:

- `MANUAL_FINANCE_TEST_CHECKLIST.md` покрывает critical finance scenarios, включая ordinary/package/certificate/mixed, revert/delete/update, journal-only, certificate sale, package sale, day close, payroll, RBAC и backup checks.
- `UI_REGRESSION_CHECKLIST.md` покрывает основные экраны CRM и desktop/tablet/mobile smoke.
- `PRODUCTION_READINESS_CHECKLIST.md` фиксирует deploy gates, smoke checks, rollback и Go / No-Go criteria.

## 9. Оставшиеся риски

Перед production deploy остаются контролируемые риски:

- Нет granular RBAC; любой authenticated non-owner route всё ещё даёт широкие operational возможности.
- AuditLog не имеет полноценного UI/API для просмотра и расследований.
- Legacy generic CRUD остаётся широким, хотя критичные финансовые legacy writes guarded.
- Package sale не имеет отдельной transaction sale endpoint, потому что текущая схема не даёт безопасной связи package sale с payment record без риска double-counting.
- Backup restore drill должен быть выполнен вручную до доверия к disaster recovery.
- App state остаётся крупным и чувствительным к regression после transaction endpoint updates.
- Исторические данные/legacy visits без ledger могут требовать ручной обработки в старых сценариях.
- Production Supabase policies/RLS и Vercel env должны быть проверены отдельно.

## 10. Что проверить перед deploy

Минимальный pre-deploy gate:

1. Проверить env variables:
   - backend database/auth env;
   - Supabase/Vite env;
   - admin credentials;
   - production URL/CORS settings.

2. Сделать backup production DB перед deploy.

3. Прогнать automated checks:
   - `npm test`
   - `npm run build`
   - `cd backend && npx prisma validate`
   - `node --check backend/server.js`
   - `node --check backend/routes/crud.js`
   - `node --check backend/routes/auth.js`
   - `node --check backend/routes/functions.js`

4. Проверить migrations/deploy state:
   - Prisma schema валидна;
   - production DB содержит нужные migrations;
   - нет pending destructive migration.

5. Выполнить staged production smoke:
   - login owner;
   - ordinary completed visit;
   - package completed visit;
   - certificate completed visit;
   - mixed package+certificate completed visit;
   - revert completed visit;
   - delete completed CalendarEntry;
   - update completed visit;
   - journal-only package/certificate edit/delete;
   - certificate sale;
   - package sale;
   - day close;
   - payroll summary;
   - payroll mark-paid;
   - legacy financial CRUD guard;
   - owner guard checks;
   - AuditLog/ErrorEvent checks;
   - refresh-state checks after transaction endpoints.

6. Проверить logs:
   - backend errors;
   - Prisma errors;
   - auth failures;
   - AuditLog write failures;
   - ErrorEvent entries.

7. Rollback readiness:
   - previous deploy available;
   - DB backup available;
   - restore procedure reviewed;
   - owner credentials verified.

## 11. Итоговый статус

Итог: **ready for staged production smoke**.

Кодовая база прошла phased hardening по finance transaction flow, RBAC, AuditLog, validation/error handling, backup/restore documentation и performance chunk cleanup. Следующий шаг не должен быть новым рефакторингом: сначала staged production smoke по `PRODUCTION_READINESS_CHECKLIST.md`, `MANUAL_FINANCE_TEST_CHECKLIST.md` и `UI_REGRESSION_CHECKLIST.md`.
