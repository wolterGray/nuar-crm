// backend/routes/crud.js
// CRUD routes for CRM data using Prisma.

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { requireOwner } = require('../middleware/auth');
const prisma = new PrismaClient();

// ----- Helper for unified response -----
const respond = (res, promise) => {
  promise
    .then((data) => res.json({ success: true, data }))
    .catch((err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const respondWithAudit = (req, res, promise, audit) => {
  promise
    .then(async (data) => {
      await recordAuditLog(prisma, req, {
        ...audit,
        after: audit?.after === undefined ? data : audit.after,
        entityId: audit?.entityId ?? data?.id,
      });
      res.json({ success: true, data });
    })
    .catch(async (err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      await recordErrorEvent(prisma, {
        context: {
          action: audit?.action,
          entity: audit?.entity,
          params: req.params,
        },
        error: err,
        message: err.message,
        source: 'crud',
      });
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const findById = (model, id) => prisma[model].findUnique({where: {id}});

const auditCreate = (req, res, promise, entity, action) =>
  respondWithAudit(req, res, promise, {action, entity});

const auditUpdate = async (req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(model, id) : null;
  respondWithAudit(req, res, promise, {action, before, entity, entityId: id});
};

const auditDelete = async (req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(model, id) : null;
  respondWithAudit(req, res, promise, {
    action,
    after: null,
    before,
    entity,
    entityId: id,
  });
};

const clientSelect = {
  id: true,
  name: true,
  messageName: true,
  phone: true,
  email: true,
  birthday: true,
  instagram: true,
  telegram: true,
  source: true,
  messageLanguage: true,
  preference: true,
  status: true,
  tags: true,
  note: true,
  createdAt: true,
  updatedAt: true,
};

const cleanOptionalString = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

const validationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const assertNonNegative = (value, fieldName) => {
  if (value !== null && value !== undefined && Number(value) < 0) {
    throw validationError(`${fieldName} cannot be negative`);
  }
};

const sendValidationError = (res, err) => {
  const response = getHttpErrorResponse(err);
  return res.status(response.status).json({success: false, error: response.message});
};

const parsePositiveInt = (value, fieldName = 'id') => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw validationError(`${fieldName} is invalid`);
  }
  return number;
};

const getRouteId = (req, res, fieldName = 'id') => {
  try {
    return parsePositiveInt(req.params[fieldName], fieldName);
  } catch (err) {
    sendValidationError(res, err);
    return null;
  }
};

const LEGACY_FINANCIAL_WRITE_FLAG = 'allowLegacyFinancialWrite';

const warnLegacyFinancialWrite = async (req, {action, entity, sourceOfTruth}) => {
  const allowed = req.body?.[LEGACY_FINANCIAL_WRITE_FLAG] === true;
  const warning = `Legacy financial endpoint called: ${req.method} ${req.originalUrl}. Use ${sourceOfTruth}.`;

  console.warn(warning, {allowed, action});
  await recordAuditLog(prisma, req, {
    action: 'legacy financial write attempted',
    after: {
      action,
      allowed,
      method: req.method,
      path: req.originalUrl,
      sourceOfTruth,
    },
    before: null,
    entity,
    entityId: null,
  });
};

const requireLegacyFinancialWriteFlag = async (req, res, options) => {
  await warnLegacyFinancialWrite(req, options);

  if (req.body?.[LEGACY_FINANCIAL_WRITE_FLAG] === true) {
    return true;
  }

  return res.status(422).json({
    success: false,
    error: `Legacy financial write is disabled. Use ${options.sourceOfTruth}.`,
  });
};

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

const validateClientPackageData = (data) => {
  assertNonNegative(data.remainingVisits, 'remainingVisits');
  assertNonNegative(data.price, 'price');
};

const resolveClientPackageStatus = (remainingVisits, currentStatus) => {
  if (Number(remainingVisits) <= 0) {
    return 'Архив';
  }

  return ['Архив', 'Закончился'].includes(String(currentStatus ?? ''))
    ? 'Активен'
    : currentStatus;
};

const validateCertificateData = (data) => {
  assertNonNegative(data.nominal, 'nominal');
  assertNonNegative(data.remainingBalance, 'remainingBalance');
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

const objectPayload = (payload) =>
  payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

const getVisitPackageInfo = (visit) => {
  const payload = objectPayload(visit?.payload);
  return {
    clientPackageId: Number(visit?.packageUsageId ?? payload.packageUsageId),
    sessionsUsed: Number(visit?.packageSessionsUsed ?? payload.packageSessionsUsed) || 0,
  };
};

const getVisitCertificateInfo = (visit) => {
  const payload = objectPayload(visit?.payload);
  return {
    amount: Number(visit?.certificateAmountUsed ?? payload.certificateAmountUsed) || 0,
    certificateId: Number(visit?.certificateUsageId ?? payload.certificateUsageId),
  };
};

const restoreClientPackageUsage = async (tx, req, visit, usage) => {
  const info = usage
    ? {clientPackageId: usage.clientPackageId, sessionsUsed: Number(usage.sessionsUsed) || 1}
    : getVisitPackageInfo(visit);

  if (!Number.isFinite(info.clientPackageId) || info.clientPackageId <= 0) {
    throw validationError('Client package usage is missing');
  }

  const packageBefore = await tx.clientPackage.findUnique({
    where: {id: info.clientPackageId},
  });

  if (!packageBefore) {
    throw validationError('Client package not found');
  }

  const packagePayload = objectPayload(packageBefore.payload);
  const sessionsUsed = Math.max(1, Number(info.sessionsUsed) || 1);
  const currentRemaining = Number(packageBefore.remainingVisits) || 0;
  const totalVisits = Number(packageBefore.totalVisits) || Number(packagePayload.totalVisits) || 0;
  const nextRemaining =
    totalVisits > 0 ? Math.min(totalVisits, currentRemaining + sessionsUsed) : currentRemaining + sessionsUsed;
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
    where: {id: info.clientPackageId},
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
  const restoredUsage = usage
    ? await tx.clientPackageUsage.update({
        where: {id: usage.id},
        data: {revertedAt: new Date()},
      })
    : null;

  await recordAuditLog(tx, req, {
    action: 'restore package',
    after: {
      clientPackage: withStoredId(restoredPackage),
      clientPackageUsage: restoredUsage ? withStoredId(restoredUsage) : null,
    },
    before: withStoredId(packageBefore),
    entity: 'ClientPackage',
    entityId: restoredPackage.id,
  });

  return {clientPackage: restoredPackage, clientPackageUsage: restoredUsage};
};

const restoreCertificateUsage = async (tx, req, visit, usage) => {
  const info = usage
    ? {amount: Number(usage.amount) || 0, certificateId: usage.certificateId}
    : getVisitCertificateInfo(visit);

  if (!Number.isFinite(info.certificateId) || info.certificateId <= 0) {
    throw validationError('Certificate usage is missing');
  }

  const certificateBefore = await tx.certificate.findUnique({
    where: {id: info.certificateId},
  });

  if (!certificateBefore) {
    throw validationError('Certificate not found');
  }

  const certificatePayload = objectPayload(certificateBefore.payload);
  const amount = Number(info.amount) || 0;
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
    where: {id: info.certificateId},
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
  const restoredUsage = usage
    ? await tx.certificateUsage.update({
        where: {id: usage.id},
        data: {revertedAt: new Date()},
      })
    : null;

  await recordAuditLog(tx, req, {
    action: 'restore certificate',
    after: {
      certificate: withStoredId(restoredCertificate),
      certificateUsage: restoredUsage ? withStoredId(restoredUsage) : null,
    },
    before: withStoredId(certificateBefore),
    entity: 'Certificate',
    entityId: restoredCertificate.id,
  });

  return {certificate: restoredCertificate, certificateUsage: restoredUsage};
};

const applyClientPackageUsage = async (tx, req, visitId, visitPayload, reason) => {
  const clientPackageId = Number(visitPayload.packageUsageId);
  const sessionsUsed = Number(visitPayload.packageSessionsUsed) || 1;

  if (!Number.isFinite(clientPackageId) || clientPackageId <= 0) {
    throw validationError('packageUsageId is required for package payment');
  }

  if (!Number.isInteger(sessionsUsed) || sessionsUsed <= 0) {
    throw validationError('packageSessionsUsed must be a positive integer');
  }

  const existingUsage = await tx.clientPackageUsage.findUnique({
    where: {
      clientPackageId_visitId: {
        clientPackageId,
        visitId,
      },
    },
  });
  const clientPackageBefore = await tx.clientPackage.findUnique({
    where: {id: clientPackageId},
  });

  if (!clientPackageBefore) {
    throw validationError('Client package not found');
  }

  const packagePayload = objectPayload(clientPackageBefore.payload);
  const currentRemaining = Number(clientPackageBefore.remainingVisits) || 0;

  if (currentRemaining < sessionsUsed) {
    throw validationError('Client package does not have enough remaining visits');
  }

  const nextRemaining = currentRemaining - sessionsUsed;
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
    ...writeOffHistory.filter((item) => String(item?.visitId ?? '') !== String(visitId)),
    {
      sessionsUsed,
      usedAt: new Date().toISOString(),
      visitId,
    },
  ];
  const updated = await tx.clientPackage.updateMany({
    where: {
      id: clientPackageId,
      remainingVisits: {gte: sessionsUsed},
    },
    data: {
      remainingVisits: {decrement: sessionsUsed},
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

  const clientPackageUsage = existingUsage
    ? await tx.clientPackageUsage.update({
        where: {id: existingUsage.id},
        data: {
          payload: {reason},
          revertedAt: null,
          sessionsUsed,
        },
      })
    : await tx.clientPackageUsage.create({
        data: {
          clientPackageId,
          payload: {reason},
          sessionsUsed,
          visitId,
        },
      });
  const clientPackage = await tx.clientPackage.findUnique({
    where: {id: clientPackageId},
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

  return {clientPackage, clientPackageUsage};
};

const applyCertificateUsage = async (tx, req, visitId, visitPayload, reason) => {
  const certificateId = Number(visitPayload.certificateUsageId);
  const amount = Number(visitPayload.certificateAmountUsed) || 0;

  if (!Number.isFinite(certificateId) || certificateId <= 0) {
    throw validationError('certificateUsageId is required for certificate payment');
  }

  if (!(amount > 0)) {
    throw validationError('certificateAmountUsed must be greater than 0');
  }

  const existingUsage = await tx.certificateUsage.findUnique({
    where: {
      certificateId_visitId: {
        certificateId,
        visitId,
      },
    },
  });
  const certificateBefore = await tx.certificate.findUnique({
    where: {id: certificateId},
  });

  if (!certificateBefore) {
    throw validationError('Certificate not found');
  }

  const certificatePayload = objectPayload(certificateBefore.payload);
  const currentBalance = Number(certificateBefore.remainingBalance) || 0;

  if (currentBalance < amount) {
    throw validationError('Certificate does not have enough remaining balance');
  }

  const nextBalance = currentBalance - amount;
  const nominal = Number(certificateBefore.nominal) || Number(certificatePayload.nominal) || 0;
  const nextStatus = resolveCertificateStatus(
    nextBalance,
    nominal,
    certificatePayload.status ?? certificateBefore.status,
  );
  const nextUsedDate = nextBalance <= 0 ? visitPayload.date || certificateBefore.usedDate : certificateBefore.usedDate;
  const updated = await tx.certificate.updateMany({
    where: {
      id: certificateId,
      remainingBalance: {gte: amount},
    },
    data: {
      remainingBalance: {decrement: amount},
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

  const certificateUsage = existingUsage
    ? await tx.certificateUsage.update({
        where: {id: existingUsage.id},
        data: {
          amount,
          payload: {reason},
          revertedAt: null,
        },
      })
    : await tx.certificateUsage.create({
        data: {
          amount,
          certificateId,
          payload: {reason},
          visitId,
        },
      });
  const certificate = await tx.certificate.findUnique({
    where: {id: certificateId},
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

  return {certificate, certificateUsage};
};

const validateDayCloseRecordData = (data) => {
  assertNonNegative(data.total, 'total');
  assertNonNegative(data.cash, 'cash');
  assertNonNegative(data.card, 'card');
  assertNonNegative(data.blik, 'blik');
  assertNonNegative(data.packages, 'packages');
  assertNonNegative(data.certificates, 'certificates');
};

const validatePayrollRecordData = (data) => {
  assertNonNegative(data.amount, 'amount');
  assertNonNegative(data.payload?.report?.totals?.totalPayout, 'report.totals.totalPayout');
};

const buildClientData = (body) => ({
  name: String(body?.name ?? '').trim(),
  messageName: cleanOptionalString(body?.messageName),
  phone: cleanOptionalString(body?.phone),
  email: cleanOptionalString(body?.email),
  birthday: cleanOptionalString(body?.birthday),
  instagram: cleanOptionalString(body?.instagram),
  telegram: cleanOptionalString(body?.telegram),
  source: cleanOptionalString(body?.source),
  messageLanguage: cleanOptionalString(body?.messageLanguage),
  preference: cleanOptionalString(body?.preference),
  status: cleanOptionalString(body?.status),
  tags: cleanOptionalString(body?.tags),
  note: cleanOptionalString(body?.note),
});

const withStoredId = (record) => ({
  ...(record?.payload && typeof record.payload === 'object' ? record.payload : {}),
  id: record?.id,
});

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

const toDate = (date) => {
  if (!date) return null;

  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const buildVisitData = (payload) => ({
  clientId: null,
  serviceId: null,
  scheduledAt: toDateTime(payload?.inputDate || payload?.date, payload?.time),
  notes: cleanOptionalString(payload?.note),
  calendarEntryId: payload?.calendarEntryId ? Number(payload.calendarEntryId) : null,
  recordType: cleanOptionalString(payload?.recordType),
  payload,
});

const firstServiceVariant = (variants) => {
  if (!Array.isArray(variants)) {
    return null;
  }

  return (
    variants.find(
      (variant) =>
        Number(variant?.duration) > 0 || Number(variant?.price) > 0,
    ) ?? null
  );
};

const buildServiceData = (payload) => {
  const variants = Array.isArray(payload?.variants) ? payload.variants : [];
  const firstVariant = firstServiceVariant(variants);

  return {
    name: String(payload?.name ?? '').trim(),
    category: cleanOptionalString(payload?.category),
    description: cleanOptionalString(payload?.description),
    color: cleanOptionalString(payload?.color),
    variants,
    status: cleanOptionalString(payload?.status),
    bookingSettings: payload?.bookingSettings ?? null,
    buffers: {
      afterEnabled: payload?.siteBookingBufferAfterEnabled === true,
      afterMinutes: Math.max(0, Number(payload?.siteBookingBufferAfterMinutes) || 0),
      beforeEnabled: payload?.siteBookingBufferBeforeEnabled === true,
      beforeMinutes: Math.max(0, Number(payload?.siteBookingBufferBeforeMinutes) || 0),
    },
    siteVisible:
      typeof payload?.siteVisible === 'boolean'
        ? payload.siteVisible
        : typeof payload?.siteBookingEnabled === 'boolean'
          ? payload.siteBookingEnabled
          : null,
    price: firstVariant ? Number(firstVariant.price) || null : null,
    durationMin: firstVariant ? Number(firstVariant.duration) || null : null,
    payload,
  };
};

const buildEmployeeData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  phone: cleanOptionalString(payload?.phone),
  email: cleanOptionalString(payload?.email),
  role: cleanOptionalString(payload?.role),
  status: cleanOptionalString(payload?.status),
  color: cleanOptionalString(payload?.color),
  commissionRate:
    payload?.commissionRate !== undefined && payload?.commissionRate !== null
      ? Number(payload.commissionRate) || 0
      : null,
  shiftStart: cleanOptionalString(payload?.shiftStart),
  shiftEnd: cleanOptionalString(payload?.shiftEnd),
  payrollSchedule: cleanOptionalString(payload?.payrollSchedule),
  siteBookingSlotMinutes:
    payload?.siteBookingSlotMinutes !== undefined && payload?.siteBookingSlotMinutes !== null
      ? Number(payload.siteBookingSlotMinutes) || null
      : null,
  services: payload?.services ?? payload?.serviceIds ?? null,
  siteVisible:
    typeof payload?.siteVisible === 'boolean'
      ? payload.siteVisible
      : typeof payload?.siteBookingEnabled === 'boolean'
        ? payload.siteBookingEnabled
        : null,
  pricing: {
    premiumHoursEnabled: payload?.premiumHoursEnabled === true,
    premiumHoursRules: Array.isArray(payload?.premiumHoursRules)
      ? payload.premiumHoursRules
      : [],
    siteDiscountPercent: Math.max(0, Number(payload?.siteDiscountPercent) || 0),
  },
  payrollSettings: payload?.payrollSettings ?? null,
  shifts: payload?.shifts ?? null,
  payload,
});

const buildTaskData = (payload) => ({
  type: cleanOptionalString(payload?.type) || 'task',
  title: String(payload?.title ?? '').trim(),
  description: cleanOptionalString(payload?.description ?? payload?.note),
  note: cleanOptionalString(payload?.note),
  dueDate: toDate(payload?.dueDate),
  priority: cleanOptionalString(payload?.priority),
  status: cleanOptionalString(payload?.status),
  sortOrder:
    payload?.sortOrder !== undefined && payload?.sortOrder !== null
      ? Number(payload.sortOrder) || 0
      : null,
  completed:
    payload?.completed !== undefined
      ? Boolean(payload.completed)
      : payload?.status === 'completed',
  payload,
});

const buildWaitlistEntryData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  preferredDate: cleanOptionalString(payload?.preferredDate),
  preferredMaster: cleanOptionalString(payload?.preferredMaster),
  preferredService: cleanOptionalString(payload?.preferredService),
  preferredTimeFrom: cleanOptionalString(payload?.preferredTimeFrom),
  preferredTimeTo: cleanOptionalString(payload?.preferredTimeTo),
  status: cleanOptionalString(payload?.status) || 'active',
  note: cleanOptionalString(payload?.note),
  lastOfferedAt: payload?.lastOfferedAt ? new Date(payload.lastOfferedAt) : null,
  lastOfferedSlot: payload?.lastOfferedSlot ?? null,
  payload,
});

const buildSupplyData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  stock:
    payload?.stock !== undefined && payload?.stock !== null
      ? Number(payload.stock) || 0
      : null,
  minStock:
    payload?.minStock !== undefined && payload?.minStock !== null
      ? Number(payload.minStock) || 0
      : null,
  unit: cleanOptionalString(payload?.unit),
  cost:
    payload?.cost !== undefined && payload?.cost !== null
      ? Number(payload.cost) || 0
      : null,
  note: cleanOptionalString(payload?.note),
  orderUrl: cleanOptionalString(payload?.orderUrl),
  payload,
});

const buildMessageTemplateData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  channel: cleanOptionalString(payload?.channel),
  language: cleanOptionalString(payload?.language),
  audience: cleanOptionalString(payload?.audience),
  purpose: cleanOptionalString(payload?.purpose),
  subject: cleanOptionalString(payload?.subject),
  body: String(payload?.body ?? '').trim(),
  payload,
});

const buildCommunicationLogData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  channel: cleanOptionalString(payload?.channel),
  templateName: cleanOptionalString(payload?.templateName),
  body: cleanOptionalString(payload?.body),
  createdAt: payload?.createdAt ? new Date(payload.createdAt) : undefined,
  payload,
});

const buildPackageData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  service: cleanOptionalString(payload?.service),
  visitsCount:
    payload?.visitsCount !== undefined && payload?.visitsCount !== null
      ? Number(payload.visitsCount) || 0
      : null,
  price:
    payload?.price !== undefined && payload?.price !== null
      ? Number(payload.price) || 0
      : null,
  validityDays:
    payload?.validityDays !== undefined && payload?.validityDays !== null
      ? Number(payload.validityDays) || 0
      : null,
  status: cleanOptionalString(payload?.status),
  active: payload?.active !== undefined ? Boolean(payload.active) : payload?.status !== 'Неактивен',
  payload,
});

const buildClientPackageData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  packageId: payload?.packageId ? Number(payload.packageId) : null,
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  clientName: cleanOptionalString(payload?.client),
  packageName: cleanOptionalString(payload?.packageName),
  service: cleanOptionalString(payload?.service),
  totalVisits:
    payload?.totalVisits !== undefined && payload?.totalVisits !== null
      ? Number(payload.totalVisits) || 0
      : null,
  remainingVisits:
    payload?.remainingVisits !== undefined && payload?.remainingVisits !== null
      ? Number(payload.remainingVisits) || 0
      : null,
  price:
    payload?.price !== undefined && payload?.price !== null
      ? Number(payload.price) || 0
      : null,
  purchaseDate: cleanOptionalString(payload?.purchaseDate),
  expiryDate: cleanOptionalString(payload?.expiryDate),
  payment: cleanOptionalString(payload?.payment),
  status: cleanOptionalString(payload?.status),
  writeOffHistory: Array.isArray(payload?.writeOffHistory) ? payload.writeOffHistory : [],
  payload,
});

const buildCertificateData = (payload) => ({
  code: String(payload?.code ?? '').trim(),
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  recipientId: payload?.recipientId ? Number(payload.recipientId) : null,
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  saleVisitId: payload?.saleVisitId ? Number(payload.saleVisitId) : null,
  clientName: cleanOptionalString(payload?.client),
  recipientName: cleanOptionalString(payload?.recipient),
  nominal:
    payload?.nominal !== undefined && payload?.nominal !== null
      ? Number(payload.nominal) || 0
      : null,
  remainingBalance:
    payload?.remainingBalance !== undefined && payload?.remainingBalance !== null
      ? Number(payload.remainingBalance) || 0
      : null,
  purchaseDate: cleanOptionalString(payload?.purchaseDate),
  usedDate: cleanOptionalString(payload?.usedDate),
  expiryDate: cleanOptionalString(payload?.expiryDate),
  payment: cleanOptionalString(payload?.payment),
  status: cleanOptionalString(payload?.status),
  note: cleanOptionalString(payload?.note),
  payload,
});

const buildDayCloseRecordData = (payload) => {
  const payments = payload?.journal?.paymentsByMethod ?? {};

  return {
    date: String(payload?.date ?? '').trim(),
    cash: Number(payments.cash ?? payments['Наличные'] ?? payload?.cash ?? payload?.journal?.cashReceived) || 0,
    card: Number(payments.card ?? payments['Карта'] ?? payload?.card ?? payload?.journal?.cardReceived) || 0,
    blik: Number(payments.blik ?? payments['BLIK'] ?? payload?.blik) || 0,
    certificates: Number(payload?.certificates ?? payments.certificate ?? payments['Сертификат']) || 0,
    packages: Number(payload?.packages ?? payments.package ?? payments['Пакет']) || 0,
    total: Number(payload?.journal?.receivedRevenue ?? payload?.total) || 0,
    status: cleanOptionalString(payload?.status),
    note: cleanOptionalString(payload?.note),
    payload,
  };
};

const dayCloseToFinanceNumber = (value) => {
  const normalized =
    typeof value === 'string' ? value.replace(/\s+/g, '').replace(',', '.') : value;
  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
};

const normalizeDayCloseText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replaceAll('ł', 'l')
    .replaceAll('ó', 'o')
    .replaceAll('ą', 'a')
    .replaceAll('ę', 'e')
    .replaceAll('ś', 's')
    .replaceAll('ć', 'c')
    .replaceAll('ń', 'n')
    .replaceAll('ż', 'z')
    .replaceAll('ź', 'z');

const normalizeDayClosePaymentMethod = (method) => {
  const value = normalizeDayCloseText(method);

  if (!value || value.includes('не указано') || value.includes('unknown')) {
    return 'unspecified';
  }
  if (value === 'mono' || value.includes('monobank') || (value.includes('mono') && !value.includes('monochrome'))) {
    return 'mono';
  }
  if (value.includes('ukr') || value.includes('укр')) {
    return 'ukrainianCard';
  }
  if (value.includes('gotowka') || value.includes('cash') || value.includes('нал') || value.includes('готів')) {
    return 'cash';
  }
  if (
    value.includes('terminal') ||
    value.includes('терминал') ||
    value.includes('термінал') ||
    value.includes('karta') ||
    value.includes('card') ||
    value.includes('карта')
  ) {
    return 'card';
  }
  if (value.includes('package') || value.includes('pakiet') || value.includes('пакет')) {
    return 'package';
  }
  if (
    value.includes('certificate') ||
    value.includes('certyfikat') ||
    value.includes('сертификат') ||
    value.includes('сертифікат')
  ) {
    return 'certificate';
  }
  if (value.includes('crypto') || value.includes('крипт')) {
    return 'crypto';
  }
  if (value.includes('blik')) {
    return 'blik';
  }
  if (value.includes('barter') || value.includes('бартер')) {
    return 'barter';
  }

  return 'unspecified';
};

const parseDayCloseDateParts = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      day: Number(isoMatch[3]),
      month: Number(isoMatch[2]),
      year: Number(isoMatch[1]),
    };
  }

  const appMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (appMatch) {
    return {
      day: Number(appMatch[1]),
      month: Number(appMatch[2]),
      year: Number(appMatch[3]),
    };
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      day: parsed.getDate(),
      month: parsed.getMonth() + 1,
      year: parsed.getFullYear(),
    };
  }

  return null;
};

const normalizeDayCloseDate = (value) => {
  const parts = parseDayCloseDateParts(value);
  if (!parts || !parts.year || !parts.month || !parts.day) {
    return String(value ?? '').trim();
  }

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

const getRecordPayload = (record) => objectPayload(record?.payload);

const formatDateForDayClose = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const getVisitPayloadForDayClose = (visit) => ({
  ...getRecordPayload(visit),
  id: visit?.id,
  date: getRecordPayload(visit).date ?? formatDateForDayClose(visit?.scheduledAt),
});

const getPackagePayloadForDayClose = (clientPackage) => ({
  ...getRecordPayload(clientPackage),
  id: clientPackage?.id,
  master: getRecordPayload(clientPackage).master ?? getRecordPayload(clientPackage).employeeName,
  totalVisits: clientPackage?.totalVisits ?? getRecordPayload(clientPackage).totalVisits,
  price: clientPackage?.price ?? getRecordPayload(clientPackage).price,
  purchaseDate: clientPackage?.purchaseDate ?? getRecordPayload(clientPackage).purchaseDate,
  payment: clientPackage?.payment ?? getRecordPayload(clientPackage).payment,
});

const isSameDayCloseDate = (value, date) => normalizeDayCloseDate(value) === date;

const isDayCloseCancelledVisit = (visit) =>
  ['cancelled', 'canceled', 'no_show'].includes(
    normalizeDayCloseText(visit?.status).replace('-', '_'),
  );

const isDayClosePackageVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'package';

const isDayCloseCertificateVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'certificate';

const isDayCloseBarterVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'barter';

const hasExplicitDayClosePaidAmount = (visit) =>
  visit?.paidAmount !== undefined &&
  visit?.paidAmount !== null &&
  String(visit.paidAmount).trim() !== '';

const getDayCloseGrossAmount = (visit) => dayCloseToFinanceNumber(visit?.amount);
const getDayCloseTipAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.tip));
const getDayCloseExtraAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.extra));
const getDayCloseDebtAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.debt));

const getDayCloseDiscountedAmount = (visit) => {
  if (hasExplicitDayClosePaidAmount(visit)) {
    return Math.max(0, dayCloseToFinanceNumber(visit.paidAmount));
  }

  const amount = getDayCloseGrossAmount(visit);
  const discount = dayCloseToFinanceNumber(visit?.discount);
  return Math.max(0, amount - amount * (discount / 100));
};

const getDayCloseServiceReceivedAmount = (visit) => {
  if (
    isDayCloseCancelledVisit(visit) ||
    isDayClosePackageVisit(visit) ||
    isDayCloseCertificateVisit(visit) ||
    isDayCloseBarterVisit(visit)
  ) {
    return 0;
  }

  if (hasExplicitDayClosePaidAmount(visit)) {
    return Math.max(0, dayCloseToFinanceNumber(visit.paidAmount));
  }

  return Math.max(0, getDayCloseDiscountedAmount(visit) - getDayCloseDebtAmount(visit));
};

const getDayCloseVisitReceivedAmount = (visit) => {
  if (isDayCloseCancelledVisit(visit)) {
    return 0;
  }

  if (visit?.recordType === 'operation') {
    return Math.max(0, getDayCloseExtraAmount(visit) || getDayCloseGrossAmount(visit));
  }

  return (
    getDayCloseServiceReceivedAmount(visit) +
    getDayCloseTipAmount(visit) +
    getDayCloseExtraAmount(visit)
  );
};

const getDayClosePlatformCommission = (visit) => {
  if (
    isDayCloseCancelledVisit(visit) ||
    isDayClosePackageVisit(visit) ||
    isDayCloseCertificateVisit(visit) ||
    isDayCloseBarterVisit(visit)
  ) {
    return 0;
  }

  if (visit?.commissionType === 'Booksy 45%') {
    const discountedAmount = getDayCloseDiscountedAmount(visit);
    const netAmount = Math.floor(discountedAmount - discountedAmount * 0.45 * 1.23);
    return Math.max(0, discountedAmount - Math.max(0, netAmount));
  }

  return Math.max(0, dayCloseToFinanceNumber(visit?.commission));
};

const getDayCloseEmployeeRate = (employees = [], employeeName = '') => {
  const employee = employees.find((item) => item.name === employeeName);
  return dayCloseToFinanceNumber(employee?.commissionRate);
};

const getDayCloseEmployeePayout = (visit, employees = []) => {
  if (isDayCloseCancelledVisit(visit) || isDayCloseBarterVisit(visit)) {
    return 0;
  }

  const rate = getDayCloseEmployeeRate(employees, visit?.master);
  const base =
    isDayClosePackageVisit(visit) || isDayCloseCertificateVisit(visit)
      ? getDayCloseDiscountedAmount(visit)
      : getDayCloseServiceReceivedAmount(visit);

  return Math.round(Math.max(0, base) * (rate / 100));
};

const getDayClosePackageSaleEmployeePayout = (clientPackage, employees = []) => {
  const rate = getDayCloseEmployeeRate(employees, clientPackage?.master);
  return Math.round(Math.max(0, dayCloseToFinanceNumber(clientPackage?.price)) * (rate / 100));
};

const getDayClosePackageVisitEmployeePayout = (visit, employees = [], clientPackages = []) => {
  if (!isDayClosePackageVisit(visit)) {
    return 0;
  }

  const clientPackage = clientPackages.find(
    (item) => String(item.id) === String(visit?.packageUsageId),
  );
  const totalVisits = Math.max(1, dayCloseToFinanceNumber(clientPackage?.totalVisits));
  const sessionsUsed = Math.max(1, dayCloseToFinanceNumber(visit?.packageSessionsUsed) || 1);
  const unitAmount =
    (Math.max(0, dayCloseToFinanceNumber(clientPackage?.price)) / totalVisits) * sessionsUsed;
  const rate = getDayCloseEmployeeRate(employees, visit?.master);

  return Math.round(unitAmount * (rate / 100));
};

const isDayCloseCompletedVisit = (visit) => {
  if (isDayCloseCancelledVisit(visit)) {
    return false;
  }

  if (visit?.recordType === 'operation') {
    return true;
  }

  return visit?.status === 'completed' || visit?.isPlanned === false;
};

const isDayCloseExpenseOperation = (visit) =>
  visit?.recordType === 'operation' &&
  (normalizeDayCloseText(visit.service).includes('расход') ||
    normalizeDayCloseText(visit.service).includes('expense') ||
    dayCloseToFinanceNumber(visit.extra) < 0 ||
    dayCloseToFinanceNumber(visit.amount) < 0);

const buildServerDayCloseJournal = ({clientPackages = [], employees = [], visits = []}) => {
  const completedVisits = visits.filter(isDayCloseCompletedVisit);
  const completedAppointments = completedVisits.filter((visit) => visit.recordType !== 'operation');
  const financialOperations = completedVisits.filter((visit) => visit.recordType === 'operation');
  const incomeOperations = financialOperations.filter((visit) => !isDayCloseExpenseOperation(visit));
  const expenseOperations = financialOperations.filter(isDayCloseExpenseOperation);
  const paymentsByMethod = {
    cash: 0,
    card: 0,
    ukrainianCard: 0,
    mono: 0,
    package: 0,
    certificate: 0,
    crypto: 0,
    blik: 0,
    barter: 0,
    unspecified: 0,
  };
  const paymentRecordsByMethod = Object.fromEntries(
    Object.keys(paymentsByMethod).map((key) => [key, 0]),
  );

  for (const visit of [...completedAppointments, ...incomeOperations]) {
    const method = normalizeDayClosePaymentMethod(visit.payment);
    const received = getDayCloseVisitReceivedAmount(visit);
    paymentsByMethod[method] = (paymentsByMethod[method] ?? 0) + received;
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  for (const item of clientPackages) {
    const method = normalizeDayClosePaymentMethod(item.payment);
    paymentsByMethod[method] =
      (paymentsByMethod[method] ?? 0) + Math.max(0, dayCloseToFinanceNumber(item.price));
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  const serviceReceived = completedAppointments.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  const packageIncome = clientPackages.reduce(
    (sum, item) => sum + Math.max(0, dayCloseToFinanceNumber(item.price)),
    0,
  );
  const operationsIncome = incomeOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  const expenses = expenseOperations.reduce(
    (sum, visit) =>
      sum + Math.abs(dayCloseToFinanceNumber(visit.extra) || dayCloseToFinanceNumber(visit.amount)),
    0,
  );
  const platformCommission = completedAppointments.reduce(
    (sum, visit) => sum + getDayClosePlatformCommission(visit),
    0,
  );
  const packageSalePayouts = clientPackages.reduce(
    (sum, item) => sum + getDayClosePackageSaleEmployeePayout(item, employees),
    0,
  );
  const employeePayouts =
    completedAppointments.reduce(
      (sum, visit) =>
        sum +
        (isDayClosePackageVisit(visit)
          ? getDayClosePackageVisitEmployeePayout(visit, employees, clientPackages)
          : getDayCloseEmployeePayout(visit, employees)),
      0,
    ) + packageSalePayouts;
  const receivedRevenue = serviceReceived + packageIncome + operationsIncome;
  const netProfit = receivedRevenue - platformCommission - employeePayouts - expenses;

  return {
    booksyCommission: platformCommission,
    cashReceived: paymentsByMethod.cash,
    cardReceived: paymentsByMethod.card,
    completedVisits: completedAppointments.length,
    expenses,
    netProfit,
    operationsIncome,
    packageIncome,
    paymentRecordsByMethod,
    paymentsByMethod,
    receivedRevenue,
    tips: completedAppointments.reduce((sum, visit) => sum + getDayCloseTipAmount(visit), 0),
    ukrainianCardReceived: paymentsByMethod.ukrainianCard,
  };
};

const buildServerDayCloseRecordData = ({actualCashInDrawer = 0, cashWithdrawal = 0, date, journal, note = ''}) => {
  const cash = dayCloseToFinanceNumber(journal?.cashReceived);
  const withdrawal = dayCloseToFinanceNumber(cashWithdrawal);
  const actual = dayCloseToFinanceNumber(actualCashInDrawer);
  const expectedCash = Math.max(0, cash - withdrawal);
  const variance = actual - expectedCash;
  const payload = {
    actual: {
      cashInDrawer: actual,
      cashWithdrawal: withdrawal,
    },
    closedAt: new Date().toISOString(),
    date,
    expectedCash,
    journal,
    note: String(note ?? '').trim(),
    status: 'closed',
    variance,
  };

  return {
    date,
    cash,
    card: dayCloseToFinanceNumber(journal?.paymentsByMethod?.card),
    blik: dayCloseToFinanceNumber(journal?.paymentsByMethod?.blik),
    certificates: dayCloseToFinanceNumber(journal?.paymentsByMethod?.certificate),
    packages: dayCloseToFinanceNumber(journal?.paymentsByMethod?.package),
    total: dayCloseToFinanceNumber(journal?.receivedRevenue),
    status: 'closed',
    note: String(note ?? '').trim(),
    payload,
  };
};

const buildPayrollRecordData = (payload) => ({
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  employeeName: cleanOptionalString(payload?.employeeName),
  startDate: cleanOptionalString(payload?.startDate),
  endDate: cleanOptionalString(payload?.endDate),
  periodKey: String(payload?.periodKey ?? '').trim(),
  amount: Number(payload?.amount ?? payload?.report?.totals?.totalPayout) || 0,
  status: cleanOptionalString(payload?.status),
  paidAt: payload?.paidAt ? new Date(payload.paidAt) : null,
  note: cleanOptionalString(payload?.note),
  payload,
});

const buildPayrollPeriodKey = (startDate, endDate) =>
  `${normalizeDayCloseDate(startDate)}:${normalizeDayCloseDate(endDate)}`;

const isInPayrollPeriod = (value, startDate, endDate) => {
  const date = normalizeDayCloseDate(value);
  return Boolean(date && date >= startDate && date <= endDate);
};

const buildServerPayrollReport = ({
  clientPackages = [],
  employeeId = null,
  employees = [],
  endDate,
  startDate,
  visits = [],
}) => {
  const normalizedStart = normalizeDayCloseDate(startDate);
  const normalizedEnd = normalizeDayCloseDate(endDate);
  const employeeIdNumber = employeeId ? Number(employeeId) : null;
  const filteredEmployees = employees
    .map(withStoredId)
    .filter((employee) => !employeeIdNumber || Number(employee.id) === employeeIdNumber);
  const employeeNames = new Set(filteredEmployees.map((employee) => employee.name));
  const completedVisits = visits
    .map(getVisitPayloadForDayClose)
    .filter(
      (visit) =>
        isDayCloseCompletedVisit(visit) &&
        !isDayCloseCancelledVisit(visit) &&
        visit.recordType !== 'operation' &&
        isInPayrollPeriod(visit.date, normalizedStart, normalizedEnd) &&
        employeeNames.has(visit.master),
    );
  const financialOperations = visits
    .map(getVisitPayloadForDayClose)
    .filter(
      (visit) =>
        visit.recordType === 'operation' &&
        isInPayrollPeriod(visit.date, normalizedStart, normalizedEnd) &&
        employeeNames.has(visit.master),
    );
  const certificateSaleOperations = financialOperations.filter((visit) => {
    const service = normalizeDayCloseText(visit.service);
    return (
      service.includes('сертификат') ||
      service.includes('сертифікат') ||
      service.includes('certyfikat') ||
      service.includes('certificate')
    );
  });
  const expenseOperations = financialOperations.filter(isDayCloseExpenseOperation);
  const incomeOperations = financialOperations.filter((visit) => !isDayCloseExpenseOperation(visit));
  const clientPackagePayloads = clientPackages.map(getPackagePayloadForDayClose);
  const packagesInPeriod = clientPackagePayloads.filter(
      (clientPackage) =>
        isInPayrollPeriod(clientPackage.purchaseDate, normalizedStart, normalizedEnd) &&
        employeeNames.has(clientPackage.master),
  );
  const rows = filteredEmployees
    .map((employee) => {
      const employeeVisits = completedVisits.filter((visit) => visit.master === employee.name);
      const employeePackages = packagesInPeriod.filter((item) => item.master === employee.name);
      const employeeCertificateSales = certificateSaleOperations.filter(
        (visit) => visit.master === employee.name,
      );
      const employeeJournalOperations = financialOperations.filter(
        (visit) => visit.master === employee.name,
      );
      let servicePayout = 0;
      let packageVisitPayout = 0;
      let tips = 0;

      for (const visit of employeeVisits) {
        tips += getDayCloseTipAmount(visit);

        if (isDayClosePackageVisit(visit)) {
          packageVisitPayout += getDayClosePackageVisitEmployeePayout(
            visit,
            filteredEmployees,
            clientPackagePayloads,
          );
        } else {
          servicePayout += getDayCloseEmployeePayout(visit, filteredEmployees);
        }
      }

      const packageSalePayout = employeePackages.reduce(
        (sum, item) => sum + getDayClosePackageSaleEmployeePayout(item, filteredEmployees),
        0,
      );
      const totalPayout = servicePayout + packageVisitPayout + packageSalePayout;

      return {
        commissionRate: dayCloseToFinanceNumber(employee.commissionRate),
        employeeId: employee.id,
        employeeName: employee.name,
        certificateSalesAmount: employeeCertificateSales.reduce(
          (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
          0,
        ),
        certificateSalesCount: employeeCertificateSales.length,
        journalOperationsAmount: employeeJournalOperations.reduce(
          (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
          0,
        ),
        journalOperationsCount: employeeJournalOperations.length,
        packageSalePayout,
        packageSalesCount: employeePackages.length,
        packageVisitPayout,
        servicePayout,
        tips,
        totalPayout,
        visitsCount: employeeVisits.length,
      };
    })
    .filter(
      (row) =>
        row.totalPayout > 0 ||
        row.tips > 0 ||
        row.visitsCount > 0 ||
        row.packageSalesCount > 0,
    )
    .sort((left, right) => right.totalPayout - left.totalPayout);
  const totals = rows.reduce(
    (summary, row) => ({
      packageSalePayout: summary.packageSalePayout + row.packageSalePayout,
      packageVisitPayout: summary.packageVisitPayout + row.packageVisitPayout,
      certificateSalesAmount: summary.certificateSalesAmount + row.certificateSalesAmount,
      certificateSalesCount: summary.certificateSalesCount + row.certificateSalesCount,
      journalOperationsAmount: summary.journalOperationsAmount + row.journalOperationsAmount,
      journalOperationsCount: summary.journalOperationsCount + row.journalOperationsCount,
      servicePayout: summary.servicePayout + row.servicePayout,
      tips: summary.tips + row.tips,
      totalPayout: summary.totalPayout + row.totalPayout,
      visitsCount: summary.visitsCount + row.visitsCount,
    }),
    {
      packageSalePayout: 0,
      packageVisitPayout: 0,
      certificateSalesAmount: 0,
      certificateSalesCount: 0,
      journalOperationsAmount: 0,
      journalOperationsCount: 0,
      servicePayout: 0,
      tips: 0,
      totalPayout: 0,
      visitsCount: 0,
    },
  );
  totals.journalIncome = incomeOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  totals.journalExpenses = expenseOperations.reduce(
    (sum, visit) =>
      sum + Math.abs(dayCloseToFinanceNumber(visit.extra) || dayCloseToFinanceNumber(visit.amount)),
    0,
  );
  totals.certificateSalesAmount = certificateSaleOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  totals.certificateSalesCount = certificateSaleOperations.length;

  return {
    employees: rows,
    endDate: normalizedEnd,
    employeeId: employeeIdNumber || null,
    periodKey: buildPayrollPeriodKey(normalizedStart, normalizedEnd),
    startDate: normalizedStart,
    totals,
  };
};

const buildServerPayrollRecordData = ({employeeId = null, note = '', report}) => ({
  employeeId: employeeId ? Number(employeeId) : null,
  employeeName:
    report.employees.length === 1 ? cleanOptionalString(report.employees[0].employeeName) : null,
  startDate: report.startDate,
  endDate: report.endDate,
  periodKey: employeeId ? `${report.periodKey}:employee:${Number(employeeId)}` : report.periodKey,
  amount: dayCloseToFinanceNumber(report?.totals?.totalPayout),
  status: 'paid',
  paidAt: new Date(),
  note: cleanOptionalString(note),
  payload: {
    endDate: report.endDate,
    employeeId: employeeId ? Number(employeeId) : null,
    note: String(note ?? '').trim(),
    paidAt: new Date().toISOString(),
    periodKey: employeeId ? `${report.periodKey}:employee:${Number(employeeId)}` : report.periodKey,
    report,
    startDate: report.startDate,
    status: 'paid',
  },
});

const systemStateRecord = (record) => [record.key, record.payload];

// ==================== Visit state used by the CRM UI ====================
router.get('/visit-state', async (req, res) => {
  try {
    const [calendarEntries, visits] = await Promise.all([
      prisma.calendarEntry.findMany({orderBy: [{date: 'asc'}, {time: 'asc'}, {id: 'asc'}]}),
      prisma.visit.findMany({orderBy: {createdAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        calendarEntries: calendarEntries.map(withStoredId),
        visits: visits.map(withStoredId),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Visit state error:', err);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/calendar-entries', (req, res) => {
  const payload = req.body ?? {};
  auditCreate(
    req,
    res,
    prisma.calendarEntry
      .create({data: buildCalendarEntryData(payload)})
      .then(withStoredId),
    'CalendarEntry',
    payload.kind === 'visit' ? 'create visit' : 'create calendar entry',
  );
});

router.put('/calendar-entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  auditUpdate(
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry
      .update({where: {id}, data: buildCalendarEntryData(payload)})
      .then(withStoredId)
    ,
    'CalendarEntry',
    payload.kind === 'visit' ? 'update visit' : 'update calendar entry',
  );
});

router.delete('/calendar-entries/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry.delete({where: {id}}).then(withStoredId),
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
        where: {id: calendarEntryId},
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
        visit = await tx.visit.findUnique({where: {id: requestedVisitId}});

        if (visit && Number(visit.calendarEntryId) !== calendarEntryId) {
          throw validationError('Visit does not belong to calendar entry');
        }
      }

      if (!visit && calendarEntry.visitId) {
        visit = await tx.visit.findUnique({where: {id: calendarEntry.visitId}});
      }

      if (!visit) {
        visit = await tx.visit.findFirst({
          where: {calendarEntryId},
          orderBy: {id: 'asc'},
        });
      }

      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      if (visit) {
        const packageUsages = await tx.clientPackageUsage.findMany({
          where: {visitId: visit.id},
        });
        const certificateUsages = await tx.certificateUsage.findMany({
          where: {visitId: visit.id},
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
            where: {id: usage.clientPackageId},
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
            where: {id: usage.clientPackageId},
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
            where: {id: usage.id},
            data: {revertedAt: new Date()},
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
            where: {id: usage.certificateId},
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
            where: {id: usage.certificateId},
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
            where: {id: usage.id},
            data: {revertedAt: new Date()},
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

        await tx.visit.delete({where: {id: visit.id}});
      }

      const deletedCalendarEntry = await tx.calendarEntry.delete({
        where: {id: calendarEntryId},
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

    res.json({success: true, data: result});
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
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/visits/complete', async (req, res) => {
  const body = req.body ?? {};
  const calendarEntryId = Number(body.calendarEntryId ?? body.visit?.calendarEntryId);
  const completedAt = body.completedAt ?? body.calendarEntryPatch?.completedAt ?? new Date().toISOString();
  const visitPayload = {
    ...(body.visit ?? body),
    calendarEntryId,
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
        where: {id: calendarEntryId},
      });

      if (!calendarEntry) {
        const error = new Error('Calendar entry not found');
        error.status = 404;
        throw error;
      }

      if (calendarEntry.status === 'completed' && calendarEntry.visitId) {
        const existingCompletedVisit = await tx.visit.findUnique({
          where: {id: calendarEntry.visitId},
        });

        if (existingCompletedVisit) {
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
              where: {id: clientPackageId},
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
              where: {id: certificateId},
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
            visit: withStoredId(existingCompletedVisit),
          };
        }
      }

      const existingVisit = await tx.visit.findFirst({
        where: {calendarEntryId},
        orderBy: {id: 'asc'},
      });
      const visit = existingVisit ?? await tx.visit.create({
        data: buildVisitData(visitPayload),
      });
      let clientPackage = null;
      let clientPackageUsage = null;
      let clientPackageBefore = null;
      let certificate = null;
      let certificateUsage = null;
      let certificateBefore = null;

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
            where: {id: clientPackageId},
          });
        }

        const shouldApplyPackageUsage =
          !clientPackageUsage || Boolean(clientPackageUsage.revertedAt);

        if (shouldApplyPackageUsage) {
          clientPackageBefore = await tx.clientPackage.findUnique({
            where: {id: clientPackageId},
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
              remainingVisits: {gte: packageSessionsUsed},
            },
            data: {
              remainingVisits: {decrement: packageSessionsUsed},
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
                where: {id: clientPackageUsage.id},
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
            where: {id: clientPackageId},
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
            where: {id: certificateId},
          });
        }

        const shouldApplyCertificateUsage =
          !certificateUsage || Boolean(certificateUsage.revertedAt);

        if (shouldApplyCertificateUsage) {
          certificateBefore = await tx.certificate.findUnique({
            where: {id: certificateId},
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
              remainingBalance: {gte: certificateAmountUsed},
            },
            data: {
              remainingBalance: {decrement: certificateAmountUsed},
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
                where: {id: certificateUsage.id},
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
            where: {id: certificateId},
          });
        }
      }

      const calendarPayload =
        calendarEntry.payload && typeof calendarEntry.payload === 'object'
          ? calendarEntry.payload
          : {};
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: {id: calendarEntryId},
        data: buildCalendarEntryData({
          ...calendarPayload,
          completedAt,
          status: 'completed',
          visitId: visit.id,
        }),
      });
      const data = {
        calendarEntry: withStoredId(updatedCalendarEntry),
        certificate: certificate ? withStoredId(certificate) : null,
        certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
        clientPackage: clientPackage ? withStoredId(clientPackage) : null,
        clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
        idempotent: false,
        visit: withStoredId(visit),
      };

      await recordAuditLog(tx, req, {
        action: 'complete visit',
        after: data,
        entity: 'Visit',
        entityId: visit.id,
      });

      if (usesPackage && clientPackage) {
        await recordAuditLog(tx, req, {
          action: 'use package',
          after: {
            clientPackage: withStoredId(clientPackage),
            clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
          },
          before: clientPackageBefore ? withStoredId(clientPackageBefore) : null,
          entity: 'ClientPackage',
          entityId: clientPackage.id,
        });
      }

      if (usesCertificate && certificate) {
        await recordAuditLog(tx, req, {
          action: 'use certificate',
          after: {
            certificate: withStoredId(certificate),
            certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
          },
          before: certificateBefore ? withStoredId(certificateBefore) : null,
          entity: 'Certificate',
          entityId: certificate.id,
        });
      }

      return data;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Complete visit error:', err);
    await recordErrorEvent(prisma, {
      context: {
        calendarEntryId,
        path: req.originalUrl,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
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
        tx.visit.findUnique({where: {id: visitId}}),
        tx.calendarEntry.findUnique({where: {id: calendarEntryId}}),
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
        tx.clientPackageUsage.findMany({where: {visitId}}),
        tx.certificateUsage.findMany({where: {visitId}}),
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
          where: {id: usage.clientPackageId},
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
          where: {id: usage.clientPackageId},
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
          where: {id: usage.id},
          data: {revertedAt: new Date()},
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
          where: {id: clientPackageId},
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
            remainingVisits: {gte: packageSessionsUsed},
          },
          data: {
            remainingVisits: {decrement: packageSessionsUsed},
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
              where: {id: existingUsage.id},
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
          where: {id: clientPackageId},
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
          where: {id: usage.certificateId},
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
          where: {id: usage.certificateId},
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
          where: {id: usage.id},
          data: {revertedAt: new Date()},
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
          where: {id: certificateId},
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
            remainingBalance: {gte: certificateAmountUsed},
          },
          data: {
            remainingBalance: {decrement: certificateAmountUsed},
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
              where: {id: existingUsage.id},
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
          where: {id: certificateId},
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
        where: {id: visitId},
        data: buildVisitData(visitPayload),
      });
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: {id: calendarEntryId},
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
        visit: withStoredId(updatedVisit),
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

    res.json({success: true, data: result});
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
    res.status(response.status).json({success: false, error: response.message});
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
        where: {id: calendarEntryId},
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
        visit = await tx.visit.findUnique({where: {id: requestedVisitId}});
      }

      if (!visit && calendarEntry.visitId) {
        visit = await tx.visit.findUnique({where: {id: calendarEntry.visitId}});
      }

      if (!visit) {
        visit = await tx.visit.findFirst({
          where: {calendarEntryId},
          orderBy: {id: 'asc'},
        });
      }

      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      if (visit) {
        const packageUsages = await tx.clientPackageUsage.findMany({
          where: {visitId: visit.id},
        });
        const certificateUsages = await tx.certificateUsage.findMany({
          where: {visitId: visit.id},
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
            where: {id: usage.clientPackageId},
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
            where: {id: usage.clientPackageId},
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
            where: {id: usage.id},
            data: {revertedAt: new Date()},
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
            where: {id: usage.certificateId},
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
            where: {id: usage.certificateId},
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
            where: {id: usage.id},
            data: {revertedAt: new Date()},
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

        await tx.visit.delete({where: {id: visit.id}});
      }

      const calendarPayload =
        calendarEntry.payload && typeof calendarEntry.payload === 'object'
          ? calendarEntry.payload
          : {};
      const updatedCalendarEntry = await tx.calendarEntry.update({
        where: {id: calendarEntryId},
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

    res.json({success: true, data: result});
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
    res.status(response.status).json({success: false, error: response.message});
  }
});

const buildJournalFinancialResponse = ({
  certificate = null,
  certificateUsage = null,
  clientPackage = null,
  clientPackageUsage = null,
  restoredCertificates = [],
  restoredCertificateUsages = [],
  restoredClientPackages = [],
  restoredPackageUsages = [],
  visit,
}) => ({
  certificate: certificate ? withStoredId(certificate) : null,
  certificateUsage: certificateUsage ? withStoredId(certificateUsage) : null,
  clientPackage: clientPackage ? withStoredId(clientPackage) : null,
  clientPackageUsage: clientPackageUsage ? withStoredId(clientPackageUsage) : null,
  restoredCertificates: restoredCertificates.map(withStoredId),
  restoredCertificateUsages: restoredCertificateUsages.filter(Boolean).map(withStoredId),
  restoredClientPackages: restoredClientPackages.map(withStoredId),
  restoredPackageUsages: restoredPackageUsages.filter(Boolean).map(withStoredId),
  visit: withStoredId(visit),
});

router.post('/visits/journal/financial', async (req, res) => {
  const visitPayload = req.body?.visit ?? req.body ?? {};
  const usesPackage = isPackageCompletePayment(visitPayload);
  const usesCertificate = isCertificateCompletePayment(visitPayload);

  try {
    validateVisitPayload(visitPayload);
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({data: buildVisitData(visitPayload)});
      let clientPackage = null;
      let clientPackageUsage = null;
      let certificate = null;
      let certificateUsage = null;

      if (usesPackage) {
        ({clientPackage, clientPackageUsage} = await applyClientPackageUsage(
          tx,
          req,
          visit.id,
          visitPayload,
          'journal-create',
        ));
      }

      if (usesCertificate) {
        ({certificate, certificateUsage} = await applyCertificateUsage(
          tx,
          req,
          visit.id,
          visitPayload,
          'journal-create',
        ));
      }

      const data = buildJournalFinancialResponse({
        certificate,
        certificateUsage,
        clientPackage,
        clientPackageUsage,
        visit,
      });

      await recordAuditLog(tx, req, {
        action: visitPayload.recordType === 'operation' ? 'create payment' : 'create visit',
        after: data,
        entity: 'Visit',
        entityId: visit.id,
      });

      return data;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Create journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: {path: req.originalUrl},
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.put('/visits/journal/:id/financial', async (req, res) => {
  const visitId = Number(req.params.id);
  const visitPayload = {...(req.body?.visit ?? req.body ?? {}), id: visitId};
  const newUsesPackage = isPackageCompletePayment(visitPayload);
  const newUsesCertificate = isCertificateCompletePayment(visitPayload);

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return sendValidationError(res, validationError('visitId is required'));
  }

  try {
    validateVisitPayload(visitPayload);
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({where: {id: visitId}});

      if (!visit) {
        const error = new Error('Visit not found');
        error.status = 404;
        throw error;
      }

      if (visit.calendarEntryId) {
        throw validationError('Calendar visits must be updated by completed visit endpoints');
      }

      const [packageUsages, certificateUsages] = await Promise.all([
        tx.clientPackageUsage.findMany({where: {visitId}}),
        tx.certificateUsage.findMany({where: {visitId}}),
      ]);
      const activePackageUsages = packageUsages.filter((item) => !item.revertedAt);
      const activeCertificateUsages = certificateUsages.filter((item) => !item.revertedAt);
      const oldPayloadUsesPackage = isPackageCompletePayment(visit.payload);
      const oldPayloadUsesCertificate = isCertificateCompletePayment(visit.payload);
      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];
      let clientPackage = null;
      let clientPackageUsage = null;
      let certificate = null;
      let certificateUsage = null;

      for (const usage of activePackageUsages) {
        const restored = await restoreClientPackageUsage(tx, req, visit, usage);
        restoredClientPackages = [...restoredClientPackages, restored.clientPackage];
        restoredPackageUsages = [...restoredPackageUsages, restored.clientPackageUsage];
      }

      if (oldPayloadUsesPackage && activePackageUsages.length === 0) {
        const restored = await restoreClientPackageUsage(tx, req, visit, null);
        restoredClientPackages = [...restoredClientPackages, restored.clientPackage];
      }

      for (const usage of activeCertificateUsages) {
        const restored = await restoreCertificateUsage(tx, req, visit, usage);
        restoredCertificates = [...restoredCertificates, restored.certificate];
        restoredCertificateUsages = [...restoredCertificateUsages, restored.certificateUsage];
      }

      if (oldPayloadUsesCertificate && activeCertificateUsages.length === 0) {
        const restored = await restoreCertificateUsage(tx, req, visit, null);
        restoredCertificates = [...restoredCertificates, restored.certificate];
      }

      if (newUsesPackage) {
        ({clientPackage, clientPackageUsage} = await applyClientPackageUsage(
          tx,
          req,
          visitId,
          visitPayload,
          'journal-update',
        ));
      }

      if (newUsesCertificate) {
        ({certificate, certificateUsage} = await applyCertificateUsage(
          tx,
          req,
          visitId,
          visitPayload,
          'journal-update',
        ));
      }

      const updatedVisit = await tx.visit.update({
        where: {id: visitId},
        data: buildVisitData(visitPayload),
      });
      const data = buildJournalFinancialResponse({
        certificate,
        certificateUsage,
        clientPackage,
        clientPackageUsage,
        restoredCertificates,
        restoredCertificateUsages,
        restoredClientPackages,
        restoredPackageUsages,
        visit: updatedVisit,
      });

      await recordAuditLog(tx, req, {
        action: visitPayload.recordType === 'operation' ? 'update payment' : 'update visit',
        after: data,
        before: withStoredId(visit),
        entity: 'Visit',
        entityId: updatedVisit.id,
      });

      return data;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Update journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: {path: req.originalUrl, visitId},
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/visits/journal/:id/delete-financial', requireOwner, async (req, res) => {
  const visitId = Number(req.params.id);

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return sendValidationError(res, validationError('visitId is required'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({where: {id: visitId}});

      if (!visit) {
        return {
          deletedVisitId: visitId,
          idempotent: true,
          restoredCertificates: [],
          restoredCertificateUsages: [],
          restoredClientPackages: [],
          restoredPackageUsages: [],
        };
      }

      if (visit.calendarEntryId) {
        throw validationError('Calendar visits must be deleted by completed visit endpoints');
      }

      const [packageUsages, certificateUsages] = await Promise.all([
        tx.clientPackageUsage.findMany({where: {visitId}}),
        tx.certificateUsage.findMany({where: {visitId}}),
      ]);
      const activePackageUsages = packageUsages.filter((item) => !item.revertedAt);
      const activeCertificateUsages = certificateUsages.filter((item) => !item.revertedAt);
      const oldPayloadUsesPackage = isPackageCompletePayment(visit.payload);
      const oldPayloadUsesCertificate = isCertificateCompletePayment(visit.payload);
      let restoredClientPackages = [];
      let restoredPackageUsages = [];
      let restoredCertificates = [];
      let restoredCertificateUsages = [];

      for (const usage of activePackageUsages) {
        const restored = await restoreClientPackageUsage(tx, req, visit, usage);
        restoredClientPackages = [...restoredClientPackages, restored.clientPackage];
        restoredPackageUsages = [...restoredPackageUsages, restored.clientPackageUsage];
      }

      if (oldPayloadUsesPackage && activePackageUsages.length === 0) {
        const restored = await restoreClientPackageUsage(tx, req, visit, null);
        restoredClientPackages = [...restoredClientPackages, restored.clientPackage];
      }

      for (const usage of activeCertificateUsages) {
        const restored = await restoreCertificateUsage(tx, req, visit, usage);
        restoredCertificates = [...restoredCertificates, restored.certificate];
        restoredCertificateUsages = [...restoredCertificateUsages, restored.certificateUsage];
      }

      if (oldPayloadUsesCertificate && activeCertificateUsages.length === 0) {
        const restored = await restoreCertificateUsage(tx, req, visit, null);
        restoredCertificates = [...restoredCertificates, restored.certificate];
      }

      await tx.visit.delete({where: {id: visitId}});
      const data = {
        deletedVisitId: visitId,
        idempotent: false,
        restoredCertificates: restoredCertificates.map(withStoredId),
        restoredCertificateUsages: restoredCertificateUsages.filter(Boolean).map(withStoredId),
        restoredClientPackages: restoredClientPackages.map(withStoredId),
        restoredPackageUsages: restoredPackageUsages.filter(Boolean).map(withStoredId),
      };

      await recordAuditLog(tx, req, {
        action: visit.recordType === 'operation' ? 'delete payment' : 'delete visit',
        after: data,
        before: withStoredId(visit),
        entity: 'Visit',
        entityId: visitId,
      });

      return data;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: {path: req.originalUrl, visitId},
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/visits/journal', (req, res) => {
  const payload = req.body ?? {};
  try {
    validateVisitPayload(payload);
  } catch (err) {
    return sendValidationError(res, err);
  }
  auditCreate(
    req,
    res,
    prisma.visit.create({data: buildVisitData(payload)}).then(withStoredId),
    'Visit',
    payload.recordType === 'operation' ? 'create payment' : 'create visit',
  );
});

router.put('/visits/journal/:id', async (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  try {
    validateVisitPayload(payload);
  } catch (err) {
    return sendValidationError(res, err);
  }
  await auditUpdate(
    req,
    res,
    'visit',
    id,
    prisma.visit.update({where: {id}, data: buildVisitData(payload)}).then(withStoredId),
    'Visit',
    payload.recordType === 'operation' ? 'update payment' : 'update visit',
  );
});

router.delete('/visits/journal/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'visit',
    id,
    prisma.visit.delete({where: {id}}).then(withStoredId),
    'Visit',
    'delete/cancel visit',
  );
});

// ==================== Client ====================
router.get('/clients', (req, res) => {
  respond(
    res,
    prisma.client.findMany({
      select: clientSelect,
      orderBy: { name: 'asc' },
    })
  );
});

router.post('/clients', (req, res) => {
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  auditCreate(req, res, prisma.client.create({ data, select: clientSelect }), 'Client', 'create client');
});

router.get('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.findUnique({ where: { id }, select: clientSelect }));
});

router.put('/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  await auditUpdate(
    req,
    res,
    'client',
    id,
    prisma.client.update({ where: { id }, data, select: clientSelect }),
    'Client',
    'update client',
  );
});

router.delete('/clients/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'client',
    id,
    prisma.client.delete({ where: { id } }),
    'Client',
    'delete/archive client',
  );
});


// ==================== Service ====================
router.post('/services', (req, res) => {
  const data = buildServiceData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  auditCreate(req, res, prisma.service.create({ data }).then(withStoredId), 'Service', 'create service');
});

router.get('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/services/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildServiceData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  await auditUpdate(
    req,
    res,
    'service',
    id,
    prisma.service.update({ where: { id }, data }).then(withStoredId),
    'Service',
    'update service',
  );
});

router.delete('/services/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'service',
    id,
    prisma.service.delete({ where: { id } }).then(withStoredId),
    'Service',
    'delete service',
  );
});

router.get('/services', (req, res) => {
  respond(
    res,
    prisma.service.findMany({orderBy: {name: 'asc'}}).then((records) =>
      records.map(withStoredId),
    ),
  );
});

// ==================== Employee ====================
router.post('/employees', requireOwner, (req, res) => {
  const data = buildEmployeeData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  auditCreate(req, res, prisma.employee.create({ data }).then(withStoredId), 'Employee', 'create employee');
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/employees/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const data = buildEmployeeData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  await auditUpdate(
    req,
    res,
    'employee',
    id,
    prisma.employee.update({ where: { id }, data }).then(withStoredId),
    'Employee',
    'update employee',
  );
});

router.delete('/employees/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'employee',
    id,
    prisma.employee.delete({ where: { id } }).then(withStoredId),
    'Employee',
    'delete employee',
  );
});

router.get('/employees', (req, res) => {
  respond(
    res,
    prisma.employee.findMany({orderBy: {name: 'asc'}}).then((records) =>
      records.map(withStoredId),
    ),
  );
});

// ==================== Visit ====================
router.post('/visits', (req, res) => {
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  auditCreate(
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
  await auditDelete(
    req,
    res,
    'visit',
    id,
    prisma.visit.delete({ where: { id } }),
    'Visit',
    'delete/cancel visit',
  );
});

router.get('/visits', (req, res) => {
  respond(res, prisma.visit.findMany());
});

// ==================== Task ====================
router.post('/tasks', (req, res) => {
  const data = buildTaskData(req.body ?? {});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  auditCreate(req, res, prisma.task.create({data}).then(withStoredId), 'Task', 'create task');
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildTaskData({...(req.body ?? {}), id});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  await auditUpdate(
    req,
    res,
    'task',
    id,
    prisma.task.update({where: {id}, data}).then(withStoredId),
    'Task',
    'update task',
  );
});

router.delete('/tasks/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'task',
    id,
    prisma.task.delete({ where: { id } }).then(withStoredId),
    'Task',
    'delete task',
  );
});

router.get('/tasks', (req, res) => {
  respond(
    res,
    prisma.task
      .findMany({orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}]})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Waitlist ====================
router.post('/waitlist', (req, res) => {
  const data = buildWaitlistEntryData(req.body ?? {});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  auditCreate(
    req,
    res,
    prisma.waitlistEntry.create({data}).then(withStoredId),
    'WaitlistEntry',
    'create waitlist entry',
  );
});

router.get('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.waitlistEntry.findUnique({where: {id}}).then(withStoredId));
});

router.put('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildWaitlistEntryData({...(req.body ?? {}), id});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  await auditUpdate(
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({where: {id}, data}).then(withStoredId),
    'WaitlistEntry',
    'update waitlist entry',
  );
});

router.delete('/waitlist/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.delete({where: {id}}).then(withStoredId),
    'WaitlistEntry',
    'delete waitlist entry',
  );
});

router.get('/waitlist', (req, res) => {
  respond(
    res,
    prisma.waitlistEntry
      .findMany({orderBy: {createdAt: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Supply ====================
router.post('/supplies', (req, res) => {
  const data = buildSupplyData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  auditCreate(req, res, prisma.supply.create({data}).then(withStoredId), 'Supply', 'create supply');
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({where: {id}}).then(withStoredId));
});

router.put('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildSupplyData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  await auditUpdate(
    req,
    res,
    'supply',
    id,
    prisma.supply.update({where: {id}, data}).then(withStoredId),
    'Supply',
    'update supply',
  );
});

router.delete('/supplies/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'supply',
    id,
    prisma.supply.delete({where: {id}}).then(withStoredId),
    'Supply',
    'delete supply',
  );
});

router.get('/supplies', (req, res) => {
  respond(
    res,
    prisma.supply
      .findMany({orderBy: {name: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Operations state and messaging ====================
router.get('/operations-state', async (req, res) => {
  try {
    const [
      tasks,
      supplies,
      waitlistEntries,
      messageTemplates,
      communicationLog,
    ] = await Promise.all([
      prisma.task
        .findMany({orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}]}),
      prisma.supply.findMany({orderBy: {name: 'asc'}}),
      prisma.waitlistEntry.findMany({orderBy: {createdAt: 'asc'}}),
      prisma.messageTemplate.findMany({orderBy: {name: 'asc'}}),
      prisma.communicationLog.findMany({orderBy: {createdAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        communicationLog: communicationLog.map(withStoredId),
        messageTemplates: messageTemplates.map(withStoredId),
        supplies: supplies.map(withStoredId),
        tasks: tasks.map(withStoredId),
        waitlistEntries: waitlistEntries.map(withStoredId),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Operations state error:', err);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/message-templates', (req, res) => {
  const data = buildMessageTemplateData(req.body ?? {});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  auditCreate(
    req,
    res,
    prisma.messageTemplate.create({data}).then(withStoredId),
    'MessageTemplate',
    'create message template',
  );
});

router.get('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/message-templates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildMessageTemplateData({...(req.body ?? {}), id});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  await auditUpdate(
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.update({where: {id}, data}).then(withStoredId),
    'MessageTemplate',
    'update message template',
  );
});

router.delete('/message-templates/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.delete({where: {id}}).then(withStoredId),
    'MessageTemplate',
    'delete message template',
  );
});

router.get('/message-templates', (req, res) => {
  respond(
    res,
    prisma.messageTemplate
      .findMany({orderBy: {name: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

router.post('/communication-log', (req, res) => {
  const data = buildCommunicationLogData(req.body ?? {});
  if (!data.clientName && !data.body) {
    return res.status(400).json({ success: false, error: 'Communication log entry is empty' });
  }

  auditCreate(
    req,
    res,
    prisma.communicationLog.create({data}).then(withStoredId),
    'CommunicationLog',
    'create communication log',
  );
});

router.get('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.communicationLog.findUnique({where: {id}}).then(withStoredId));
});

router.put('/communication-log/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCommunicationLogData({...(req.body ?? {}), id});
  await auditUpdate(
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.update({where: {id}, data}).then(withStoredId),
    'CommunicationLog',
    'update communication log',
  );
});

router.delete('/communication-log/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.delete({where: {id}}).then(withStoredId),
    'CommunicationLog',
    'delete communication log',
  );
});

router.get('/communication-log', (req, res) => {
  respond(
    res,
    prisma.communicationLog
      .findMany({orderBy: {createdAt: 'desc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Financial core ====================
router.get('/financial-state', async (req, res) => {
  try {
    const [
      packages,
      clientPackages,
      certificates,
      dayCloseRecords,
      payrollRecords,
    ] = await Promise.all([
      prisma.package.findMany({orderBy: {name: 'asc'}}),
      prisma.clientPackage.findMany({orderBy: {createdAt: 'desc'}}),
      prisma.certificate.findMany({orderBy: {createdAt: 'desc'}}),
      prisma.dayCloseRecord.findMany({orderBy: {date: 'desc'}}),
      prisma.payrollRecord.findMany({orderBy: {paidAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        packages: packages.map(withStoredId),
        clientPackages: clientPackages.map(withStoredId),
        certificates: certificates.map(withStoredId),
        dayCloseRecords: dayCloseRecords.map(withStoredId),
        payrollRecords: payrollRecords.map(withStoredId),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Financial state error:', err);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/packages', (req, res) => {
  const data = buildPackageData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({success: false, error: 'Package name is required'});
  }

  auditCreate(req, res, prisma.package.create({data}).then(withStoredId), 'Package', 'create package');
});

router.get('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.package.findUnique({where: {id}}).then(withStoredId));
});

router.put('/packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildPackageData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({success: false, error: 'Package name is required'});
  }

  await auditUpdate(
    req,
    res,
    'package',
    id,
    prisma.package.update({where: {id}, data}).then(withStoredId),
    'Package',
    'update package',
  );
});

router.delete('/packages/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'package',
    id,
    prisma.package.delete({where: {id}}).then(withStoredId),
    'Package',
    'delete package',
  );
});

router.get('/packages', (req, res) => {
  respond(res, prisma.package.findMany({orderBy: {name: 'asc'}}).then((records) => records.map(withStoredId)));
});

router.post('/client-packages', (req, res) => {
  const data = buildClientPackageData(req.body ?? {});
  try {
    validateClientPackageData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  auditCreate(
    req,
    res,
    prisma.clientPackage.create({data}).then(withStoredId),
    'ClientPackage',
    'create package sale',
  );
});

router.get('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.clientPackage.findUnique({where: {id}}).then(withStoredId));
});

router.put('/client-packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientPackageData({...(req.body ?? {}), id});
  try {
    validateClientPackageData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  await auditUpdate(
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.update({where: {id}, data}).then(withStoredId),
    'ClientPackage',
    'use package',
  );
});

router.delete('/client-packages/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.delete({where: {id}}).then(withStoredId),
    'ClientPackage',
    'delete package sale',
  );
});

router.get('/client-packages', (req, res) => {
  respond(res, prisma.clientPackage.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/certificates/sell', async (req, res) => {
  const body = req.body ?? {};
  const certificatePayload = body.certificate ?? body;
  const visitPayload = body.visit ?? {};
  const certificateData = buildCertificateData(certificatePayload);

  try {
    validateCertificateData(certificateData);
    validateVisitPayload(visitPayload);

    if (!certificateData.code || !certificateData.clientName) {
      throw validationError('Certificate code and client are required');
    }
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const certificate = await tx.certificate.create({data: certificateData});
      const saleVisitPayload = {
        ...visitPayload,
        certificateId: certificate.id,
        recordType: visitPayload.recordType || 'operation',
        service: visitPayload.service || 'Продажа сертификата',
      };
      const visit = await tx.visit.create({
        data: buildVisitData(saleVisitPayload),
      });
      const certificatePayloadWithSale =
        certificate.payload && typeof certificate.payload === 'object'
          ? certificate.payload
          : {};
      const certificateWithSale = await tx.certificate.update({
        where: {id: certificate.id},
        data: {
          saleVisitId: visit.id,
          payload: {
            ...certificatePayloadWithSale,
            saleVisitId: visit.id,
          },
        },
      });
      const data = {
        certificate: withStoredId(certificateWithSale),
        visit: withStoredId(visit),
      };

      await recordAuditLog(tx, req, {
        action: 'sell certificate',
        after: data,
        before: null,
        entity: 'Certificate',
        entityId: certificateWithSale.id,
      });

      await recordAuditLog(tx, req, {
        action: 'create certificate sale payment',
        after: withStoredId(visit),
        before: null,
        entity: 'Visit',
        entityId: visit.id,
      });

      return data;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Sell certificate error:', err);
    await recordErrorEvent(prisma, {
      context: {
        path: req.originalUrl,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/certificates', (req, res) => {
  const data = buildCertificateData(req.body ?? {});
  try {
    validateCertificateData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  auditCreate(
    req,
    res,
    prisma.certificate.create({data}).then(withStoredId),
    'Certificate',
    'create certificate',
  );
});

router.get('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.certificate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/certificates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCertificateData({...(req.body ?? {}), id});
  try {
    validateCertificateData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  await auditUpdate(
    req,
    res,
    'certificate',
    id,
    prisma.certificate.update({where: {id}, data}).then(withStoredId),
    'Certificate',
    'use certificate',
  );
});

router.delete('/certificates/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'certificate',
    id,
    prisma.certificate.delete({where: {id}}).then(withStoredId),
    'Certificate',
    'delete certificate',
  );
});

router.get('/certificates', (req, res) => {
  respond(res, prisma.certificate.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/day-close-records/close', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const date = normalizeDayCloseDate(body.date);

  if (!date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  try {
    assertNonNegative(body.actualCashInDrawer, 'actualCashInDrawer');
    assertNonNegative(body.cashWithdrawal, 'cashWithdrawal');
  } catch (err) {
    return sendValidationError(res, err);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [visits, clientPackages, employees, existing] = await Promise.all([
        tx.visit.findMany(),
        tx.clientPackage.findMany(),
        tx.employee.findMany(),
        tx.dayCloseRecord.findUnique({where: {date}}),
      ]);
      const dayVisits = visits
        .map(getVisitPayloadForDayClose)
        .filter((visit) => isSameDayCloseDate(visit.date, date));
      const dayClientPackages = clientPackages
        .map(getPackagePayloadForDayClose)
        .filter((clientPackage) => isSameDayCloseDate(clientPackage.purchaseDate, date));
      const employeePayloads = employees.map(withStoredId);
      const journal = buildServerDayCloseJournal({
        clientPackages: dayClientPackages,
        employees: employeePayloads,
        visits: dayVisits,
      });
      const data = buildServerDayCloseRecordData({
        actualCashInDrawer: body.actualCashInDrawer,
        cashWithdrawal: body.cashWithdrawal,
        date,
        journal,
        note: body.note,
      });

      validateDayCloseRecordData(data);

      const record = existing
        ? await tx.dayCloseRecord.update({where: {id: existing.id}, data})
        : await tx.dayCloseRecord.create({data});
      const storedRecord = withStoredId(record);

      await recordAuditLog(tx, req, {
        action: existing ? 'update day close' : 'create day close',
        after: storedRecord,
        before: existing ? withStoredId(existing) : null,
        entity: 'DayCloseRecord',
        entityId: record.id,
      });

      return storedRecord;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Close day error:', err);
    await recordErrorEvent(prisma, {
      context: {
        date,
        path: req.originalUrl,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/day-close-records', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(req, res, {
    action: 'create day close',
    entity: 'DayCloseRecord',
    sourceOfTruth: 'POST /api/day-close-records/close',
  });
  if (allowed !== true) {
    return;
  }

  const data = buildDayCloseRecordData(req.body ?? {});
  try {
    validateDayCloseRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  auditCreate(
    req,
    res,
    prisma.dayCloseRecord.create({data}).then(withStoredId),
    'DayCloseRecord',
    'create day close',
  );
});

router.put('/day-close-records/:id', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(req, res, {
    action: 'update day close',
    entity: 'DayCloseRecord',
    sourceOfTruth: 'POST /api/day-close-records/close',
  });
  if (allowed !== true) {
    return;
  }

  const id = Number(req.params.id);
  const data = buildDayCloseRecordData({...(req.body ?? {}), id});
  try {
    validateDayCloseRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  await auditUpdate(
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.update({where: {id}, data}).then(withStoredId),
    'DayCloseRecord',
    'update day close',
  );
});

router.delete('/day-close-records/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.delete({where: {id}}).then(withStoredId),
    'DayCloseRecord',
    'delete day close',
  );
});

router.get('/day-close-records', (req, res) => {
  respond(res, prisma.dayCloseRecord.findMany({orderBy: {date: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.get('/payroll/summary', requireOwner, async (req, res) => {
  const startDate = normalizeDayCloseDate(req.query.dateFrom ?? req.query.startDate);
  const endDate = normalizeDayCloseDate(req.query.dateTo ?? req.query.endDate);
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

  if (!startDate || !endDate) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }
  if (employeeId !== null && (!Number.isFinite(employeeId) || employeeId <= 0)) {
    return sendValidationError(res, validationError('employeeId is invalid'));
  }

  try {
    const [visits, clientPackages, employees] = await Promise.all([
      prisma.visit.findMany(),
      prisma.clientPackage.findMany(),
      prisma.employee.findMany(),
    ]);
    const report = buildServerPayrollReport({
      clientPackages,
      employeeId,
      employees,
      endDate,
      startDate,
      visits,
    });

    res.json({success: true, data: report});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Payroll summary error:', err);
    await recordErrorEvent(prisma, {
      context: {
        employeeId,
        endDate,
        path: req.originalUrl,
        startDate,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/payroll/mark-paid', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const startDate = normalizeDayCloseDate(body.dateFrom ?? body.startDate);
  const endDate = normalizeDayCloseDate(body.dateTo ?? body.endDate);
  const employeeId = body.employeeId ? Number(body.employeeId) : null;

  if (!startDate || !endDate) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }
  if (employeeId !== null && (!Number.isFinite(employeeId) || employeeId <= 0)) {
    return sendValidationError(res, validationError('employeeId is invalid'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [visits, clientPackages, employees] = await Promise.all([
        tx.visit.findMany(),
        tx.clientPackage.findMany(),
        tx.employee.findMany(),
      ]);
      const report = buildServerPayrollReport({
        clientPackages,
        employeeId,
        employees,
        endDate,
        startDate,
        visits,
      });
      const data = buildServerPayrollRecordData({
        employeeId,
        note: body.note,
        report,
      });

      validatePayrollRecordData(data);

      const existing = await tx.payrollRecord.findUnique({
        where: {periodKey: data.periodKey},
      });
      const record = existing
        ? await tx.payrollRecord.update({where: {id: existing.id}, data})
        : await tx.payrollRecord.create({data});
      const storedRecord = withStoredId(record);

      await recordAuditLog(tx, req, {
        action: existing ? 'update payroll record' : 'create payroll record',
        after: storedRecord,
        before: existing ? withStoredId(existing) : null,
        entity: 'PayrollRecord',
        entityId: record.id,
      });

      return storedRecord;
    });

    res.json({success: true, data: result});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Payroll mark paid error:', err);
    await recordErrorEvent(prisma, {
      context: {
        employeeId,
        endDate,
        path: req.originalUrl,
        startDate,
      },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/payroll-records', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(req, res, {
    action: 'create payroll record',
    entity: 'PayrollRecord',
    sourceOfTruth: 'POST /api/payroll/mark-paid',
  });
  if (allowed !== true) {
    return;
  }

  const data = buildPayrollRecordData(req.body ?? {});
  try {
    validatePayrollRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  auditCreate(
    req,
    res,
    prisma.payrollRecord.create({data}).then(withStoredId),
    'PayrollRecord',
    'create payroll record',
  );
});

router.put('/payroll-records/:id', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(req, res, {
    action: 'update payroll record',
    entity: 'PayrollRecord',
    sourceOfTruth: 'POST /api/payroll/mark-paid',
  });
  if (allowed !== true) {
    return;
  }

  const id = Number(req.params.id);
  const data = buildPayrollRecordData({...(req.body ?? {}), id});
  try {
    validatePayrollRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  await auditUpdate(
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.update({where: {id}, data}).then(withStoredId),
    'PayrollRecord',
    'update payroll record',
  );
});

router.delete('/payroll-records/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.delete({where: {id}}).then(withStoredId),
    'PayrollRecord',
    'delete payroll record',
  );
});

router.get('/payroll-records', (req, res) => {
  respond(res, prisma.payrollRecord.findMany({orderBy: {paidAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

// ==================== System state ====================
router.get('/system-state', (req, res) => {
  respond(
    res,
    prisma.systemState.findMany({orderBy: {key: 'asc'}}).then((records) =>
      Object.fromEntries(records.map(systemStateRecord)),
    ),
  );
});

router.get('/system-state/:key', (req, res) => {
  const key = String(req.params.key ?? '').trim();
  respond(res, prisma.systemState.findUnique({where: {key}}).then((record) => record?.payload ?? null));
});

router.put('/system-state/:key', requireOwner, async (req, res) => {
  const key = String(req.params.key ?? '').trim();
  const payload = req.body?.payload ?? req.body ?? null;

  if (!key) {
    return res.status(400).json({success: false, error: 'System state key is required'});
  }

  const before = key
    ? await prisma.systemState.findUnique({where: {key}}).then((record) => record?.payload ?? null)
    : null;

  respondWithAudit(
    req,
    res,
    prisma.systemState
      .upsert({
        where: {key},
        create: {key, payload},
        update: {payload},
      })
      .then((record) => record.payload),
    {
      action: 'update settings',
      before,
      entity: 'SystemState',
      entityId: key,
    },
  );
});

router.put('/system-state', requireOwner, async (req, res) => {
  const entries = req.body?.entries ?? req.body ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return res.status(400).json({success: false, error: 'System state entries object is required'});
  }

  try {
    const beforeRecords = await prisma.systemState.findMany({
      where: {key: {in: Object.keys(entries)}},
    });
    const before = Object.fromEntries(beforeRecords.map(systemStateRecord));

    await prisma.$transaction(
      Object.entries(entries).map(([key, payload]) =>
        prisma.systemState.upsert({
          where: {key},
          create: {key, payload},
          update: {payload},
        }),
      ),
    );

    await recordAuditLog(prisma, req, {
      action: 'update settings',
      after: entries,
      before,
      entity: 'SystemState',
      entityId: 'bulk',
    });

    res.json({success: true, data: entries});
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('System state error:', err);
    res.status(response.status).json({success: false, error: response.message});
  }
});

module.exports = router;
