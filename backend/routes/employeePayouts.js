const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAdminOrOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const {
  EMPLOYEE_EARNING_INCLUDE,
  earningAmountSum,
  serializeEmployeeEarning,
  stateConflictError,
} = require('../services/employeeEarningsService');
const { cleanOptionalString, validationError, withStoredId } = require('../utils/crudHelpers');
const { normalizeDayCloseDate } = require('../utils/financeHelpers');
const { getHttpErrorResponse } = require('../utils/httpErrors');

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAdminOrOwner);

const normalizeDate = (value) => {
  const normalized = normalizeDayCloseDate(value);
  return String(normalized ?? '').trim();
};

const validateDateRange = (startDate, endDate) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
    throw validationError('Date range must use YYYY-MM-DD dates');
  }
  if (startDate && endDate && startDate > endDate) {
    throw validationError('startDate must be before or equal to endDate');
  }
};

const visitDate = (earning) => {
  const payload = earning?.visit?.payload && typeof earning.visit.payload === 'object'
    ? earning.visit.payload
    : {};
  if (payload.date) return normalizeDate(payload.date);
  if (!earning?.visit?.scheduledAt) return '';
  const date = new Date(earning.visit.scheduledAt);
  if (Number.isNaN(date.getTime())) return '';
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const isInPeriod = (earning, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  const date = visitDate(earning);
  if (!date) return false;
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
};

const isActivePaidEarning = (earning) =>
  Boolean(earning?.payoutId) && earning?.payout?.status !== 'CANCELLED';

const parseEarningIds = (value) => {
  if (!Array.isArray(value)) {
    throw validationError('earningIds must be an array');
  }
  if (value.length === 0) {
    throw validationError('Select at least one earning');
  }

  const parsed = value.map(Number);
  if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw validationError('earningIds must contain positive integers');
  }

  if (new Set(parsed).size !== parsed.length) {
    throw validationError('earningIds must not contain duplicates');
  }

  return parsed;
};

const buildEmployeeEarningsSummaryRows = ({ employees = [], earnings = [], endDate = '', startDate = '' }) =>
  employees
    .map((employee) => {
      const employeeEarnings = earnings.filter((earning) => earning.employeeId === employee.id);
      const periodEarnings = employeeEarnings.filter((earning) =>
        isInPeriod(earning, startDate, endDate),
      );
      const paidPeriodEarnings = periodEarnings.filter(isActivePaidEarning);
      const unpaidAllTime = employeeEarnings.filter((earning) => !isActivePaidEarning(earning));

      return {
        employee: withStoredId(employee),
        employeeId: employee.id,
        employeeName: employee.name,
        earned: String(earningAmountSum(periodEarnings)),
        paid: String(earningAmountSum(paidPeriodEarnings)),
        unpaid: String(earningAmountSum(unpaidAllTime)),
        unpaidCount: unpaidAllTime.length,
        visitsCount: periodEarnings.length,
      };
    })
    .filter((row) => row.visitsCount > 0 || row.unpaidCount > 0)
    .sort((left, right) => Number(right.unpaid) - Number(left.unpaid));

const serializePayout = (payout) => ({
  ...withStoredId(payout),
  amount: String(payout.amount),
  employee: payout.employee ? withStoredId(payout.employee) : undefined,
  earnings:
    Array.isArray(payout.earnings) && payout.earnings.length > 0
      ? payout.earnings.map(serializeEmployeeEarning)
      : Array.isArray(payout.payload?.earningsSnapshot)
        ? payout.payload.earningsSnapshot
        : undefined,
});

const earningInclude = {
  ...EMPLOYEE_EARNING_INCLUDE,
  visit: {
    include: {
      client: true,
      employee: true,
      service: true,
    },
  },
};

router.get('/employee-earnings/summary', async (req, res) => {
  const startDate = normalizeDate(req.query.startDate);
  const endDate = normalizeDate(req.query.endDate);

  try {
    validateDateRange(startDate, endDate);
    const [employees, earnings] = await Promise.all([
      prisma.employee.findMany({ orderBy: { name: 'asc' } }),
      prisma.employeeEarning.findMany({
        include: earningInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rows = buildEmployeeEarningsSummaryRows({ employees, earnings, endDate, startDate });

    res.json({
      success: true,
      data: {
        endDate: endDate || null,
        rows,
        startDate: startDate || null,
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Employee earnings summary error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/employee-earnings/employees/:employeeId', async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const startDate = normalizeDate(req.query.startDate);
  const endDate = normalizeDate(req.query.endDate);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(422).json({ success: false, error: 'employeeId is invalid' });
  }

  try {
    validateDateRange(startDate, endDate);
    const [employee, earnings] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.employeeEarning.findMany({
        where: { employeeId },
        include: earningInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const visibleEarnings = earnings.filter(
      (earning) => !isActivePaidEarning(earning) || isInPeriod(earning, startDate, endDate),
    );

    res.json({
      success: true,
      data: {
        employee: withStoredId(employee),
        earnings: visibleEarnings.map(serializeEmployeeEarning),
        totals: {
          earned: String(earningAmountSum(earnings.filter((earning) => isInPeriod(earning, startDate, endDate)))),
          paid: String(earningAmountSum(earnings.filter((earning) => isActivePaidEarning(earning) && isInPeriod(earning, startDate, endDate)))),
          unpaid: String(earningAmountSum(earnings.filter((earning) => !isActivePaidEarning(earning)))),
          unpaidCount: earnings.filter((earning) => !isActivePaidEarning(earning)).length,
        },
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Employee earnings detail error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/employee-payouts', async (req, res) => {
  const employeeId = Number(req.body?.employeeId);
  let earningIds = [];

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(422).json({ success: false, error: 'employeeId is invalid' });
  }
  try {
    earningIds = parseEarningIds(req.body?.earningIds);
  } catch (err) {
    return res.status(422).json({ success: false, error: err.message });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        const error = new Error('Employee not found');
        error.status = 404;
        throw error;
      }
      const earnings = await tx.employeeEarning.findMany({
        where: { id: { in: earningIds } },
        include: EMPLOYEE_EARNING_INCLUDE,
      });

      if (earnings.length !== earningIds.length) {
        throw validationError('Some earnings were not found');
      }
      if (earnings.some((earning) => earning.employeeId !== employeeId)) {
        throw validationError('Some earnings belong to another employee');
      }
      if (earnings.some((earning) => earning.payoutId)) {
        throw stateConflictError('Some earnings are already paid');
      }

      const amount = earningAmountSum(earnings);
      const payout = await tx.employeePayout.create({
        data: {
          amount,
          employeeId,
          note: cleanOptionalString(req.body?.note),
          payload: {
            earningIds,
            earningsSnapshot: earnings.map(serializeEmployeeEarning),
            requestedAmountIgnored: req.body?.amount ?? null,
          },
        },
      });
      const updated = await tx.employeeEarning.updateMany({
        where: {
          employeeId,
          id: { in: earningIds },
          payoutId: null,
        },
        data: { payoutId: payout.id },
      });

      if (updated.count !== earningIds.length) {
        throw stateConflictError('Some earnings were paid by another request. Refresh and try again.');
      }

      const savedPayout = await tx.employeePayout.findUnique({
        where: { id: payout.id },
        include: {
          employee: true,
          earnings: { include: earningInclude },
        },
      });

      await recordAuditLog(tx, req, {
        action: 'create employee payout',
        after: serializePayout(savedPayout),
        before: null,
        entity: 'EmployeePayout',
        entityId: payout.id,
      });

      return serializePayout(savedPayout);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Create employee payout error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/employee-payouts', async (_req, res) => {
  try {
    const payouts = await prisma.employeePayout.findMany({
      include: {
        employee: true,
        earnings: true,
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    });
    res.json({ success: true, data: payouts.map(serializePayout) });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Employee payouts list error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/employee-payouts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ success: false, error: 'id is invalid' });
  }

  try {
    const payout = await prisma.employeePayout.findUnique({
      where: { id },
      include: {
        employee: true,
        earnings: { include: earningInclude },
      },
    });
    if (!payout) {
      return res.status(404).json({ success: false, error: 'Payout not found' });
    }
    res.json({ success: true, data: serializePayout(payout) });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Employee payout detail error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.post('/employee-payouts/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ success: false, error: 'id is invalid' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.employeePayout.findUnique({
        where: { id },
        include: {
          employee: true,
          earnings: { include: EMPLOYEE_EARNING_INCLUDE },
        },
      });

      if (!payout) {
        const error = new Error('Payout not found');
        error.status = 404;
        throw error;
      }
      if (payout.status === 'CANCELLED') {
        return serializePayout(payout);
      }

      const cancelled = await tx.employeePayout.update({
        where: { id },
        data: {
          cancellationNote: cleanOptionalString(req.body?.note),
          cancelledAt: new Date(),
          status: 'CANCELLED',
        },
        include: {
          employee: true,
          earnings: { include: EMPLOYEE_EARNING_INCLUDE },
        },
      });
      await tx.employeeEarning.updateMany({
        where: { payoutId: id },
        data: { payoutId: null },
      });
      const saved = await tx.employeePayout.findUnique({
        where: { id },
        include: {
          employee: true,
          earnings: { include: earningInclude },
        },
      });

      await recordAuditLog(tx, req, {
        action: 'cancel employee payout',
        after: serializePayout(saved),
        before: serializePayout(payout),
        entity: 'EmployeePayout',
        entityId: id,
      });

      return serializePayout(saved ?? cancelled);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Cancel employee payout error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl, payoutId: id },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.delete('/employee-payouts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ success: false, error: 'id is invalid' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.employeePayout.findUnique({
        where: { id },
        include: {
          employee: true,
          earnings: { include: EMPLOYEE_EARNING_INCLUDE },
        },
      });

      if (!payout) {
        const error = new Error('Payout not found');
        error.status = 404;
        throw error;
      }

      await tx.employeeEarning.updateMany({
        where: { payoutId: id },
        data: { payoutId: null },
      });
      await tx.employeePayout.delete({ where: { id } });

      await recordAuditLog(tx, req, {
        action: 'delete employee payout',
        after: null,
        before: serializePayout(payout),
        entity: 'EmployeePayout',
        entityId: id,
      });

      return serializePayout(payout);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Delete employee payout error:', err);
    await recordErrorEvent(prisma, {
      context: { path: req.originalUrl, payoutId: id },
      error: err,
      message: err.message,
      source: 'crud',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

module.exports = router;
module.exports._private = {
  buildEmployeeEarningsSummaryRows,
  isActivePaidEarning,
  isInPeriod,
  parseEarningIds,
  validateDateRange,
};
