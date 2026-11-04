const express = require('express');
const path = require('path');
const {PrismaClient} = require('@prisma/client');
const {requirePermission, PERMISSIONS} = require('../middleware/auth');
const {buildAuditLogWhere, parseAuditLogQuery} = require('../domain/auditLogQuery');
const {recordErrorEvent, redactSensitiveData} = require('../services/loggingService');
const {normalizeClientErrorReport} = require('../domain/clientErrorReport');
const {clientErrorLimiter} = require('../middleware/rateLimiter');
const {getWorkerStatus} = require('../services/notificationWorker');
const {getBackupTopologyStatus} = require('../services/backupService');
const {getDataRetentionStatus} = require('../services/dataRetentionService');
const {checkDataIntegrity} = require('../services/dataIntegrityService');
const {getDataIntegrityWorkerStatus} = require('../services/dataIntegrityWorker');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/client-errors', clientErrorLimiter, async (req, res, next) => {
  try {
    const report = normalizeClientErrorReport(req.body, req.auth);
    if (!report) {
      return res.status(422).json({error: 'message is required'});
    }

    await recordErrorEvent(prisma, report);

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.get('/audit-logs', requirePermission(PERMISSIONS.LOGS_VIEW), async (req, res, next) => {
  try {
    const filters = parseAuditLogQuery(req.query);
    const records = await prisma.auditLog.findMany({
      where: buildAuditLogWhere(filters),
      orderBy: {id: 'desc'},
      take: filters.limit + 1,
    });
    const hasMore = records.length > filters.limit;
    const items = records.slice(0, filters.limit);
    const numericActorIds = [...new Set(items
      .map((item) => Number(item.actorId))
      .filter((id) => Number.isInteger(id) && id > 0))];
    const users = numericActorIds.length
      ? await prisma.user.findMany({
          where: {id: {in: numericActorIds}},
          select: {email: true, id: true, name: true},
        })
      : [];
    const usersById = new Map(users.map((user) => [String(user.id), user]));

    res.json({
      items: items.map((item) => ({
        ...item,
        actor: usersById.get(String(item.actorId)) || null,
      })),
      nextCursor: hasMore ? String(items.at(-1)?.id || '') : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/error-events/summary', requirePermission(PERMISSIONS.LOGS_VIEW), async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [errorCount24h, warningCount24h, pendingDeliveries, retryingDeliveries, failedDeliveries24h, recent] = await Promise.all([
      prisma.errorEvent.count({where: {createdAt: {gte: since}, severity: 'error'}}),
      prisma.errorEvent.count({where: {createdAt: {gte: since}, severity: 'warning'}}),
      prisma.notificationDelivery.count({where: {status: 'pending'}}),
      prisma.notificationDelivery.count({where: {status: 'retrying'}}),
      prisma.notificationDelivery.count({where: {status: 'failed', updatedAt: {gte: since}}}),
      prisma.errorEvent.findMany({
        orderBy: {id: 'desc'},
        select: {context: true, createdAt: true, id: true, message: true, severity: true, source: true, stack: true},
        take: 12,
      }),
    ]);

    res.json({
      counts: {errorCount24h, failedDeliveries24h, pendingDeliveries, retryingDeliveries, warningCount24h},
      recent: recent.map((event) => ({
        ...event,
        context: redactSensitiveData(event.context),
        stack: redactSensitiveData(event.stack),
      })),
      retention: getDataRetentionStatus(),
      worker: getWorkerStatus(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/backup/status', requirePermission(PERMISSIONS.LOGS_VIEW), (_req, res, next) => {
  try {
    const backupDir = path.resolve(__dirname, '..', process.env.BACKUP_DIR || 'backups');
    const staleAfterHours = Math.max(1, Number(process.env.BACKUP_STALE_AFTER_HOURS) || 30);
    const restoreDrillStaleAfterDays = Math.max(1, Number(process.env.RESTORE_DRILL_STALE_AFTER_DAYS) || 35);
    const status = getBackupTopologyStatus(backupDir, {
      mirrorDir: process.env.BACKUP_MIRROR_DIR,
      restoreDrillStaleAfterDays,
      staleAfterHours,
    });
    res.json({
      ...status,
      latest: status.latest ? {...status.latest, name: undefined} : null,
      mirror: status.mirror?.latest
        ? {...status.mirror, latest: {...status.mirror.latest, name: undefined}}
        : status.mirror,
      restoreDrill: status.restoreDrill?.available
        ? {...status.restoreDrill, databaseName: undefined}
        : status.restoreDrill,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/data-integrity/status', requirePermission(PERMISSIONS.LOGS_VIEW), async (_req, res, next) => {
  try {
    res.json({...await checkDataIntegrity(prisma), automation: getDataIntegrityWorkerStatus()});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
