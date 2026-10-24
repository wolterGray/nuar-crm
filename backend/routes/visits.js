const express = require('express');
const router = express.Router();
const { Prisma, PrismaClient } = require('@prisma/client');
const { requireOwner, requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const { maskEmail, maskPhoneNumber } = require('../constants/permissions');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { upsertNotificationEvent } = require('../services/notificationEventsService');
const {recordBusinessNotificationEvent} = require('../services/businessPushService');
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
  applyClientPackageUsage: applyPackageLedgerUsage,
  restoreClientPackageUsage: restorePackageLedgerUsage,
} = require('../services/packageLedgerService');
const {
  respondWithAudit,
  auditCreate,
  auditUpdate,
  cleanOptionalString,
  getRouteId,
  withStoredId,
  validationError,
  sendValidationError,
  assertNonNegative,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();
const {recordBelongsToEmployee, resolveScopedEmployee} = require('../utils/employeeScope');

const resolveEmployeeIdForRecord = async (record) => {
  const payload = record?.payload && typeof record.payload === 'object' ? record.payload : {};
  const directId = Number(record?.employeeId ?? payload.employeeId ?? payload.masterId);
  if (Number.isInteger(directId) && directId > 0) return directId;
  const masterName = String(payload.master ?? payload.masterName ?? record?.master ?? '').trim();
  if (!masterName) return null;
  const employees = await prisma.employee.findMany({select: {id: true, name: true}});
  return employees.find((employee) =>
    employee.name.localeCompare(masterName, undefined, {sensitivity: 'base'}) === 0
  )?.id ?? null;
};

const runSerializableTransaction = async (callback, attempts = 3) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (error?.code !== 'P2034' || attempt === attempts) {
        throw error;
      }
    }
  }

  throw lastError;
};

// ----- Calendar event handler for notification generation -----
const handleCalendarEntryChange = async (before, after, _action, _req) => {
  try {
    const kind = before?.kind || after?.kind;
    if (kind !== 'visit') return;

    const id = before?.id || after?.id;
    const beforePayload = before?.payload && typeof before.payload === 'object' ? before.payload : {};
    const afterPayload = after?.payload && typeof after.payload === 'object' ? after.payload : {};

    const clientId = afterPayload.clientId || beforePayload.clientId || null;
    const serviceId = afterPayload.serviceId || beforePayload.serviceId || null;
    const [linkedClient, linkedService] = await Promise.all([
      clientId ? prisma.client.findUnique({where: {id: Number(clientId)}, select: {name: true}}) : null,
      serviceId ? prisma.service.findUnique({where: {id: Number(serviceId)}, select: {name: true}}) : null,
    ]);
    const clientName = afterPayload.client || afterPayload.clientName || beforePayload.client || beforePayload.clientName || linkedClient?.name || 'Клиент';
    const serviceName = afterPayload.service || afterPayload.serviceName || beforePayload.service || beforePayload.serviceName || linkedService?.name || 'Услуга';
    const masterName = afterPayload.master || afterPayload.masterName || beforePayload.master || beforePayload.masterName || 'Мастер';
    const employeeId = await resolveEmployeeIdForRecord(after || before);

    const isDeleted = !after;
    const cancelledStatuses = ['cancelled', 'canceled', 'no_show'];
    const isCancelledStatus = after && cancelledStatuses.includes(after.status) && !cancelledStatuses.includes(before?.status);

    if (isDeleted || isCancelledStatus) {
      const date = before?.date || '';
      const time = before?.time || '';
      
      await recordBusinessNotificationEvent(prisma, {
        clientId: clientId ? Number(clientId) : null,
        clientName,
        entityId: String(id),
        entityType: 'calendar_entry',
        fingerprint: `visit:${id}:cancelled`,
        payload: { date, time, clientName, deleted: isDeleted, employeeId, serviceName, masterName },
        priority: 'high',
        recommendedAction: 'open_calendar',
        source: 'visit-tracker',
        title: 'Запись отменена',
        message: `${clientName} · ${serviceName} · ${date} ${time} · Мастер: ${masterName}`,
        type: 'visit_cancelled',
        urgency: 15,
      }, upsertNotificationEvent);
      return;
    }

    if (!before && after && !['cancelled', 'canceled', 'no_show'].includes(after.status)) {
      await recordBusinessNotificationEvent(prisma, {
        clientId: clientId ? Number(clientId) : null,
        clientName,
        entityId: String(id),
        entityType: 'calendar_entry',
        fingerprint: `visit:${id}:created`,
        payload: {date: after.date, time: after.time, clientName, employeeId, serviceName, masterName},
        priority: 'normal',
        recommendedAction: 'open_calendar',
        source: 'visit-tracker',
        title: 'Новая запись',
        message: `${clientName} · ${serviceName} · ${after.date || ''} ${after.time || ''}`,
        type: 'visit_created',
        urgency: 10,
      }, upsertNotificationEvent);
      return;
    }

    if (before && after) {
      const dateChanged = before.date !== after.date;
      const timeChanged = before.time !== after.time;

      if (dateChanged || timeChanged) {
        await recordBusinessNotificationEvent(prisma, {
          clientId: clientId ? Number(clientId) : null,
          clientName,
          entityId: String(id),
          entityType: 'calendar_entry',
          fingerprint: `visit:${id}:rescheduled:${before.date}:${before.time}:${after.date}:${after.time}`,
          payload: {
            oldDate: before.date,
            oldTime: before.time,
            newDate: after.date,
            newTime: after.time,
            clientName,
            employeeId,
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
        }, upsertNotificationEvent);
      }
    }
  } catch (error) {
    console.error('Failed to handle calendar entry change for notifications:', error);
  }
};

const toWarsawDateTime = (value) => {
  if (!value) return {date: '', time: ''};
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return {date: '', time: ''};
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    day: '2-digit', hour: '2-digit', hour12: false, minute: '2-digit', month: '2-digit',
    timeZone: 'Europe/Warsaw', year: 'numeric',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
};

const handleVisitChange = async (before, after) => {
  try {
    const visit = after || before;
    if (!visit) return;
    const [service, client] = await Promise.all([
      visit.serviceId ? prisma.service.findUnique({where: {id: visit.serviceId}}) : null,
      visit.clientId ? prisma.client.findUnique({where: {id: visit.clientId}}) : null,
    ]);
    const visitPayload = visit.payload && typeof visit.payload === 'object' ? visit.payload : {};
    const clientName = client?.name || visitPayload.clientName || visitPayload.client || 'Клиент';
    const current = toWarsawDateTime(after?.scheduledAt || before?.scheduledAt);
    const previous = toWarsawDateTime(before?.scheduledAt);
    const employeeId = await resolveEmployeeIdForRecord(visit);
    const common = {
      entityId: String(visit.id), entityType: 'visit', priority: 'normal',
      recommendedAction: 'open_calendar', source: 'visit-tracker',
    };
    if (!after) {
      await recordBusinessNotificationEvent(prisma, {
        ...common, fingerprint: `visit-record:${visit.id}:cancelled`,
        clientName,
        payload: {...previous, clientName, deleted: true, employeeId, serviceName: service?.name || ''},
        priority: 'high', title: 'Запись отменена', message: service?.name || 'Запись отменена',
        type: 'visit_cancelled', urgency: 15,
      }, upsertNotificationEvent);
      return;
    }
    if (!before) {
      await recordBusinessNotificationEvent(prisma, {
        ...common, fingerprint: `visit-record:${visit.id}:created`,
        clientName,
        payload: {...current, clientName, employeeId, serviceName: service?.name || ''}, title: 'Новая запись',
        message: service?.name || 'Новая запись', type: 'visit_created', urgency: 10,
      }, upsertNotificationEvent);
      return;
    }
    if (before.scheduledAt?.getTime() !== after.scheduledAt?.getTime()) {
      await recordBusinessNotificationEvent(prisma, {
        ...common,
        fingerprint: `visit-record:${visit.id}:rescheduled:${previous.date}:${previous.time}:${current.date}:${current.time}`,
        clientName,
        payload: {clientName, employeeId, newDate: current.date, newTime: current.time, oldDate: previous.date, oldTime: previous.time, serviceName: service?.name || ''},
        title: 'Запись перенесена', message: service?.name || 'Запись перенесена',
        type: 'visit_rescheduled', urgency: 10,
      }, upsertNotificationEvent);
    }
  } catch (error) {
    console.error('Failed to handle visit change for notifications:', error);
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

const restorePackageUsageForVisit = async (tx, req, visit, usage) => {
  if (!usage || usage.revertedAt) return null;

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
  const totalVisits = Number(packageBefore.totalVisits) || Number(packagePayload.totalVisits) || 0;
  const nextRemaining =
    totalVisits > 0
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

  await recordAuditLog(tx, req, {
    action: 'restore duplicate package usage',
    after: {
      clientPackage: withStoredId(restoredPackage),
      clientPackageUsage: withStoredId(restoredUsage),
    },
    before: withStoredId(packageBefore),
    entity: 'ClientPackage',
    entityId: restoredPackage.id,
  });

  return { restoredPackage, restoredUsage };
};

const restoreCertificateUsageForVisit = async (tx, req, visit, usage) => {
  if (!usage || usage.revertedAt) return null;

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
  const nextBalance =
    nominal > 0 ? Math.min(nominal, currentBalance + amount) : currentBalance + amount;
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

  await recordAuditLog(tx, req, {
    action: 'restore duplicate certificate usage',
    after: {
      certificate: withStoredId(restoredCertificate),
      certificateUsage: withStoredId(restoredUsage),
    },
    before: withStoredId(certificateBefore),
    entity: 'Certificate',
    entityId: restoredCertificate.id,
  });

  return { restoredCertificate, restoredUsage };
};

const removeDuplicateCalendarVisit = async (tx, req, visit) => {
  await assertVisitCanBeRemoved(tx, visit.id);

  const [packageUsages, certificateUsages] = await Promise.all([
    tx.clientPackageUsage.findMany({ where: { visitId: visit.id } }),
    tx.certificateUsage.findMany({ where: { visitId: visit.id } }),
  ]);
  const restoredPackages = [];
  const restoredCertificates = [];

  for (const usage of packageUsages) {
    const restored = await restorePackageUsageForVisit(tx, req, visit, usage);
    if (restored) restoredPackages.push(restored);
  }

  for (const usage of certificateUsages) {
    const restored = await restoreCertificateUsageForVisit(tx, req, visit, usage);
    if (restored) restoredCertificates.push(restored);
  }

  await reverseEarnForVisit(tx, visit, {
    createdById: getActorUserId(req),
    description: 'Откат начисления дубля завершённого визита',
  });
  await removeUnpaidEmployeeEarningForVisit(tx, req, visit.id);
  const deleted = await tx.visit.delete({ where: { id: visit.id } });

  await recordAuditLog(tx, req, {
    action: 'delete duplicate completed visit',
    after: null,
    before: withStoredId(visit),
    entity: 'Visit',
    entityId: deleted.id,
  });

  return {
    deletedVisitId: deleted.id,
    restoredCertificateUsageIds: restoredCertificates.map((item) => item.restoredUsage.id),
    restoredPackageUsageIds: restoredPackages.map((item) => item.restoredUsage.id),
  };
};


const sanitizeCalendarEntry = (entry, canViewContacts) => {
  const base = withStoredId(entry);
  if (canViewContacts) return base;

  const rawPayload = base.payload && typeof base.payload === 'object' ? base.payload : {};
  const sanitizedPayload = {
    ...rawPayload,
    phone: maskPhoneNumber(rawPayload.phone),
    clientPhone: maskPhoneNumber(rawPayload.clientPhone),
    email: maskEmail(rawPayload.email),
  };

  return {
    ...base,
    payload: sanitizedPayload,
  };
};

const sanitizeCoworkerCalendarEntry = (entry) => {
  const base = withStoredId(entry);
  const payload = base.payload && typeof base.payload === 'object' ? base.payload : {};
  const service = payload.service || payload.serviceName || base.service || 'Занято';
  const master = payload.master || payload.masterName || payload.employeeName || base.master || 'Сотрудник';
  const safePayload = {
    color: payload.color || base.color || null,
    duration: Number(payload.duration || base.duration) || 60,
    master,
    service,
  };
  return {
    id: base.id,
    kind: base.kind,
    date: base.date,
    time: base.time,
    status: base.status,
    color: safePayload.color,
    duration: safePayload.duration,
    master,
    service,
    client: 'Занято',
    restricted: true,
    payload: safePayload,
  };
};

const sanitizeVisit = (visit, { canViewContacts, canViewAllPayouts, canViewOwnPayouts, userEmployeeId }) => {
  const base = serializeVisitWithEarning(visit);
  const rawPayload = base.payload && typeof base.payload === 'object' ? base.payload : {};

  // 1. Sanitize contacts
  const sanitizedPayload = canViewContacts
    ? rawPayload
    : {
        ...rawPayload,
        phone: maskPhoneNumber(rawPayload.phone),
        clientPhone: maskPhoneNumber(rawPayload.clientPhone),
        email: maskEmail(rawPayload.email),
      };

  // 2. Scoped earnings
  let sanitizedEarning = null;
  let sanitizedEarnings = [];

  if (canViewAllPayouts) {
    sanitizedEarning = base.earning;
    sanitizedEarnings = Array.isArray(base.employeeEarnings) ? base.employeeEarnings : [];
  } else if (canViewOwnPayouts && userEmployeeId) {
    if (base.earning && Number(base.earning.employeeId) === userEmployeeId) {
      sanitizedEarning = base.earning;
    }
    if (Array.isArray(base.employeeEarnings)) {
      sanitizedEarnings = base.employeeEarnings.filter((e) => Number(e.employeeId) === userEmployeeId);
    }
  }

  return {
    ...base,
    earning: sanitizedEarning,
    employeeEarnings: sanitizedEarnings,
    payload: sanitizedPayload,
  };
};

// ==================== Visit state used by the CRM UI ====================
router.get('/visit-state', async (req, res) => {
  try {
    const canViewAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
    const canViewAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ASSIGNED);

    if (!canViewAll && !canViewAssigned) {
      return res.status(403).json({ success: false, error: 'Доступ к календарю и записям запрещён' });
    }

    const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
    const canViewAllPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_ALL);
    const canViewOwnPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_OWN);
    const userEmployeeId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
    const scopedEmployee = !canViewAll && canViewAssigned
      ? await resolveScopedEmployee(prisma, req.auth)
      : null;

    let [calendarEntries, visits] = await Promise.all([
      prisma.calendarEntry.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
      prisma.visit.findMany({
        include: VISIT_WITH_EARNING_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // If scoped to assigned visits only
    if (!canViewAll && canViewAssigned) {
      if (!scopedEmployee) {
        calendarEntries = [];
        visits = [];
      } else {
        visits = visits.filter((visit) => recordBelongsToEmployee(visit, scopedEmployee));
      }
    }

    res.json({
      success: true,
      data: {
        calendarEntries: calendarEntries.map((entry) =>
          scopedEmployee && !recordBelongsToEmployee(entry, scopedEmployee)
            ? sanitizeCoworkerCalendarEntry(entry)
            : sanitizeCalendarEntry(entry, canViewContacts),
        ),
        visits: visits.map((v) =>
          sanitizeVisit(v, {
            canViewContacts,
            canViewAllPayouts,
            canViewOwnPayouts,
            userEmployeeId,
          })
        ),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Visit state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/calendar-entries', async (req, res) => {
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к календарю запрещён' });
  }

  const payload = req.body ?? {};
  if (!canManageAll && canManageAssigned) {
    const employee = await resolveScopedEmployee(prisma, req.auth);
    if (!employee || !recordBelongsToEmployee({payload}, employee)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: можно создавать записи только для себя' });
    }
  }

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

router.put('/calendar-entries/:id', async (req, res) => {
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к календарю запрещён' });
  }

  const id = Number(req.params.id);
  const payload = { ...(req.body ?? {}), id };
  if (!canManageAll && canManageAssigned) {
    const existing = await prisma.calendarEntry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Calendar entry not found' });
    }
    const employee = await resolveScopedEmployee(prisma, req.auth);
    const target = {
      ...existing,
      payload: {...(existing.payload || {}), ...payload},
    };
    if (
      !employee ||
      !recordBelongsToEmployee(existing, employee) ||
      !recordBelongsToEmployee(target, employee)
    ) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: можно изменять записи только для себя' });
    }
  }

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

router.delete('/calendar-entries/:id', requirePermission(PERMISSIONS.CALENDAR_DELETE), async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  const before = await prisma.calendarEntry.findUnique({where: {id}});
  if (!before) return res.status(404).json({success: false, error: 'Calendar entry not found'});
  if (!hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL)) {
    const employee = await resolveScopedEmployee(prisma, req.auth);
    if (!employee || !recordBelongsToEmployee(before, employee)) {
      return res.status(403).json({success: false, error: 'Доступ запрещён: можно удалять записи только для себя'});
    }
  }
  localRespondWithAudit(
    req,
    res,
    prisma.calendarEntry.delete({where: {id}}).then(withStoredId),
    {action: 'delete/cancel visit', after: null, before, entity: 'CalendarEntry', entityId: id},
  );
});

router.post('/visits/dedupe-calendar', requireOwner, async (req, res) => {
  const rawCalendarEntryId = req.body?.calendarEntryId;
  const calendarEntryId = rawCalendarEntryId ? Number(rawCalendarEntryId) : null;

  if (rawCalendarEntryId && (!Number.isFinite(calendarEntryId) || calendarEntryId <= 0)) {
    return sendValidationError(res, validationError('calendarEntryId must be a positive number'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicateKeys = calendarEntryId
        ? [{ calendarEntryId }]
        : await tx.$queryRaw`
            SELECT "calendarEntryId"
            FROM "Visit"
            WHERE "calendarEntryId" IS NOT NULL
            GROUP BY "calendarEntryId"
            HAVING COUNT(*) > 1
            ORDER BY "calendarEntryId" ASC
          `;
      const cleaned = [];
      const skipped = [];

      for (const key of duplicateKeys) {
        const entryId = Number(key.calendarEntryId);
        if (!Number.isFinite(entryId) || entryId <= 0) continue;

        const [calendarEntry, visits] = await Promise.all([
          tx.calendarEntry.findUnique({ where: { id: entryId } }),
          tx.visit.findMany({
            where: { calendarEntryId: entryId },
            include: {
              employeeEarnings: true,
            },
            orderBy: { id: 'asc' },
          }),
        ]);

        if (visits.length <= 1) continue;

        const visitIdFromEntry = Number(calendarEntry?.visitId);
        const keepByCalendar = visits.find((visit) => visit.id === visitIdFromEntry);
        const paidVisits = visits.filter((visit) =>
          visit.employeeEarnings.some((earning) => earning.payoutId),
        );
        const keepVisit = keepByCalendar || paidVisits[0] || visits[0];
        const duplicates = visits.filter((visit) => visit.id !== keepVisit.id);

        if (duplicates.some((visit) => visit.employeeEarnings.some((earning) => earning.payoutId))) {
          skipped.push({
            calendarEntryId: entryId,
            reason: 'duplicate_visit_already_in_payout',
            visitIds: duplicates.map((visit) => visit.id),
          });
          continue;
        }

        const deleted = [];
        for (const visit of duplicates) {
          deleted.push(await removeDuplicateCalendarVisit(tx, req, visit));
        }

        if (calendarEntry && Number(calendarEntry.visitId) !== keepVisit.id) {
          const calendarPayload =
            calendarEntry.payload && typeof calendarEntry.payload === 'object'
              ? calendarEntry.payload
              : {};
          await tx.calendarEntry.update({
            where: { id: entryId },
            data: buildCalendarEntryData({
              ...calendarPayload,
              status: calendarEntry.status || calendarPayload.status || 'completed',
              visitId: keepVisit.id,
            }),
          });
        }

        cleaned.push({
          calendarEntryId: entryId,
          deleted,
          keepVisitId: keepVisit.id,
        });
      }

      return {
        cleaned,
        skipped,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Dedupe calendar visits error:', err);
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

router.post('/calendar-entries/delete-completed', requirePermission(PERMISSIONS.CALENDAR_DELETE), async (req, res) => {
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
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён: требуется право управления визитами' });
  }

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
    const result = await runSerializableTransaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.findUnique({
        where: { id: calendarEntryId },
      });

      if (!calendarEntry) {
        const error = new Error('Calendar entry not found');
        error.status = 404;
        throw error;
      }

      if (!canManageAll && canManageAssigned) {
        const scopedEmployee = await resolveScopedEmployee(tx, req.auth);
        const belongsToCalendar = recordBelongsToEmployee(calendarEntry, scopedEmployee);
        if (!scopedEmployee || !belongsToCalendar) {
          const error = new Error('Доступ запрещён: нельзя завершать визиты других мастеров');
          error.status = 403;
          throw error;
        }
        if (!visitPayload.employeeId && !visitPayload.masterId) {
          visitPayload.employeeId = scopedEmployee.id;
        }
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
            ({ clientPackage, clientPackageUsage } = await applyPackageLedgerUsage(
              tx,
              req,
              existingCompletedVisit.id,
              visitPayload,
              { action: 'use package', calendarEntryId, reason: 'calendar-complete-idempotent' },
            ));
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
      let visit = existingVisit;
      let createdFreshVisit = false;

      if (!visit) {
        try {
          visit = await tx.visit.create({
            data: buildVisitData(visitPayload),
          });
          createdFreshVisit = true;
        } catch (error) {
          if (error?.code !== 'P2002') {
            throw error;
          }
          visit = await tx.visit.findFirst({
            where: { calendarEntryId },
            orderBy: { id: 'asc' },
          });
          if (!visit) {
            throw error;
          }
        }
      }
      let clientPackage = null;
      let clientPackageUsage = null;
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
        ({ clientPackage, clientPackageUsage } = await applyPackageLedgerUsage(
          tx,
          req,
          visit.id,
          visitPayload,
          { action: 'use package', calendarEntryId, reason: 'calendar-complete' },
        ));
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
      const persistedVisit = !createdFreshVisit
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
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён: требуется право управления визитами' });
  }

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

      if (!canManageAll && canManageAssigned) {
        const scopedEmployee = await resolveScopedEmployee(tx, req.auth);
        const belongsToVisit =
          recordBelongsToEmployee(visit, scopedEmployee) ||
          recordBelongsToEmployee(calendarEntry, scopedEmployee);
        if (!scopedEmployee || !belongsToVisit) {
          const error = new Error('Доступ запрещён: нельзя изменять визиты других мастеров');
          error.status = 403;
          throw error;
        }
        if (!visitPayload.employeeId && !visitPayload.masterId) {
          visitPayload.employeeId = scopedEmployee.id;
        }
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
        const restored = await restorePackageLedgerUsage(tx, req, visit, usage);
        restoredClientPackages = [...restoredClientPackages, restored.clientPackage];
        restoredPackageUsages = [...restoredPackageUsages, restored.clientPackageUsage];
      }

      if (newUsesPackage) {
        ({ clientPackage, clientPackageUsage } = await applyPackageLedgerUsage(
          tx,
          req,
          visitId,
          visitPayload,
          { action: 'use package', calendarEntryId, reason: 'update-completed' },
        ));
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

router.post('/visits/revert-completed', requirePermission(PERMISSIONS.CALENDAR_DELETE), async (req, res) => {
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
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к визитам запрещён' });
  }

  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  const userEmployeeId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;

  if (!canManageAll && canManageAssigned) {
    if (!userEmployeeId || Number(employeeId) !== userEmployeeId) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: можно создавать визиты только для себя' });
    }
  }

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
    }).then(async (visit) => {
      await handleVisitChange(null, visit);
      return visit;
    }),
    'Visit',
    'create visit',
  );
});

router.get('/visits/:id', async (req, res) => {
  const canViewAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
  const canViewAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ASSIGNED);

  if (!canViewAll && !canViewAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к визитам запрещён' });
  }

  const id = Number(req.params.id);
  const userEmployeeId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  const canViewAllPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_ALL);
  const canViewOwnPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_OWN);

  try {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: VISIT_WITH_EARNING_INCLUDE,
    });

    if (!visit) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }

    if (!canViewAll && canViewAssigned) {
      const scopedEmployee = await resolveScopedEmployee(prisma, req.auth);
      if (!scopedEmployee || !recordBelongsToEmployee(visit, scopedEmployee)) {
        return res.status(403).json({ success: false, error: 'Доступ запрещён: можно просматривать только свои визиты' });
      }
    }

    res.json({
      success: true,
      data: sanitizeVisit(visit, {
        canViewContacts,
        canViewAllPayouts,
        canViewOwnPayouts,
        userEmployeeId,
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/visits/:id', async (req, res) => {
  const canManageAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);

  if (!canManageAll && !canManageAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к визитам запрещён' });
  }

  const id = Number(req.params.id);
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  const userEmployeeId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
  const before = await prisma.visit.findUnique({where: {id}});

  if (!before) {
    return res.status(404).json({ success: false, error: 'Visit not found' });
  }

  if (!canManageAll && canManageAssigned) {
    const scopedEmployee = await resolveScopedEmployee(prisma, req.auth);
    if (
      !scopedEmployee ||
      !recordBelongsToEmployee(before, scopedEmployee) ||
      (employeeId && Number(employeeId) !== userEmployeeId)
    ) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: можно изменять только свои визиты' });
    }
  }

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
    }).then(async (visit) => {
      await handleVisitChange(before, visit);
      return visit;
    }),
    'Visit',
    'update visit',
  );
});

router.delete('/visits/:id', requirePermission(PERMISSIONS.CALENDAR_DELETE), async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  try {
    let deletedVisit = null;
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.visit.findUnique({ where: { id } });
      await assertVisitCanBeRemoved(tx, id);
      await removeUnpaidEmployeeEarningForVisit(tx, req, id);
      const deleted = await tx.visit.delete({ where: { id } });
      deletedVisit = before || deleted;
      await recordAuditLog(tx, req, {
        action: 'delete/cancel visit',
        after: null,
        before: before ? withStoredId(before) : null,
        entity: 'Visit',
        entityId: id,
      });
      return deleted;
    });
    await handleVisitChange(deletedVisit, null);
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete visit error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/visits', async (req, res) => {
  const canViewAll = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
  const canViewAssigned = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ASSIGNED);

  if (!canViewAll && !canViewAssigned) {
    return res.status(403).json({ success: false, error: 'Доступ к визитам запрещён' });
  }

  const userEmployeeId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  const canViewAllPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_ALL);
  const canViewOwnPayouts = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_OWN);

  try {
    let visits = await prisma.visit.findMany({
      include: VISIT_WITH_EARNING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    if (!canViewAll && canViewAssigned) {
      const employee = await resolveScopedEmployee(prisma, req.auth);
      visits = employee ? visits.filter((visit) => recordBelongsToEmployee(visit, employee)) : [];
    }

    res.json({
      success: true,
      data: visits.map((v) =>
        sanitizeVisit(v, {
          canViewContacts,
          canViewAllPayouts,
          canViewOwnPayouts,
          userEmployeeId,
        }),
      ),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports._private = {sanitizeCoworkerCalendarEntry};
