const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { upsertNotificationEvent } = require('../services/notificationEventsService');
const {
  earnForCompletedVisit,
  getActorUserId,
  reverseEarnForVisit,
} = require('../services/loyaltyService');
const {
  VISIT_WITH_EARNING_INCLUDE,
  assertVisitCanBeRemoved,
  removeUnpaidEmployeeEarningForVisit,
  serializeVisitWithEarning,
  syncEmployeeEarningForCompletedVisit,
} = require('../services/employeeEarningsService');
const {
  respond,
  respondWithAudit,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  getRouteId,
  withStoredId,
  validationError,
  sendValidationError,
  assertNonNegative,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

// ----- Calendar event handler for notification generation -----
const handleCalendarEntryChange = async (before, after, _action, _req) => {
  try {
    const kind = before?.kind || after?.kind;
    if (kind !== 'visit') return;

    const id = before?.id || after?.id;
    const beforePayload = before?.payload && typeof before.payload === 'object' ? before.payload : {};
    const afterPayload = after?.payload && typeof after.payload === 'object' ? after.payload : {};

    const clientName = afterPayload.client || afterPayload.clientName || beforePayload.client || beforePayload.clientName || 'Клиент';
    const serviceName = afterPayload.service || afterPayload.serviceName || beforePayload.service || beforePayload.serviceName || 'Услуга';
    const masterName = afterPayload.master || afterPayload.masterName || beforePayload.master || beforePayload.masterName || 'Мастер';
    const clientId = afterPayload.clientId || beforePayload.clientId || null;

    const isDeleted = !after;
    const isCancelledStatus = after && ['cancelled', 'no_show'].includes(after.status) && !['cancelled', 'no_show'].includes(before?.status);

    if (isDeleted || isCancelledStatus) {
      const date = before?.date || '';
      const time = before?.time || '';
      
      await upsertNotificationEvent(prisma, {
        clientId: clientId ? Number(clientId) : null,
        clientName,
        entityId: String(id),
        entityType: 'calendar_entry',
        fingerprint: `visit:${id}:cancelled`,
        payload: { date, time, clientName, serviceName, masterName },
        priority: 'high',
        recommendedAction: 'open_calendar',
        source: 'visit-tracker',
        title: 'Запись отменена',
        message: `${clientName} · ${serviceName} · ${date} ${time} · Мастер: ${masterName}`,
        type: 'visit_cancelled',
        urgency: 15,
      });
      return;
    }

    if (before && after) {
      const dateChanged = before.date !== after.date;
      const timeChanged = before.time !== after.time;

      if (dateChanged || timeChanged) {
        await upsertNotificationEvent(prisma, {
          clientId: clientId ? Number(clientId) : null,
          clientName,
          entityId: String(id),
          entityType: 'calendar_entry',
          fingerprint: `visit:${id}:rescheduled:${after.date}:${after.time}`,
          payload: {
            oldDate: before.date,
            oldTime: before.time,
            newDate: after.date,
            newTime: after.time,
            clientName,
            serviceName,
            masterName,
          },
          priority: 'normal',
          recommendedAction: 'open_calendar',
          source: 'visit-tracker',
          title: 'Запись перенесена',
          message: `${clientName} · Было: ${before.date} ${before.time} · Стало: ${after.date} ${after.time}`,
          type: 'visit_rescheduled',
          urgency: 10,
        });
      }
    }
  } catch (error) {
    console.error('Failed to handle calendar entry change for notifications:', error);
  }
};

// Wrapper that passes handleCalendarEntryChange callback
const localRespondWithAudit = (req, res, promise, audit) => {
  return respondWithAudit(prisma, req, res, promise, audit, handleCalendarEntryChange);
};

const localAuditCreate = (req, res, promise, entity, action) =>
  localRespondWithAudit(req, res, promise, { action, entity });

const localAuditUpdate = async (req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await prisma[model].findUnique({ where: { id } }) : null;
  localRespondWithAudit(req, res, promise, { action, before, entity, entityId: id });
};

// ----- Visit local helpers -----
const buildCalendarEntryData = (payload) => ({
  kind: cleanOptionalString(payload?.kind),
  date: cleanOptionalString(payload?.date),
  time: cleanOptionalString(payload?.time),
  status: cleanOptionalString(payload?.status),
  visitId: payload?.visitId ? Number(payload.visitId) : null,
  payload,
});

const toDateTime = (date, time) => {
  if (!date) return null;
  const value = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const buildVisitData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  serviceId: payload?.serviceId ? Number(payload.serviceId) : null,
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  scheduledAt: toDateTime(payload?.inputDate || payload?.date, payload?.time),
  notes: cleanOptionalString(payload?.note),
  calendarEntryId: payload?.calendarEntryId ? Number(payload.calendarEntryId) : null,
  recordType: cleanOptionalString(payload?.recordType),
  payload,
});

const validateVisitPayload = (payload) => {
  assertNonNegative(payload?.amount, 'amount');
  assertNonNegative(payload?.paidAmount, 'paidAmount');
  assertNonNegative(payload?.discount, 'discount');
  assertNonNegative(payload?.debt, 'debt');
  assertNonNegative(payload?.tip, 'tip');
  assertNonNegative(payload?.extra, 'extra');
  assertNonNegative(payload?.certificateAmountUsed, 'certificateAmountUsed');
};

const normalizedPaymentName = (payload) =>
  String(payload?.payment ?? '').trim().toLowerCase();

const isPackageCompletePayment = (payload) => {
  const payment = normalizedPaymentName(payload);
  return (
    Boolean(payload?.packageUsageId) ||
    Number(payload?.packageSessionsUsed) > 0 ||
    payment.includes('пакет') ||
    payment.includes('pakiet') ||
    payment.includes('package')
  );
};

const isCertificateCompletePayment = (payload) => {
  const payment = normalizedPaymentName(payload);
  return (
    Boolean(payload?.certificateUsageId) ||
    Number(payload?.certificateAmountUsed) > 0 ||
    payment.includes('сертификат') ||
    payment.includes('certyfikat') ||
    payment.includes('certificate')
  );
};

const resolveClientPackageStatus = (remainingVisits, currentStatus) => {
  if (Number(remainingVisits) <= 0) {
    return 'Архив';
  }
  return ['Архив', 'Закончился'].includes(String(currentStatus ?? ''))
    ? 'Активен'
    : currentStatus;
};

const resolveCertificateStatus = (remainingBalance, nominal, currentStatus) => {
  const remaining = Number(remainingBalance) || 0;
  const total = Number(nominal) || 0;

  if (remaining <= 0) {
    return 'Погашен';
  }
  if (remaining < total) {
    return 'Частично';
  }
  return ['Архив', 'Погашен', 'Просрочен'].includes(String(currentStatus ?? ''))
    ? 'Активен'
    : currentStatus;
};


// ==================== Visit state used by the CRM UI ====================
router.get('/visit-state', async (req, res) => {
  try {
    const [calendarEntries, visits] = await Promise.all([
      prisma.calendarEntry.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
      prisma.visit.findMany({
        include: VISIT_WITH_EARNING_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        calendarEntries: calendarEntries.map(withStoredId),
        visits: visits.map(serializeVisitWithEarning),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Visit state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/calendar-entries', (req, res) => {
  const payload = req.body ?? {};
  localAuditCreate(
    req,
    res,
    prisma.calendarEntry
      .create({ data: buildCalendarEntryData(payload) })
      .then(withStoredId),
    'CalendarEntry',
    payload.kind === 'visit' ? 'create visit' : 'create calendar entry',
  );
});

router.put('/calendar-entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = { ...(req.body ?? {}), id };
  localAuditUpdate(
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry
      .update({ where: { id }, data: buildCalendarEntryData(payload) })
      .then(withStoredId),
    'CalendarEntry',
    payload.kind === 'visit' ? 'update visit' : 'update calendar entry',
  );
});

router.delete('/calendar-entries/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry.delete({ where: { id } }).then(withStoredId),
    'CalendarEntry',
    'delete/cancel visit',
  );
});

router.post('/calendar-entries/delete-completed', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const calendarEntryId = Number(body.calendarEntryId);
  const requestedVisitId = body.visitId ? Number(body.visitId) : null;

  if (!Number.isFinite(calendarEntryId) || calendarEntryId <= 0) {
    return sendValidationError(res, validationError('calendarEntryId is required'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.findUnique({
        where: { id: calendarEntryId },
      });

      if (!calendarEntry) {
        return {
          deletedCalendarEntryId: calendarEntryId,
          deletedVisitId: Number.isFinite(requestedVisitId) ? requestedVisitId : null,
          idempotent: true,
          restoredCertificates: [],
          restoredCertificateUsages: [],
          restoredClientPackages: [],
          restoredPackageUsages: [],
        };
      }

      if (calendarEntry.status !== 'completed') {
        throw validationError('Only completed calendar entries can be deleted by this endpoint');
      }

      let visit = null;

      if (Number.isFinite(requestedVisitId) && requestedVisitId > 0) {
        visit = await tx.visit.findUnique({ where: { id: requestedVisitId } });

        if (visit && Number(visit.calendarEntryId) !== calendarEntryId) {
          throw validationError('Visit does not belong to calendar entry');
        }
      }

      if (!visit && calendarEntry.visitId) {
        visit = await tx.visit.findUnique({ where: { id: calendarEntry.visitId } });
      }

      if (!visit) {
        visit = await tx.visit.findFirst({
          where: { calendarEntryId },
          orderBy: { id: 'asc' },
        });
      }

      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      if (visit) {
        await assertVisitCanBeRemoved(tx, visit.id);

        const packageUsages = await tx.clientPackageUsage.findMany({
          where: { visitId: visit.id },
        });
        const certificateUsages = await tx.certificateUsage.findMany({
          where: { visitId: visit.id },
        });
        const usesPackage = isPackageCompletePayment(visit.payload) || packageUsages.length > 0;
        const usesCertificate =
          isCertificateCompletePayment(visit.payload) || certificateUsages.length > 0;
        const activePackageUsages = packageUsages.filter((item) => !item.revertedAt);
        const activeCertificateUsages = certificateUsages.filter((item) => !item.revertedAt);

        if (usesPackage && packageUsages.length === 0) {
          throw validationError('Legacy package delete is not supported yet');
        }

        if (usesCertificate && certificateUsages.length === 0) {
          throw validationError('Legacy certificate delete is not supported yet');
        }

        if (usesPackage && usesCertificate) {
          if (packageUsages.length === 0 || certificateUsages.length === 0) {
            throw validationError('Incomplete mixed visit ledger state');
          }

          if (activePackageUsages.length !== activeCertificateUsages.length) {
            throw validationError('Incomplete mixed visit ledger state');
          }
        }

        for (const usage of activePackageUsages) {
          const packageBefore = await tx.clientPackage.findUnique({
            where: { id: usage.clientPackageId },
          });

          if (!packageBefore) {
            throw validationError('Client package not found');
          }

          const packagePayload =
            packageBefore.payload && typeof packageBefore.payload === 'object'
              ? packageBefore.payload
              : {};
          const sessionsUsed = Math.max(1, Number(usage.sessionsUsed) || 1);
          const currentRemaining = Number(packageBefore.remainingVisits) || 0;
          const totalVisits =
            Number(packageBefore.totalVisits) || Number(packagePayload.totalVisits) || 0;
          const nextRemaining = totalVisits > 0
            ? Math.min(totalVisits, currentRemaining + sessionsUsed)
            : currentRemaining + sessionsUsed;
          const nextStatus = resolveClientPackageStatus(
            nextRemaining,
            packagePayload.status ?? packageBefore.status,
          );
          const writeOffHistory = Array.isArray(packageBefore.writeOffHistory)
            ? packageBefore.writeOffHistory
            : Array.isArray(packagePayload.writeOffHistory)
              ? packagePayload.writeOffHistory
              : [];
          const nextWriteOffHistory = writeOffHistory.filter(
            (item) => String(item?.visitId ?? '') !== String(visit.id),
          );
          const restoredPackage = await tx.clientPackage.update({
            where: { id: usage.clientPackageId },
            data: {
              remainingVisits: nextRemaining,
              status: nextStatus,
              writeOffHistory: nextWriteOffHistory,
              payload: {
                ...packagePayload,
                remainingVisits: nextRemaining,
                status: nextStatus,
                writeOffHistory: nextWriteOffHistory,
              },
            },
          });
          const restoredUsage = await tx.clientPackageUsage.update({
            where: { id: usage.id },
            data: { revertedAt: new Date() },
          });

          restoredClientPackages = [...restoredClientPackages, restoredPackage];
          restoredPackageUsages = [...restoredPackageUsages, restoredUsage];

          await recordAuditLog(tx, req, {
            action: 'restore package',
            after: {
              clientPackage: withStoredId(restoredPackage),
              clientPackageUsage: withStoredId(restoredUsage),
            },
            before: withStoredId(packageBefore),
            entity: 'ClientPackage',
            entityId: restoredPackage.id,
          });
        }

        for (const usage of activeCertificateUsages) {
          const certificateBefore = await tx.certificate.findUnique({
            where: { id: usage.certificateId },
          });

          if (!certificateBefore) {
            throw validationError('Certificate not found');
          }

          const certificatePayload =
            certificateBefore.payload && typeof certificateBefore.payload === 'object'
              ? certificateBefore.payload
              : {};
          const amount = Number(usage.amount) || 0;
          const currentBalance = Number(certificateBefore.remainingBalance) || 0;
          const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
          const nextBalance = nominal > 0
            ? Math.min(nominal, currentBalance + amount)
            : currentBalance + amount;
          const nextStatus = resolveCertificateStatus(
            nextBalance,
            nominal,
            certificatePayload.status ?? certificateBefore.status,
          );
          const nextUsedDate = nextBalance <= 0 ? certificateBefore.usedDate : '';
          const restoredCertificate = await tx.certificate.update({
            where: { id: usage.certificateId },
            data: {
              remainingBalance: nextBalance,
              status: nextStatus,
              usedDate: nextUsedDate,
              payload: {
                ...certificatePayload,
                remainingBalance: nextBalance,
                status: nextStatus,
                usedDate: nextUsedDate,
              },
            },
          });
          const restoredUsage = await tx.certificateUsage.update({
            where: { id: usage.id },
            data: { revertedAt: new Date() },
          });

          restoredCertificates = [...restoredCertificates, restoredCertificate];
          restoredCertificateUsages = [...restoredCertificateUsages, restoredUsage];

          await recordAuditLog(tx, req, {
            action: 'restore certificate',
            after: {
              certificate: withStoredId(restoredCertificate),
              certificateUsage: withStoredId(restoredUsage),
            },
            before: withStoredId(certificateBefore),
            entity: 'Certificate',
            entityId: restoredCertificate.id,
          });
        }

        await reverseEarnForVisit(tx, visit, {
          createdById: getActorUserId(req),
          description: 'Откат начисления после удаления завершённого визита',
        });

        await removeUnpaidEmployeeEarningForVisit(tx, req, visit.id);
        await tx.visit.delete({ where: { id: visit.id } });
      }

      const deletedCalendarEntry = await tx.calendarEntry.delete({
        where: { id: calendarEntryId },
      });
      const data = {
        deletedCalendarEntryId: deletedCalendarEntry.id,
        deletedVisitId: visit?.id ?? null,
        idempotent: false,
        restoredCertificates: restoredCertificates.map(withStoredId),
        restoredCertificateUsages: restoredCertificateUsages.map(withStoredId),
        restoredClientPackages: restoredClientPackages.map(withStoredId),
        restoredPackageUsages: restoredPackageUsages.map(withStoredId),
      };

      await recordAuditLog(tx, req, {
        action: 'delete completed calendar entry',
        after: data,
        before: {
          calendarEntry: withStoredId(calendarEntry),
          visit: visit ? withStoredId(visit) : null,
        },
        entity: 'CalendarEntry',
        entityId: deletedCalendarEntry.id,
      });

      return data;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete completed calendar entry error:', err);
    await recordErrorEvent(prisma, {
      context: {
        calendarEntryId,
        path: req.originalUrl,
        visitId: requestedVisitId,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/visits/complete', async (req, res) => {
  const body = req.body ?? {};
  const calendarEntryId = Number(body.calendarEntryId ?? body.visit?.calendarEntryId);
  const completedAt = body.completedAt ?? body.calendarEntryPatch?.completedAt ?? new Date().toISOString();
  const visitPayload = {
    ...(body.visit ?? body),
    calendarEntryId,
    status: 'completed',
  };
  const usesPackage = isPackageCompletePayment(visitPayload);
  const usesCertificate = isCertificateCompletePayment(visitPayload);
  const usesMixedPackageCertificate = usesPackage && usesCertificate;
  const clientPackageId = Number(visitPayload.packageUsageId);
  const packageSessionsUsed = Number(visitPayload.packageSessionsUsed) || (usesPackage ? 1 : 0);
  const certificateId = Number(visitPayload.certificateUsageId);
  const certificateAmountUsed = Number(visitPayload.certificateAmountUsed) || 0;

  if (!Number.isFinite(calendarEntryId) || calendarEntryId <= 0) {
    return sendValidationError(res, validationError('calendarEntryId is required'));
  }

  try {
    validateVisitPayload(visitPayload);

    if (usesPackage) {
      if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) {
        throw validationError('packageUsageId is required for package payment');
      }

      if (!Number.isInteger(packageSessionsUsed) || packageSessionsUsed <= 0) {
        throw validationError('packageSessionsUsed must be a positive integer');
      }
    }

    if (usesCertificate) {
      if (!Number.isFinite(certificateId) || certificateId <= 0) {
        throw validationError('certificateUsageId is required for certificate payment');
      }

      if (!(certificateAmountUsed > 0)) {
        throw validationError('certificateAmountUsed must be greater than 0');
      }
    }

    if (usesMixedPackageCertificate) {
      if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) {
        throw validationError('packageUsageId is required for mixed payment');
      }

      if (!Number.isInteger(packageSessionsUsed) || packageSessionsUsed <= 0) {
        throw validationError('packageSessionsUsed must be a positive integer for mixed payment');
      }

      if (!Number.isFinite(certificateId) || certificateId <= 0) {
        throw validationError('certificateUsageId is required for mixed payment');
      }

      if (!(certificateAmountUsed > 0)) {
        throw validationError('certificateAmountUsed must be greater than 0 for mixed payment');
      }
    }
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.findUnique({
        where: { id: calendarEntryId },
      });

      if (!calendarEntry) {
        const error = new Error('Calendar entry not found');
        error.status = 404;
        throw error;
      }

      if (calendarEntry.status === 'completed' && calendarEntry.visitId) {
        const existingCompletedVisit = await tx.visit.findUnique({
          where: { id: calendarEntry.visitId },
        });

        if (existingCompletedVisit) {
          await syncEmployeeEarningForCompletedVisit(tx, req, existingCompletedVisit);
          const visitWithEarning = await tx.visit.findUnique({
            where: { id: existingCompletedVisit.id },
            include: VISIT_WITH_EARNING_INCLUDE,
          });
          let clientPackage = null;
          let clientPackageUsage = null;
          let certificate = null;
          let certificateUsage = null;

          if (usesPackage) {
            clientPackageUsage = await tx.clientPackageUsage.findUnique({
              where: {
                clientPackageId_visitId: {
                  clientPackageId,
                  visitId: existingCompletedVisit.id,
                },
              },
            });
            clientPackage = await tx.clientPackage.findUnique({
              where: { id: clientPackageId },
            });
          }

          if (usesCertificate) {
            certificateUsage = await tx.certificateUsage.findUnique({
              where: {
                certificateId_visitId: {
                  certificateId,
                  visitId: existingCompletedVisit.id,
                },
              },
            });
            certificate = await tx.certificate.findUnique({
              where: { id: certificateId },
            });
          }

          if (usesMixedPackageCertificate) {
            const hasActivePackageUsage = Boolean(clientPackageUsage && !clientPackageUsage.revertedAt);
            const hasActiveCertificateUsage = Boolean(certificateUsage && !certificateUsage.revertedAt);

            if (hasActivePackageUsage !== hasActiveCertificateUsage) {
              throw validationError('Incomplete mixed visit ledger state');
            }

            if (!hasActivePackageUsage || !hasActiveCertificateUsage) {
              throw validationError('Mixed visit ledger state is missing');
            }
          }

          return {
            calendarEntry: withStoredId(calendarEntry),
            certificate: certificate ? withStoredId(certificate) : null,
            certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
            clientPackage: clientPackage ? withStoredId(clientPackage) : null,
            clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
            idempotent: true,
            visit: serializeVisitWithEarning(visitWithEarning),
          };
        }
      }

      const existingVisit = await tx.visit.findFirst({
        where: { calendarEntryId },
        orderBy: { id: 'asc' },
      });
      const visit = existingVisit ?? await tx.visit.create({
        data: buildVisitData(visitPayload),
      });
      let clientPackage = null;
      let clientPackageUsage = null;
      let clientPackageBefore;
      let certificate = null;
      let certificateUsage = null;
      let certificateBefore;

      if (usesMixedPackageCertificate) {
        const existingPackageUsage = await tx.clientPackageUsage.findUnique({
          where: {
            clientPackageId_visitId: {
              clientPackageId,
              visitId: visit.id,
            },
          },
        });
        const existingCertificateUsage = await tx.certificateUsage.findUnique({
          where: {
            certificateId_visitId: {
              certificateId,
              visitId: visit.id,
            },
          },
        });
        const hasActivePackageUsage = Boolean(existingPackageUsage && !existingPackageUsage.revertedAt);
        const hasActiveCertificateUsage = Boolean(
          existingCertificateUsage && !existingCertificateUsage.revertedAt,
        );

        if (hasActivePackageUsage !== hasActiveCertificateUsage) {
          throw validationError('Incomplete mixed visit ledger state');
        }
      }

      if (usesPackage) {
        const existingUsage = await tx.clientPackageUsage.findUnique({
          where: {
            clientPackageId_visitId: {
              clientPackageId,
              visitId: visit.id,
            },
          },
        });

        if (existingUsage) {
          clientPackageUsage = existingUsage;
          clientPackage = await tx.clientPackage.findUnique({
            where: { id: clientPackageId },
          });
        }

        const shouldApplyPackageUsage =
          !clientPackageUsage || Boolean(clientPackageUsage.revertedAt);

        if (shouldApplyPackageUsage) {
          clientPackageBefore = await tx.clientPackage.findUnique({
            where: { id: clientPackageId },
          });

          if (!clientPackageBefore) {
            throw validationError('Client package not found');
          }

          const packagePayload =
            clientPackageBefore.payload && typeof clientPackageBefore.payload === 'object'
              ? clientPackageBefore.payload
              : {};
          const currentRemaining = Number(clientPackageBefore.remainingVisits) || 0;

          if (currentRemaining < packageSessionsUsed) {
            throw validationError('Client package does not have enough remaining visits');
          }

          const nextRemaining = currentRemaining - packageSessionsUsed;
          const nextStatus = resolveClientPackageStatus(
            nextRemaining,
            packagePayload.status ?? clientPackageBefore.status,
          );
          const writeOffHistory = Array.isArray(clientPackageBefore.writeOffHistory)
            ? clientPackageBefore.writeOffHistory
            : Array.isArray(packagePayload.writeOffHistory)
              ? packagePayload.writeOffHistory
              : [];
          const nextWriteOffHistory = [
            ...writeOffHistory,
            {
              sessionsUsed: packageSessionsUsed,
              usedAt: new Date().toISOString(),
              visitId: visit.id,
            },
          ];
          const updated = await tx.clientPackage.updateMany({
            where: {
              id: clientPackageId,
              remainingVisits: { gte: packageSessionsUsed },
            },
            data: {
              remainingVisits: { decrement: packageSessionsUsed },
              status: nextStatus,
              writeOffHistory: nextWriteOffHistory,
              payload: {
                ...packagePayload,
                remainingVisits: nextRemaining,
                status: nextStatus,
                writeOffHistory: nextWriteOffHistory,
              },
            },
          });

          if (updated.count !== 1) {
            throw validationError('Client package does not have enough remaining visits');
          }

          clientPackageUsage = clientPackageUsage
            ? await tx.clientPackageUsage.update({
                where: { id: clientPackageUsage.id },
                data: {
                  sessionsUsed: packageSessionsUsed,
                  payload: {
                    calendarEntryId,
                  },
                  revertedAt: null,
                },
              })
            : await tx.clientPackageUsage.create({
                data: {
                  clientPackageId,
                  visitId: visit.id,
                  sessionsUsed: packageSessionsUsed,
                  payload: {
                    calendarEntryId,
                  },
                },
              });
          clientPackage = await tx.clientPackage.findUnique({
            where: { id: clientPackageId },
          });
        }
      }

      if (usesCertificate) {
        const existingUsage = await tx.certificateUsage.findUnique({
          where: {
            certificateId_visitId: {
              certificateId,
              visitId: visit.id,
            },
          },
        });

        if (existingUsage) {
          certificateUsage = existingUsage;
          certificate = await tx.certificate.findUnique({
            where: { id: certificateId },
          });
        }

        const shouldApplyCertificateUsage =
          !certificateUsage || Boolean(certificateUsage.revertedAt);

        if (shouldApplyCertificateUsage) {
          certificateBefore = await tx.certificate.findUnique({
            where: { id: certificateId },
          });

          if (!certificateBefore) {
            throw validationError('Certificate not found');
          }

          const certificatePayload =
            certificateBefore.payload && typeof certificateBefore.payload === 'object'
              ? certificateBefore.payload
              : {};
          const currentBalance = Number(certificateBefore.remainingBalance) || 0;

          if (currentBalance < certificateAmountUsed) {
            throw validationError('Certificate does not have enough remaining balance');
          }

          const nextBalance = currentBalance - certificateAmountUsed;
          const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
          const nextStatus = resolveCertificateStatus(
            nextBalance,
            nominal,
            certificatePayload.status ?? certificateBefore.status,
          );
          const nextUsedDate =
            nextBalance <= 0
              ? visitPayload.date || certificateBefore.usedDate
              : certificateBefore.usedDate;
          const updated = await tx.certificate.updateMany({
            where: {
              id: certificateId,
              remainingBalance: { gte: certificateAmountUsed },
            },
            data: {
              remainingBalance: { decrement: certificateAmountUsed },
              status: nextStatus,
              usedDate: nextUsedDate,
              payload: {
                ...certificatePayload,
                remainingBalance: nextBalance,
                status: nextStatus,
                usedDate: nextUsedDate,
              },
            },
          });

          if (updated.count !== 1) {
            throw validationError('Certificate does not have enough remaining balance');
          }

          certificateUsage = certificateUsage
            ? await tx.certificateUsage.update({
                where: { id: certificateUsage.id },
                data: {
                  amount: certificateAmountUsed,
                  payload: {
                    calendarEntryId,
                  },
                  revertedAt: null,
                },
              })
            : await tx.certificateUsage.create({
                data: {
                  amount: certificateAmountUsed,
                  certificateId,
                  visitId: visit.id,
                  payload: {
                    calendarEntryId,
                  },
                },
              });
          certificate = await tx.certificate.findUnique({
            where: { id: certificateId },
          });
        }
      }

      const calendarPayload =
        calendarEntry.payload && typeof calendarEntry.payload === 'object'
          ? calendarEntry.payload
          : {};
      const persistedVisit = existingVisit
        ? await tx.visit.update({
            where: { id: visit.id },
            data: buildVisitData({ ...visitPayload, id: visit.id }),
          })
        : visit;
      await syncEmployeeEarningForCompletedVisit(tx, req, persistedVisit);
      const visitWithEarning = await tx.visit.findUnique({
        where: { id: persistedVisit.id },
        include: VISIT_WITH_EARNING_INCLUDE,
      });
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: { id: calendarEntryId },
        data: buildCalendarEntryData({
          ...calendarPayload,
          completedAt,
          status: 'completed',
          visitId: persistedVisit.id,
        }),
      });
      const loyalty = await earnForCompletedVisit(tx, persistedVisit, {
        createdById: getActorUserId(req),
      });
      const data = {
        calendarEntry: withStoredId(updatedCalendarEntry),
        certificate: certificate ? withStoredId(certificate) : null,
        certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
        clientPackage: clientPackage ? withStoredId(clientPackage) : null,
        clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
        idempotent: false,
        loyalty: {
          earned: Boolean(loyalty?.earned),
          reason: loyalty?.reason ?? null,
          transactionId: loyalty?.transaction?.id ?? null,
        },
        visit: serializeVisitWithEarning(visitWithEarning),
      };

      await recordAuditLog(tx, req, {
        action: 'complete calendar entry',
        after: data,
        before: {
          calendarEntry: withStoredId(calendarEntry),
        visit: existingVisit ? withStoredId(existingVisit) : null,
      },
        entity: 'CalendarEntry',
        entityId: updatedCalendarEntry.id,
      });

      return data;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Complete calendar entry error:', err);
    await recordErrorEvent(prisma, {
      context: {
        calendarEntryId,
        path: req.originalUrl,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/visits/update-completed', async (req, res) => {
  const body = req.body ?? {};
  const visitId = Number(body.visitId ?? body.visit?.id);
  const calendarEntryId = Number(body.calendarEntryId ?? body.visit?.calendarEntryId);
  const calendarEntryPatch = body.calendarEntry ?? body.calendarEntryPatch ?? {};
  const visitPayload = {
    ...(body.visit ?? body),
    calendarEntryId,
    id: visitId,
    status: 'completed',
  };
  const newUsesPackage =
    isPackageCompletePayment(visitPayload) || isPackageCompletePayment(calendarEntryPatch);
  const newUsesCertificate =
    isCertificateCompletePayment(visitPayload) || isCertificateCompletePayment(calendarEntryPatch);
  const newUsesMixedPackageCertificate = newUsesPackage && newUsesCertificate;
  const clientPackageId = Number(visitPayload.packageUsageId);
  const packageSessionsUsed = Number(visitPayload.packageSessionsUsed) || (newUsesPackage ? 1 : 0);
  const certificateId = Number(visitPayload.certificateUsageId);
  const certificateAmountUsed = Number(visitPayload.certificateAmountUsed) || 0;

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return sendValidationError(res, validationError('visitId is required'));
  }

  if (!Number.isFinite(calendarEntryId) || calendarEntryId <= 0) {
    return sendValidationError(res, validationError('calendarEntryId is required'));
  }

  try {
    validateVisitPayload(visitPayload);

    if (newUsesPackage) {
      if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) {
        throw validationError('packageUsageId is required for package payment');
      }

      if (!Number.isInteger(packageSessionsUsed) || packageSessionsUsed <= 0) {
        throw validationError('packageSessionsUsed must be a positive integer');
      }
    }

    if (newUsesCertificate) {
      if (!Number.isFinite(certificateId) || certificateId <= 0) {
        throw validationError('certificateUsageId is required for certificate payment');
      }

      if (!(certificateAmountUsed > 0)) {
        throw validationError('certificateAmountUsed must be greater than 0');
      }
    }

    if (newUsesMixedPackageCertificate) {
      if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) {
        throw validationError('packageUsageId is required for mixed payment');
      }

      if (!Number.isInteger(packageSessionsUsed) || packageSessionsUsed <= 0) {
        throw validationError('packageSessionsUsed must be a positive integer for mixed payment');
      }

      if (!Number.isFinite(certificateId) || certificateId <= 0) {
        throw validationError('certificateUsageId is required for mixed payment');
      }

      if (!(certificateAmountUsed > 0)) {
        throw validationError('certificateAmountUsed must be greater than 0 for mixed payment');
      }
    }
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [visit, calendarEntry] = await Promise.all([
        tx.visit.findUnique({ where: { id: visitId } }),
        tx.calendarEntry.findUnique({ where: { id: calendarEntryId } }),
      ]);

      if (!visit) {
        const error = new Error('Visit not found');
        error.status = 404;
        throw error;
      }

      if (!calendarEntry) {
        const error = new Error('Calendar entry not found');
        error.status = 404;
        throw error;
      }

      if (calendarEntry.status !== 'completed') {
        throw validationError('Only completed calendar entries can be updated by this endpoint');
      }

      if (Number(visit.calendarEntryId) !== calendarEntryId) {
        throw validationError('Visit does not belong to calendar entry');
      }

      if (calendarEntry.visitId && Number(calendarEntry.visitId) !== visitId) {
        throw validationError('Calendar entry belongs to another visit');
      }

      const [packageUsages, certificateUsages] = await Promise.all([
        tx.clientPackageUsage.findMany({ where: { visitId } }),
        tx.certificateUsage.findMany({ where: { visitId } }),
      ]);
      const activePackageUsages = packageUsages.filter((item) => !item.revertedAt);
      const activeCertificateUsages = certificateUsages.filter((item) => !item.revertedAt);
      const oldPayloadUsesPackage = isPackageCompletePayment(visit.payload);
      const oldPayloadUsesCertificate = isCertificateCompletePayment(visit.payload);
      const oldUsesPackage = oldPayloadUsesPackage || activePackageUsages.length > 0;
      const oldUsesCertificate =
        oldPayloadUsesCertificate || activeCertificateUsages.length > 0;
      const oldUsesMixedPackageCertificate = oldUsesPackage && oldUsesCertificate;

      if (oldPayloadUsesPackage && activePackageUsages.length === 0) {
        throw validationError('Legacy package completed visit update is not supported yet');
      }

      if (oldPayloadUsesCertificate && activeCertificateUsages.length === 0) {
        throw validationError('Legacy certificate completed visit update is not supported yet');
      }

      if (oldUsesMixedPackageCertificate) {
        if (packageUsages.length === 0 || certificateUsages.length === 0) {
          throw validationError('Incomplete mixed visit ledger state');
        }

        if (activePackageUsages.length !== activeCertificateUsages.length) {
          throw validationError('Incomplete mixed visit ledger state');
        }
      }

      let clientPackage = null;
      let clientPackageUsage = null;
      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let certificate = null;
      let certificateUsage = null;
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      for (const usage of activePackageUsages) {
        const packageBefore = await tx.clientPackage.findUnique({
          where: { id: usage.clientPackageId },
        });

        if (!packageBefore) {
          throw validationError('Client package not found');
        }

        const packagePayload =
          packageBefore.payload && typeof packageBefore.payload === 'object'
            ? packageBefore.payload
            : {};
        const sessionsUsed = Math.max(1, Number(usage.sessionsUsed) || 1);
        const currentRemaining = Number(packageBefore.remainingVisits) || 0;
        const totalVisits =
          Number(packageBefore.totalVisits) || Number(packagePayload.totalVisits) || 0;
        const nextRemaining = totalVisits > 0
          ? Math.min(totalVisits, currentRemaining + sessionsUsed)
          : currentRemaining + sessionsUsed;
        const nextStatus = resolveClientPackageStatus(
          nextRemaining,
          packagePayload.status ?? packageBefore.status,
        );
        const writeOffHistory = Array.isArray(packageBefore.writeOffHistory)
          ? packageBefore.writeOffHistory
          : Array.isArray(packagePayload.writeOffHistory)
            ? packagePayload.writeOffHistory
            : [];
        const nextWriteOffHistory = writeOffHistory.filter(
          (item) => String(item?.visitId ?? '') !== String(visit.id),
        );
        const restoredPackage = await tx.clientPackage.update({
          where: { id: usage.clientPackageId },
          data: {
            remainingVisits: nextRemaining,
            status: nextStatus,
            writeOffHistory: nextWriteOffHistory,
            payload: {
              ...packagePayload,
              remainingVisits: nextRemaining,
              status: nextStatus,
              writeOffHistory: nextWriteOffHistory,
            },
          },
        });
        const restoredUsage = await tx.clientPackageUsage.update({
          where: { id: usage.id },
          data: { revertedAt: new Date() },
        });

        restoredClientPackages = [...restoredClientPackages, restoredPackage];
        restoredPackageUsages = [...restoredPackageUsages, restoredUsage];

        await recordAuditLog(tx, req, {
          action: 'restore package',
          after: {
            clientPackage: withStoredId(restoredPackage),
            clientPackageUsage: withStoredId(restoredUsage),
          },
          before: withStoredId(packageBefore),
          entity: 'ClientPackage',
          entityId: restoredPackage.id,
        });
      }

      if (newUsesPackage) {
        const existingUsage = await tx.clientPackageUsage.findUnique({
          where: {
            clientPackageId_visitId: {
              clientPackageId,
              visitId,
            },
          },
        });
        const clientPackageBefore = await tx.clientPackage.findUnique({
          where: { id: clientPackageId },
        });

        if (!clientPackageBefore) {
          throw validationError('Client package not found');
        }

        const packagePayload =
          clientPackageBefore.payload && typeof clientPackageBefore.payload === 'object'
            ? clientPackageBefore.payload
            : {};
        const currentRemaining = Number(clientPackageBefore.remainingVisits) || 0;

        if (currentRemaining < packageSessionsUsed) {
          throw validationError('Client package does not have enough remaining visits');
        }

        const nextRemaining = currentRemaining - packageSessionsUsed;
        const nextStatus = resolveClientPackageStatus(
          nextRemaining,
          packagePayload.status ?? clientPackageBefore.status,
        );
        const writeOffHistory = Array.isArray(clientPackageBefore.writeOffHistory)
          ? clientPackageBefore.writeOffHistory
          : Array.isArray(packagePayload.writeOffHistory)
            ? packagePayload.writeOffHistory
            : [];
        const nextWriteOffHistory = [
          ...writeOffHistory.filter((item) => String(item?.visitId ?? '') !== String(visit.id)),
          {
            sessionsUsed: packageSessionsUsed,
            usedAt: new Date().toISOString(),
            visitId,
          },
        ];
        const updated = await tx.clientPackage.updateMany({
          where: {
            id: clientPackageId,
            remainingVisits: { gte: packageSessionsUsed },
          },
          data: {
            remainingVisits: { decrement: packageSessionsUsed },
            status: nextStatus,
            writeOffHistory: nextWriteOffHistory,
            payload: {
              ...packagePayload,
              remainingVisits: nextRemaining,
              status: nextStatus,
              writeOffHistory: nextWriteOffHistory,
            },
          },
        });

        if (updated.count !== 1) {
          throw validationError('Client package does not have enough remaining visits');
        }

        clientPackageUsage = existingUsage
          ? await tx.clientPackageUsage.update({
              where: { id: existingUsage.id },
              data: {
                payload: {
                  calendarEntryId,
                  reason: 'update-completed',
                },
                revertedAt: null,
                sessionsUsed: packageSessionsUsed,
              },
            })
          : await tx.clientPackageUsage.create({
              data: {
                clientPackageId,
                payload: {
                  calendarEntryId,
                  reason: 'update-completed',
                },
                sessionsUsed: packageSessionsUsed,
                visitId,
              },
            });
        clientPackage = await tx.clientPackage.findUnique({
          where: { id: clientPackageId },
        });

        await recordAuditLog(tx, req, {
          action: 'use package',
          after: {
            clientPackage: clientPackage ? withStoredId(clientPackage) : null,
            clientPackageUsage: withStoredId(clientPackageUsage),
          },
          before: withStoredId(clientPackageBefore),
          entity: 'ClientPackage',
          entityId: clientPackageId,
        });
      }

      for (const usage of activeCertificateUsages) {
        const certificateBefore = await tx.certificate.findUnique({
          where: { id: usage.certificateId },
        });

        if (!certificateBefore) {
          throw validationError('Certificate not found');
        }

        const certificatePayload =
          certificateBefore.payload && typeof certificateBefore.payload === 'object'
            ? certificateBefore.payload
            : {};
        const amount = Number(usage.amount) || 0;
        const currentBalance = Number(certificateBefore.remainingBalance) || 0;
        const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
        const nextBalance = nominal > 0
          ? Math.min(nominal, currentBalance + amount)
          : currentBalance + amount;
        const nextStatus = resolveCertificateStatus(
          nextBalance,
          nominal,
          certificatePayload.status ?? certificateBefore.status,
        );
        const nextUsedDate = nextBalance <= 0 ? certificateBefore.usedDate : '';
        const restoredCertificate = await tx.certificate.update({
          where: { id: usage.certificateId },
          data: {
            remainingBalance: nextBalance,
            status: nextStatus,
            usedDate: nextUsedDate,
            payload: {
              ...certificatePayload,
              remainingBalance: nextBalance,
              status: nextStatus,
              usedDate: nextUsedDate,
            },
          },
        });
        const restoredUsage = await tx.certificateUsage.update({
          where: { id: usage.id },
          data: { revertedAt: new Date() },
        });

        restoredCertificates = [...restoredCertificates, restoredCertificate];
        restoredCertificateUsages = [...restoredCertificateUsages, restoredUsage];

        await recordAuditLog(tx, req, {
          action: 'restore certificate',
          after: {
            certificate: withStoredId(restoredCertificate),
            certificateUsage: withStoredId(restoredUsage),
          },
          before: withStoredId(certificateBefore),
          entity: 'Certificate',
          entityId: restoredCertificate.id,
        });
      }

      if (newUsesCertificate) {
        const existingUsage = await tx.certificateUsage.findUnique({
          where: {
            certificateId_visitId: {
              certificateId,
              visitId,
            },
          },
        });
        const certificateBefore = await tx.certificate.findUnique({
          where: { id: certificateId },
        });

        if (!certificateBefore) {
          throw validationError('Certificate not found');
        }

        const certificatePayload =
          certificateBefore.payload && typeof certificateBefore.payload === 'object'
            ? certificateBefore.payload
            : {};
        const currentBalance = Number(certificateBefore.remainingBalance) || 0;

        if (currentBalance < certificateAmountUsed) {
          throw validationError('Certificate does not have enough remaining balance');
        }

        const nextBalance = currentBalance - certificateAmountUsed;
        const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
        const nextStatus = resolveCertificateStatus(
          nextBalance,
          nominal,
          certificatePayload.status ?? certificateBefore.status,
        );
        const nextUsedDate =
          nextBalance <= 0
            ? visitPayload.date || certificateBefore.usedDate
            : certificateBefore.usedDate;
        const updated = await tx.certificate.updateMany({
          where: {
            id: certificateId,
            remainingBalance: { gte: certificateAmountUsed },
          },
          data: {
            remainingBalance: { decrement: certificateAmountUsed },
            status: nextStatus,
            usedDate: nextUsedDate,
            payload: {
              ...certificatePayload,
              remainingBalance: nextBalance,
              status: nextStatus,
              usedDate: nextUsedDate,
            },
          },
        });

        if (updated.count !== 1) {
          throw validationError('Certificate does not have enough remaining balance');
        }

        certificateUsage = existingUsage
          ? await tx.certificateUsage.update({
              where: { id: existingUsage.id },
              data: {
                amount: certificateAmountUsed,
                payload: {
                  calendarEntryId,
                  reason: 'update-completed',
                },
                revertedAt: null,
              },
            })
          : await tx.certificateUsage.create({
              data: {
                amount: certificateAmountUsed,
                certificateId,
                payload: {
                  calendarEntryId,
                  reason: 'update-completed',
                },
                visitId,
              },
            });
        certificate = await tx.certificate.findUnique({
          where: { id: certificateId },
        });

        await recordAuditLog(tx, req, {
          action: 'use certificate',
          after: {
            certificate: certificate ? withStoredId(certificate) : null,
            certificateUsage: withStoredId(certificateUsage),
          },
          before: withStoredId(certificateBefore),
          entity: 'Certificate',
          entityId: certificateId,
        });
      }

      const calendarPayload =
        calendarEntry.payload && typeof calendarEntry.payload === 'object'
          ? calendarEntry.payload
          : {};
      const updatedVisit = await tx.visit.update({
        where: { id: visitId },
        data: buildVisitData(visitPayload),
      });
      await syncEmployeeEarningForCompletedVisit(tx, req, updatedVisit);
      const visitWithEarning = await tx.visit.findUnique({
        where: { id: visitId },
        include: VISIT_WITH_EARNING_INCLUDE,
      });
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: { id: calendarEntryId },
        data: buildCalendarEntryData({
          ...calendarPayload,
          ...calendarEntryPatch,
          status: 'completed',
          visitId,
        }),
      });
      const data = {
        calendarEntry: withStoredId(updatedCalendarEntry),
        certificate: certificate ? withStoredId(certificate) : null,
        certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
        clientPackage: clientPackage ? withStoredId(clientPackage) : null,
        clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
        restoredCertificates: restoredCertificates.map(withStoredId),
        restoredCertificateUsages: restoredCertificateUsages.map(withStoredId),
        restoredClientPackages: restoredClientPackages.map(withStoredId),
        restoredPackageUsages: restoredPackageUsages.map(withStoredId),
        visit: serializeVisitWithEarning(visitWithEarning),
      };

      await recordAuditLog(tx, req, {
        action: 'update completed visit',
        after: data,
        before: {
          calendarEntry: withStoredId(calendarEntry),
          visit: withStoredId(visit),
        },
        entity: 'Visit',
        entityId: updatedVisit.id,
      });

      return data;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Update completed visit error:', err);
    await recordErrorEvent(prisma, {
      context: {
        calendarEntryId,
        path: req.originalUrl,
        visitId,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/visits/revert-completed', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const calendarEntryId = Number(body.calendarEntryId);
  const requestedVisitId = body.visitId ? Number(body.visitId) : null;

  if (!Number.isFinite(calendarEntryId) || calendarEntryId <= 0) {
    return sendValidationError(res, validationError('calendarEntryId is required'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.findUnique({
        where: { id: calendarEntryId },
      });

      if (!calendarEntry) {
        const error = new Error('Calendar entry not found');
        error.status = 404;
        throw error;
      }

      if (calendarEntry.status !== 'completed' && !calendarEntry.visitId) {
        return {
          calendarEntry: withStoredId(calendarEntry),
          deletedVisitId: null,
          idempotent: true,
          restoredCertificates: [],
          restoredCertificateUsages: [],
          restoredClientPackages: [],
          restoredPackageUsages: [],
        };
      }

      let visit = null;

      if (Number.isFinite(requestedVisitId) && requestedVisitId > 0) {
        visit = await tx.visit.findUnique({ where: { id: requestedVisitId } });
      }

      if (!visit && calendarEntry.visitId) {
        visit = await tx.visit.findUnique({ where: { id: calendarEntry.visitId } });
      }

      if (!visit) {
        visit = await tx.visit.findFirst({
          where: { calendarEntryId },
          orderBy: { id: 'asc' },
        });
      }

      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      if (visit) {
        const packageUsages = await tx.clientPackageUsage.findMany({
          where: { visitId: visit.id },
        });
        const certificateUsages = await tx.certificateUsage.findMany({
          where: { visitId: visit.id },
        });
        const usesPackage = isPackageCompletePayment(visit.payload) || packageUsages.length > 0;
        const usesCertificate =
          isCertificateCompletePayment(visit.payload) || certificateUsages.length > 0;
        const activePackageUsages = packageUsages.filter((item) => !item.revertedAt);
        const activeCertificateUsages = certificateUsages.filter((item) => !item.revertedAt);

        if (usesPackage && packageUsages.length === 0) {
          throw validationError('Legacy package revert is not supported yet');
        }

        if (usesCertificate && certificateUsages.length === 0) {
          throw validationError('Legacy certificate revert is not supported yet');
        }

        if (usesPackage && usesCertificate) {
          if (packageUsages.length === 0 || certificateUsages.length === 0) {
            throw validationError('Incomplete mixed visit ledger state');
          }

          if (activePackageUsages.length !== activeCertificateUsages.length) {
            throw validationError('Incomplete mixed visit ledger state');
          }
        }

        for (const usage of activePackageUsages) {
          const packageBefore = await tx.clientPackage.findUnique({
            where: { id: usage.clientPackageId },
          });

          if (!packageBefore) {
            throw validationError('Client package not found');
          }

          const packagePayload =
            packageBefore.payload && typeof packageBefore.payload === 'object'
              ? packageBefore.payload
              : {};
          const sessionsUsed = Math.max(1, Number(usage.sessionsUsed) || 1);
          const currentRemaining = Number(packageBefore.remainingVisits) || 0;
          const totalVisits =
            Number(packageBefore.totalVisits) || Number(packagePayload.totalVisits) || 0;
          const nextRemaining = totalVisits > 0
            ? Math.min(totalVisits, currentRemaining + sessionsUsed)
            : currentRemaining + sessionsUsed;
          const nextStatus = resolveClientPackageStatus(
            nextRemaining,
            packagePayload.status ?? packageBefore.status,
          );
          const writeOffHistory = Array.isArray(packageBefore.writeOffHistory)
            ? packageBefore.writeOffHistory
            : Array.isArray(packagePayload.writeOffHistory)
              ? packagePayload.writeOffHistory
              : [];
          const nextWriteOffHistory = writeOffHistory.filter(
            (item) => String(item?.visitId ?? '') !== String(visit.id),
          );
          const restoredPackage = await tx.clientPackage.update({
            where: { id: usage.clientPackageId },
            data: {
              remainingVisits: nextRemaining,
              status: nextStatus,
              writeOffHistory: nextWriteOffHistory,
              payload: {
                ...packagePayload,
                remainingVisits: nextRemaining,
                status: nextStatus,
                writeOffHistory: nextWriteOffHistory,
              },
            },
          });
          const restoredUsage = await tx.clientPackageUsage.update({
            where: { id: usage.id },
            data: { revertedAt: new Date() },
          });

          restoredClientPackages = [...restoredClientPackages, restoredPackage];
          restoredPackageUsages = [...restoredPackageUsages, restoredUsage];

          await recordAuditLog(tx, req, {
            action: 'restore package',
            after: {
              clientPackage: withStoredId(restoredPackage),
              clientPackageUsage: withStoredId(restoredUsage),
            },
            before: withStoredId(packageBefore),
            entity: 'ClientPackage',
            entityId: restoredPackage.id,
          });
        }

        for (const usage of activeCertificateUsages) {
          const certificateBefore = await tx.certificate.findUnique({
            where: { id: usage.certificateId },
          });

          if (!certificateBefore) {
            throw validationError('Certificate not found');
          }

          const certificatePayload =
            certificateBefore.payload && typeof certificateBefore.payload === 'object'
              ? certificateBefore.payload
              : {};
          const amount = Number(usage.amount) || 0;
          const currentBalance = Number(certificateBefore.remainingBalance) || 0;
          const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
          const nextBalance = nominal > 0
            ? Math.min(nominal, currentBalance + amount)
            : currentBalance + amount;
          const nextStatus = resolveCertificateStatus(
            nextBalance,
            nominal,
            certificatePayload.status ?? certificateBefore.status,
          );
          const nextUsedDate = nextBalance <= 0 ? certificateBefore.usedDate : '';
          const restoredCertificate = await tx.certificate.update({
            where: { id: usage.certificateId },
            data: {
              remainingBalance: nextBalance,
              status: nextStatus,
              usedDate: nextUsedDate,
              payload: {
                ...certificatePayload,
                remainingBalance: nextBalance,
                status: nextStatus,
                usedDate: nextUsedDate,
              },
            },
          });
          const restoredUsage = await tx.certificateUsage.update({
            where: { id: usage.id },
            data: { revertedAt: new Date() },
          });

          restoredCertificates = [...restoredCertificates, restoredCertificate];
          restoredCertificateUsages = [...restoredCertificateUsages, restoredUsage];

          await recordAuditLog(tx, req, {
            action: 'restore certificate',
            after: {
              certificate: withStoredId(restoredCertificate),
              certificateUsage: withStoredId(restoredUsage),
            },
            before: withStoredId(certificateBefore),
            entity: 'Certificate',
            entityId: restoredCertificate.id,
          });
        }

        await reverseEarnForVisit(tx, visit, {
          createdById: getActorUserId(req),
          description: 'Откат начисления после возврата завершённого визита',
        });

        await removeUnpaidEmployeeEarningForVisit(tx, req, visit.id);
        await tx.visit.delete({ where: { id: visit.id } });
      }

      const calendarPayload =
        calendarEntry.payload && typeof calendarEntry.payload === 'object'
          ? calendarEntry.payload
          : {};
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: { id: calendarEntryId },
        data: buildCalendarEntryData({
          ...calendarPayload,
          completedAt: '',
          status: 'scheduled',
          visitId: '',
        }),
      });
      const data = {
        calendarEntry: withStoredId(updatedCalendarEntry),
        deletedVisitId: visit?.id ?? null,
        idempotent: false,
        restoredCertificates: restoredCertificates.map(withStoredId),
        restoredCertificateUsages: restoredCertificateUsages.map(withStoredId),
        restoredClientPackages: restoredClientPackages.map(withStoredId),
        restoredPackageUsages: restoredPackageUsages.map(withStoredId),
      };

      await recordAuditLog(tx, req, {
        action: 'revert completed visit',
        after: data,
        before: visit ? withStoredId(visit) : null,
        entity: 'Visit',
        entityId: visit?.id ?? null,
      });

      return data;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Revert completed visit error:', err);
    await recordErrorEvent(prisma, {
      context: {
        calendarEntryId,
        path: req.originalUrl,
        visitId: requestedVisitId,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// ==================== Basic CRUD Visit Routes ====================
router.post('/visits', (req, res) => {
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  auditCreate(
    prisma,
    req,
    res,
    prisma.visit.create({
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
    }),
    'Visit',
    'create visit',
  );
});

router.get('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.findUnique({ where: { id } }));
});

router.put('/visits/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  await auditUpdate(
    prisma,
    req,
    res,
    'visit',
    id,
    prisma.visit.update({
      where: { id },
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        notes,
      },
    }),
    'Visit',
    'update visit',
  );
});

router.delete('/visits/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.visit.findUnique({ where: { id } });
      await assertVisitCanBeRemoved(tx, id);
      await removeUnpaidEmployeeEarningForVisit(tx, req, id);
      const deleted = await tx.visit.delete({ where: { id } });
      await recordAuditLog(tx, req, {
        action: 'delete/cancel visit',
        after: null,
        before: before ? withStoredId(before) : null,
        entity: 'Visit',
        entityId: id,
      });
      return deleted;
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete visit error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/visits', (req, res) => {
  respond(res, prisma.visit.findMany());
});

module.exports = router;
