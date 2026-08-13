const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const {
  VISIT_WITH_EARNING_INCLUDE,
  assertVisitCanBeRemoved,
  removeUnpaidEmployeeEarningForVisit,
  serializeVisitWithEarning,
  syncEmployeeEarningForCompletedVisit,
} = require('../services/employeeEarningsService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  getRouteId,
  withStoredId,
  validationError,
  sendValidationError,
  assertNonNegative,
  requireLegacyFinancialWriteFlag,
} = require('../utils/crudHelpers');
const {
  normalizeDayCloseDate,
  isSameDayCloseDate,
  getVisitPayloadForDayClose,
  getPackagePayloadForDayClose,
  buildServerDayCloseJournal,
  buildServerDayCloseRecordData,
  objectPayload,
} = require('../utils/financeHelpers');

const prisma = new PrismaClient();

// ----- Helper methods for client package status -----
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

// ----- Local helpers for visits payment state check -----
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

const validateVisitPayload = (payload) => {
  assertNonNegative(payload?.amount, 'amount');
  assertNonNegative(payload?.paidAmount, 'paidAmount');
  assertNonNegative(payload?.discount, 'discount');
  assertNonNegative(payload?.debt, 'debt');
  assertNonNegative(payload?.tip, 'tip');
  assertNonNegative(payload?.extra, 'extra');
  assertNonNegative(payload?.certificateAmountUsed, 'certificateAmountUsed');
};

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

// ----- Apply and restore package/certificate ledger helpers -----
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
    ? { clientPackageId: usage.clientPackageId, sessionsUsed: Number(usage.sessionsUsed) || 1 }
    : getVisitPackageInfo(visit);

  if (!Number.isFinite(info.clientPackageId) || info.clientPackageId <= 0) {
    throw validationError('Client package usage is missing');
  }

  const packageBefore = await tx.clientPackage.findUnique({
    where: { id: info.clientPackageId },
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
    where: { id: info.clientPackageId },
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
        where: { id: usage.id },
        data: { revertedAt: new Date() },
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

  return { clientPackage: restoredPackage, clientPackageUsage: restoredUsage };
};

const restoreCertificateUsage = async (tx, req, visit, usage) => {
  const info = usage
    ? { amount: Number(usage.amount) || 0, certificateId: usage.certificateId }
    : getVisitCertificateInfo(visit);

  if (!Number.isFinite(info.certificateId) || info.certificateId <= 0) {
    throw validationError('Certificate usage is missing');
  }

  const certificateBefore = await tx.certificate.findUnique({
    where: { id: info.certificateId },
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
    where: { id: info.certificateId },
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
        where: { id: usage.id },
        data: { revertedAt: new Date() },
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

  return { certificate: restoredCertificate, certificateUsage: restoredUsage };
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
    where: { id: clientPackageId },
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
      remainingVisits: { gte: sessionsUsed },
    },
    data: {
      remainingVisits: { decrement: sessionsUsed },
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
        where: { id: existingUsage.id },
        data: {
          payload: { reason },
          revertedAt: null,
          sessionsUsed,
        },
      })
    : await tx.clientPackageUsage.create({
        data: {
          clientPackageId,
          payload: { reason },
          sessionsUsed,
          visitId,
        },
      });
  const clientPackage = await tx.clientPackage.findUnique({
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

  return { clientPackage, clientPackageUsage };
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
    where: { id: certificateId },
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
      remainingBalance: { gte: amount },
    },
    data: {
      remainingBalance: { decrement: amount },
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
        where: { id: existingUsage.id },
        data: {
          amount,
          payload: { reason },
          revertedAt: null,
        },
      })
    : await tx.certificateUsage.create({
        data: {
          amount,
          certificateId,
          payload: { reason },
          visitId,
        },
      });
  const certificate = await tx.certificate.findUnique({
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

  return { certificate, certificateUsage };
};

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
  visit: serializeVisitWithEarning(visit),
});

// ----- Data builder and validator functions -----
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

const validateClientPackageData = (data) => {
  assertNonNegative(data.remainingVisits, 'remainingVisits');
  assertNonNegative(data.price, 'price');
};

const validateCertificateData = (data) => {
  assertNonNegative(data.nominal, 'nominal');
  assertNonNegative(data.remainingBalance, 'remainingBalance');
};

const validateDayCloseRecordData = (data) => {
  assertNonNegative(data.cash, 'cash');
  assertNonNegative(data.card, 'card');
  assertNonNegative(data.blik, 'blik');
  assertNonNegative(data.certificates, 'certificates');
  assertNonNegative(data.packages, 'packages');
  assertNonNegative(data.total, 'total');
};

// ==================== Financial core endpoint ====================
router.get('/financial-state', async (req, res) => {
  try {
    const [
      packages,
      clientPackages,
      certificates,
      dayCloseRecords,
      payrollRecords,
    ] = await Promise.all([
      prisma.package.findMany({ orderBy: { name: 'asc' } }),
      prisma.clientPackage.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.certificate.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.dayCloseRecord.findMany({ orderBy: { date: 'desc' } }),
      prisma.payrollRecord.findMany({ orderBy: { paidAt: 'desc' } }),
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
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// ==================== Client Packages CRUD ====================
router.post('/client-packages', (req, res) => {
  const data = buildClientPackageData(req.body ?? {});
  try {
    validateClientPackageData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({ success: false, error: 'Client package requires client and package' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.clientPackage.create({ data }).then(withStoredId),
    'ClientPackage',
    'create package sale',
  );
});

router.get('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.clientPackage.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/client-packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientPackageData({ ...(req.body ?? {}), id });
  try {
    validateClientPackageData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({ success: false, error: 'Client package requires client and package' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.update({ where: { id }, data }).then(withStoredId),
    'ClientPackage',
    'use package',
  );
});

router.delete('/client-packages/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.delete({ where: { id } }).then(withStoredId),
    'ClientPackage',
    'delete package sale',
  );
});

router.get('/client-packages', (req, res) => {
  respond(res, prisma.clientPackage.findMany({ orderBy: { createdAt: 'desc' } }).then((records) => records.map(withStoredId)));
});

// ==================== Certificates Sales & CRUD ====================
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
      const certificate = await tx.certificate.create({ data: certificateData });
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
        where: { id: certificate.id },
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

    res.json({ success: true, data: result });
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
    res.status(response.status).json({ success: false, error: response.message });
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
    return res.status(400).json({ success: false, error: 'Certificate code and client are required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.certificate.create({ data }).then(withStoredId),
    'Certificate',
    'create certificate',
  );
});

router.get('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.certificate.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/certificates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCertificateData({ ...(req.body ?? {}), id });
  try {
    validateCertificateData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.code || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Certificate code and client are required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'certificate',
    id,
    prisma.certificate.update({ where: { id }, data }).then(withStoredId),
    'Certificate',
    'use certificate',
  );
});

router.delete('/certificates/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'certificate',
    id,
    prisma.certificate.delete({ where: { id } }).then(withStoredId),
    'Certificate',
    'delete certificate',
  );
});

router.get('/certificates', (req, res) => {
  respond(res, prisma.certificate.findMany({ orderBy: { createdAt: 'desc' } }).then((records) => records.map(withStoredId)));
});

// ==================== Day Close Records ====================
router.post('/day-close-records/close', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const date = normalizeDayCloseDate(body.date);

  if (!date) {
    return res.status(400).json({ success: false, error: 'Day close date is required' });
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
        tx.dayCloseRecord.findUnique({ where: { date } }),
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
        ? await tx.dayCloseRecord.update({ where: { id: existing.id }, data })
        : await tx.dayCloseRecord.create({ data });
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

    res.json({ success: true, data: result });
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
    res.status(response.status).json({ success: false, error: response.message });
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
    return res.status(400).json({ success: false, error: 'Day close date is required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.dayCloseRecord.create({ data }).then(withStoredId),
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
  const data = buildDayCloseRecordData({ ...(req.body ?? {}), id });
  try {
    validateDayCloseRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.date) {
    return res.status(400).json({ success: false, error: 'Day close date is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.update({ where: { id }, data }).then(withStoredId),
    'DayCloseRecord',
    'update day close',
  );
});

router.delete('/day-close-records/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.delete({ where: { id } }).then(withStoredId),
    'DayCloseRecord',
    'delete day close',
  );
});

router.get('/day-close-records', (req, res) => {
  respond(res, prisma.dayCloseRecord.findMany({ orderBy: { date: 'desc' } }).then((records) => records.map(withStoredId)));
});

// ==================== Financial Visit Journal ====================
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
      const visit = await tx.visit.create({ data: buildVisitData(visitPayload) });
      let clientPackage = null;
      let clientPackageUsage = null;
      let certificate = null;
      let certificateUsage = null;

      if (usesPackage) {
        ({ clientPackage, clientPackageUsage } = await applyClientPackageUsage(
          tx,
          req,
          visit.id,
          visitPayload,
          'journal-create',
        ));
      }

      if (usesCertificate) {
        ({ certificate, certificateUsage } = await applyCertificateUsage(
          tx,
          req,
          visit.id,
          visitPayload,
          'journal-create',
        ));
      }

      if (visitPayload.status === 'completed') {
        await syncEmployeeEarningForCompletedVisit(tx, req, visit);
      }
      const visitWithEarning = await tx.visit.findUnique({
        where: { id: visit.id },
        include: VISIT_WITH_EARNING_INCLUDE,
      });
      const data = buildJournalFinancialResponse({
        certificate,
        certificateUsage,
        clientPackage,
        clientPackageUsage,
        visit: visitWithEarning,
      });

      await recordAuditLog(tx, req, {
        action: visitPayload.recordType === 'operation' ? 'create payment' : 'create visit',
        after: data,
        entity: 'Visit',
        entityId: visit.id,
      });

      return data;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Create journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.put('/visits/journal/:id/financial', async (req, res) => {
  const visitId = Number(req.params.id);
  const visitPayload = { ...(req.body?.visit ?? req.body ?? {}), id: visitId };
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
      const visit = await tx.visit.findUnique({ where: { id: visitId } });

      if (!visit) {
        const error = new Error('Visit not found');
        error.status = 404;
        throw error;
      }

      if (visit.calendarEntryId) {
        throw validationError('Calendar visits must be updated by completed visit endpoints');
      }

      const [packageUsages, certificateUsages] = await Promise.all([
        tx.clientPackageUsage.findMany({ where: { visitId } }),
        tx.certificateUsage.findMany({ where: { visitId } }),
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
        ({ clientPackage, clientPackageUsage } = await applyClientPackageUsage(
          tx,
          req,
          visitId,
          visitPayload,
          'journal-update',
        ));
      }

      if (newUsesCertificate) {
        ({ certificate, certificateUsage } = await applyCertificateUsage(
          tx,
          req,
          visitId,
          visitPayload,
          'journal-update',
        ));
      }

      const updatedVisit = await tx.visit.update({
        where: { id: visitId },
        data: buildVisitData(visitPayload),
      });
      if (visitPayload.status === 'completed' || visit?.payload?.status === 'completed') {
        await syncEmployeeEarningForCompletedVisit(tx, req, updatedVisit);
      }
      const visitWithEarning = await tx.visit.findUnique({
        where: { id: visitId },
        include: VISIT_WITH_EARNING_INCLUDE,
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
        visit: visitWithEarning,
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

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Update journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl, visitId },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/visits/journal/:id/delete-financial', requireOwner, async (req, res) => {
  const visitId = Number(req.params.id);

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return sendValidationError(res, validationError('visitId is required'));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({ where: { id: visitId } });

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

      await assertVisitCanBeRemoved(tx, visitId);

      const [packageUsages, certificateUsages] = await Promise.all([
        tx.clientPackageUsage.findMany({ where: { visitId } }),
        tx.certificateUsage.findMany({ where: { visitId } }),
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

      await removeUnpaidEmployeeEarningForVisit(tx, req, visitId);
      await tx.visit.delete({ where: { id: visitId } });
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

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete journal financial visit error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl, visitId },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/visits/journal', async (req, res) => {
  const payload = req.body ?? {};
  try {
    validateVisitPayload(payload);
  } catch (err) {
    return sendValidationError(res, err);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({ data: buildVisitData(payload) });
      if (payload.status === 'completed') {
        await syncEmployeeEarningForCompletedVisit(tx, req, visit);
      }
      const visitWithEarning = await tx.visit.findUnique({
        where: { id: visit.id },
        include: VISIT_WITH_EARNING_INCLUDE,
      });
      const data = serializeVisitWithEarning(visitWithEarning);
      await recordAuditLog(tx, req, {
        action: payload.recordType === 'operation' ? 'create payment' : 'create visit',
        after: data,
        before: null,
        entity: 'Visit',
        entityId: visit.id,
      });
      return data;
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Create journal visit error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.put('/visits/journal/:id', async (req, res) => {
  const id = Number(req.params.id);
  const payload = { ...(req.body ?? {}), id };
  try {
    validateVisitPayload(payload);
  } catch (err) {
    return sendValidationError(res, err);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.visit.findUnique({ where: { id } });
      const updated = await tx.visit.update({ where: { id }, data: buildVisitData(payload) });
      if (payload.status === 'completed' || before?.payload?.status === 'completed') {
        await syncEmployeeEarningForCompletedVisit(tx, req, updated);
      }
      const visitWithEarning = await tx.visit.findUnique({
        where: { id },
        include: VISIT_WITH_EARNING_INCLUDE,
      });
      const data = serializeVisitWithEarning(visitWithEarning);
      await recordAuditLog(tx, req, {
        action: payload.recordType === 'operation' ? 'update payment' : 'update visit',
        after: data,
        before: before ? withStoredId(before) : null,
        entity: 'Visit',
        entityId: id,
      });
      return data;
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Update journal visit error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.delete('/visits/journal/:id', requireOwner, async (req, res) => {
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
      return withStoredId(deleted);
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete journal visit error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

module.exports = router;
