const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { recordErrorEvent, recordAuditLog } = require('../services/loggingService');
const {
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
    payload?.commissionRate !== undefined &&
    payload?.commissionRate !== null &&
    String(payload.commissionRate).trim() !== ''
      ? Number(payload.commissionRate)
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
  shifts: payload?.dailyShifts ?? payload?.shifts ?? null,
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

const validateEmployeeData = (data) => {
  if (data.commissionRate !== null) {
    if (!Number.isFinite(Number(data.commissionRate))) {
      throw validationError('commissionRate must be a number');
    }
    if (Number(data.commissionRate) < 0 || Number(data.commissionRate) > 100) {
      throw validationError('commissionRate must be between 0 and 100');
    }
  }
};

const sanitizeEmployee = (employee, auth) => {
  if (!employee) return employee;
  const isOwnerOrAdmin = auth?.role === 'owner' || auth?.role === 'admin';
  const canViewStats = hasPermission(auth, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
  const userEmpId = auth?.employeeId ? Number(auth.employeeId) : null;

  if (isOwnerOrAdmin || canViewStats) {
    return employee;
  }

  // An employee can view their own commission rate and payroll settings
  if (userEmpId && Number(employee.id) === userEmpId) {
    return employee;
  }

  const p = employee.payload && typeof employee.payload === 'object' ? employee.payload : {};
  return {
    ...employee,
    commissionRate: null,
    payrollSettings: null,
    payrollSchedule: null,
    payload: {
      ...p,
      commissionRate: null,
      payrollSettings: null,
      payrollSchedule: null,
    },
  };
};

// ==================== Employee ====================
router.post('/employees', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), (req, res) => {
  const data = buildEmployeeData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }
  try {
    validateEmployeeData(data);
  } catch (err) {
    return sendValidationError(res, err);
  }

  auditCreate(prisma, req, res, prisma.employee.create({ data }).then(withStoredId), 'Employee', 'create employee');
});

router.get('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  const canViewAll = hasPermission(req.auth, PERMISSIONS.EMPLOYEES_MANAGE) ||
    hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
  const ownEmployeeId = Number(req.auth?.employeeId) || null;
  if (!canViewAll && (!ownEmployeeId || id !== ownEmployeeId)) {
    return res.status(403).json({success: false, error: 'Можно просматривать только собственный профиль сотрудника'});
  }
  try {
    const employee = await prisma.employee.findUnique({ where: { id } }).then(withStoredId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    res.json({ success: true, data: sanitizeEmployee(employee, req.auth) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/employees/:id', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  const data = buildEmployeeData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }
  try {
    validateEmployeeData(data);
  } catch (err) {
    return sendValidationError(res, err);
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

router.delete('/employees/:id', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;

  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Employees are always archived so historical visits and payouts keep their owner.
    const deletePromise = prisma.employee
      .update({
        where: { id },
        data: {
          status: 'Удален',
          siteVisible: false,
          email: null,
          payload: {
            ...(existing.payload && typeof existing.payload === 'object'
              ? existing.payload
              : {}),
            deletedAt: new Date().toISOString(),
            status: 'Удален',
            originalEmail: existing.email || null,
          },
        },
      })
      .then(withStoredId);

    await auditDelete(
      prisma,
      req,
      res,
      'employee',
      id,
      deletePromise,
      'Employee',
      'delete employee',
    );
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete employee error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/employees', async (req, res) => {
  const canViewAll = hasPermission(req.auth, PERMISSIONS.EMPLOYEES_MANAGE) ||
    hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
  const ownEmployeeId = Number(req.auth?.employeeId) || null;
  const includeDeleted = req.query.includeDeleted === 'true';
  const statusWhere = includeDeleted
    ? {}
    : {
        OR: [
          { status: null },
          { status: { not: 'Удален' } },
        ],
      };
  const where = canViewAll
    ? statusWhere
    : ownEmployeeId
      ? {AND: [{id: ownEmployeeId}, statusWhere]}
      : {id: -1};

  try {
    const records = await prisma.employee.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ success: true, data: records.map(withStoredId).map((e) => sanitizeEmployee(e, req.auth)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Payroll Record ====================
router.post('/payroll-records', requirePermission(PERMISSIONS.PAYOUTS_MANAGE), async (req, res) => {
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

router.put('/payroll-records/:id', requirePermission(PERMISSIONS.PAYOUTS_MANAGE), async (req, res) => {
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

router.delete('/payroll-records/:id', requirePermission(PERMISSIONS.PAYOUTS_MANAGE), async (req, res) => {
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

router.get('/payroll-records', async (req, res) => {
  try {
    const canViewAll = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_ALL);
    const canViewOwn = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_OWN);

    if (!canViewAll && !canViewOwn) {
      return res.status(403).json({ success: false, error: 'Доступ к выплатам запрещён' });
    }

    const userEmpId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
    const where = (!canViewAll && canViewOwn)
      ? { employeeId: userEmpId ?? -1 }
      : {};

    const records = await prisma.payrollRecord.findMany({
      where,
      orderBy: { paidAt: 'desc' },
    });

    res.json({ success: true, data: records.map(withStoredId) });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/payroll/summary', async (req, res) => {
  const canViewAll = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_ALL);
  const canViewOwn = hasPermission(req.auth, PERMISSIONS.PAYOUTS_VIEW_OWN);

  if (!canViewAll && !canViewOwn) {
    return res.status(403).json({ success: false, error: 'Доступ к сводке зарплат запрещён' });
  }

  const startDate = normalizeDayCloseDate(req.query.dateFrom ?? req.query.startDate);
  const endDate = normalizeDayCloseDate(req.query.dateTo ?? req.query.endDate);
  let employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

  if (!canViewAll && canViewOwn) {
    const userEmpId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;
    if (!userEmpId || (employeeId !== null && employeeId !== userEmpId)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: нельзя просматривать чужую сводку зарплат' });
    }
    employeeId = userEmpId;
  }

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

router.post('/payroll/mark-paid', requirePermission(PERMISSIONS.PAYOUTS_MANAGE), async (req, res) => {
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
