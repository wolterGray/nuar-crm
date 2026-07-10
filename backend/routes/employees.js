const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { recordErrorEvent, recordAuditLog } = require('../services/loggingService');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  getRouteId,
  withStoredId,
  sendValidationError,
  requireLegacyFinancialWriteFlag,
  validationError,
  assertNonNegative,
} = require('../utils/crudHelpers');
const {
  normalizeDayCloseDate,
  buildServerPayrollReport,
  buildServerPayrollRecordData,
} = require('../utils/financeHelpers');

const prisma = new PrismaClient();

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

const validatePayrollRecordData = (data) => {
  assertNonNegative(data.amount, 'amount');
  assertNonNegative(data.payload?.report?.totals?.totalPayout, 'report.totals.totalPayout');
};

// ==================== Employee ====================
router.post('/employees', requireOwner, (req, res) => {
  const data = buildEmployeeData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  auditCreate(prisma, req, res, prisma.employee.create({ data }).then(withStoredId), 'Employee', 'create employee');
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/employees/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const data = buildEmployeeData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  await auditUpdate(
    prisma,
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
    prisma,
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
    prisma.employee.findMany({ orderBy: { name: 'asc' } }).then((records) =>
      records.map(withStoredId),
    ),
  );
});

// ==================== Payroll Record ====================
router.post('/payroll-records', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(prisma, req, res, {
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
    return res.status(400).json({ success: false, error: 'Payroll period is required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.payrollRecord.create({ data }).then(withStoredId),
    'PayrollRecord',
    'create payroll record',
  );
});

router.put('/payroll-records/:id', requireOwner, async (req, res) => {
  const allowed = await requireLegacyFinancialWriteFlag(prisma, req, res, {
    action: 'update payroll record',
    entity: 'PayrollRecord',
    sourceOfTruth: 'POST /api/payroll/mark-paid',
  });
  if (allowed !== true) {
    return;
  }

  const id = Number(req.params.id);
  const data = buildPayrollRecordData({ ...(req.body ?? {}), id });
  try {
    validatePayrollRecordData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }
  if (!data.periodKey) {
    return res.status(400).json({ success: false, error: 'Payroll period is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.update({ where: { id }, data }).then(withStoredId),
    'PayrollRecord',
    'update payroll record',
  );
});

router.delete('/payroll-records/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.delete({ where: { id } }).then(withStoredId),
    'PayrollRecord',
    'delete payroll record',
  );
});

router.get('/payroll-records', (req, res) => {
  respond(res, prisma.payrollRecord.findMany({ orderBy: { paidAt: 'desc' } }).then((records) => records.map(withStoredId)));
});

router.get('/payroll/summary', requireOwner, async (req, res) => {
  const startDate = normalizeDayCloseDate(req.query.dateFrom ?? req.query.startDate);
  const endDate = normalizeDayCloseDate(req.query.dateTo ?? req.query.endDate);
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'Payroll period is required' });
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

    res.json({ success: true, data: report });
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
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/payroll/mark-paid', requireOwner, async (req, res) => {
  const body = req.body ?? {};
  const startDate = normalizeDayCloseDate(body.dateFrom ?? body.startDate);
  const endDate = normalizeDayCloseDate(body.dateTo ?? body.endDate);
  const employeeId = body.employeeId ? Number(body.employeeId) : null;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'Payroll period is required' });
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

      // validate data
      assertNonNegative(data.amount, 'amount');

      const existing = await tx.payrollRecord.findUnique({
        where: { periodKey: data.periodKey },
      });
      const record = existing
        ? await tx.payrollRecord.update({ where: { id: existing.id }, data })
        : await tx.payrollRecord.create({ data });
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

    res.json({ success: true, data: result });
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
    res.status(response.status).json({ success: false, error: response.message });
  }
});

module.exports = router;
