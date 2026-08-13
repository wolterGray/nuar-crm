const { Prisma } = require('@prisma/client');
const {
  getDayCloseDiscountedAmount,
  getDayCloseServiceReceivedAmount,
  getVisitPayloadForDayClose,
  isDayCloseBarterVisit,
  isDayCloseCancelledVisit,
  isDayCloseCertificateVisit,
  isDayClosePackageVisit,
} = require('../utils/financeHelpers');
const { validationError, withStoredId } = require('../utils/crudHelpers');
const { recordAuditLog } = require('./loggingService');

const Decimal = Prisma.Decimal;

const EMPLOYEE_EARNING_INCLUDE = {
  employee: true,
  payout: true,
};

const VISIT_WITH_EARNING_INCLUDE = {
  employeeEarning: {
    include: EMPLOYEE_EARNING_INCLUDE,
  },
};

const decimal = (value) => new Decimal(value ?? 0);

const normalizeDecimal = (value) => decimal(value).toDecimalPlaces(2);

const decimalEquals = (left, right) => normalizeDecimal(left).equals(normalizeDecimal(right));

const stateConflictError = (message) => {
  const error = new Error(message);
  error.status = 409;
  return error;
};

const getEmployeeDisplayName = (employee, visitPayload = {}) =>
  employee?.name || String(visitPayload?.master ?? visitPayload?.employeeName ?? '').trim() || 'employee';

const validateCommissionPercent = (employee, visitPayload = {}) => {
  if (!employee) {
    throw validationError('Employee for completed visit was not found');
  }
  if (employee.commissionRate === null || employee.commissionRate === undefined) {
    throw validationError(`Commission percent is not set for ${getEmployeeDisplayName(employee, visitPayload)}`);
  }

  const commissionPercent = normalizeDecimal(employee.commissionRate);
  if (commissionPercent.isNegative() || commissionPercent.gt(100)) {
    throw validationError(
      `Commission percent for ${getEmployeeDisplayName(employee, visitPayload)} must be between 0 and 100`,
    );
  }

  return commissionPercent;
};

const serializeEmployeeEarning = (earning) => {
  if (!earning) return null;
  return {
    ...withStoredId(earning),
    actualPrice: String(earning.actualPrice),
    amount: String(earning.amount),
    commissionPercent: String(earning.commissionPercent),
    employee: earning.employee ? withStoredId(earning.employee) : undefined,
    payout: earning.payout
      ? {
          ...withStoredId(earning.payout),
          amount: String(earning.payout.amount),
        }
      : null,
  };
};

const serializeVisitWithEarning = (visit) => {
  const stored = withStoredId(visit);
  if (!stored) return stored;
  return {
    ...stored,
    employeeEarning: serializeEmployeeEarning(visit.employeeEarning),
  };
};

const isCompletedEarningEligibleVisit = (visitPayload) => {
  if (!visitPayload || visitPayload.recordType === 'operation') {
    return false;
  }
  return !isDayCloseCancelledVisit(visitPayload) && !isDayCloseBarterVisit(visitPayload);
};

const getActualPriceForEarning = (visitPayload) => {
  if (isDayClosePackageVisit(visitPayload) || isDayCloseCertificateVisit(visitPayload)) {
    return normalizeDecimal(Math.max(0, getDayCloseDiscountedAmount(visitPayload)));
  }
  return normalizeDecimal(Math.max(0, getDayCloseServiceReceivedAmount(visitPayload)));
};

const calculateEmployeeAmount = (actualPrice, commissionPercent) =>
  normalizeDecimal(decimal(actualPrice).mul(decimal(commissionPercent)).div(100));

const resolveEmployeeForVisit = async (tx, visit, visitPayload) => {
  const employeeId = Number(visit?.employeeId ?? visitPayload?.employeeId);
  if (Number.isInteger(employeeId) && employeeId > 0) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (employee) return employee;
  }

  const master = String(visitPayload?.master ?? visitPayload?.employeeName ?? '').trim();
  if (!master) return null;

  return tx.employee.findFirst({ where: { name: master } });
};

const buildEmployeeEarningSnapshot = async (tx, visit) => {
  const visitPayload = getVisitPayloadForDayClose(visit);
  if (!isCompletedEarningEligibleVisit(visitPayload)) {
    return null;
  }

  const employee = await resolveEmployeeForVisit(tx, visit, visitPayload);
  const commissionPercent = validateCommissionPercent(employee, visitPayload);

  const actualPrice = getActualPriceForEarning(visitPayload);
  const amount = calculateEmployeeAmount(actualPrice, commissionPercent);

  return {
    actualPrice,
    amount,
    commissionPercent,
    employee,
    employeeId: employee.id,
  };
};

const assertPaidEarningUnchanged = (existing, snapshot) => {
  const changed =
    Number(existing.employeeId) !== Number(snapshot.employeeId) ||
    !decimalEquals(existing.actualPrice, snapshot.actualPrice) ||
    !decimalEquals(existing.commissionPercent, snapshot.commissionPercent) ||
    !decimalEquals(existing.amount, snapshot.amount);

  if (changed) {
    throw stateConflictError(
      'This visit is already included in a payout. Cancel the payout before changing financial details.',
    );
  }
};

const syncEmployeeEarningForCompletedVisit = async (tx, req, visit) => {
  const existing = await tx.employeeEarning.findUnique({
    where: { visitId: visit.id },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  const snapshot = await buildEmployeeEarningSnapshot(tx, visit);

  if (!snapshot) {
    if (existing?.payoutId) {
      throw stateConflictError(
        'This visit is already included in a payout. Cancel the payout before removing the earning.',
      );
    }
    if (existing) {
      const deleted = await tx.employeeEarning.delete({ where: { id: existing.id } });
      await recordAuditLog(tx, req, {
        action: 'delete employee earning',
        after: null,
        before: serializeEmployeeEarning(existing),
        entity: 'EmployeeEarning',
        entityId: deleted.id,
      });
    }
    return null;
  }

  if (existing?.payoutId) {
    assertPaidEarningUnchanged(existing, snapshot);
    return existing;
  }

  const data = {
    actualPrice: snapshot.actualPrice,
    amount: snapshot.amount,
    commissionPercent: snapshot.commissionPercent,
    employeeId: snapshot.employeeId,
  };

  const earning = existing
    ? await tx.employeeEarning.update({
        where: { id: existing.id },
        data,
        include: EMPLOYEE_EARNING_INCLUDE,
      })
    : await tx.employeeEarning.create({
        data: {
          ...data,
          visitId: visit.id,
        },
        include: EMPLOYEE_EARNING_INCLUDE,
      });

  await recordAuditLog(tx, req, {
    action: existing ? 'update employee earning' : 'create employee earning',
    after: serializeEmployeeEarning(earning),
    before: existing ? serializeEmployeeEarning(existing) : null,
    entity: 'EmployeeEarning',
    entityId: earning.id,
  });

  return earning;
};

const assertVisitCanBeRemoved = async (tx, visitId) => {
  const earning = await tx.employeeEarning.findUnique({
    where: { visitId },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  if (earning?.payoutId) {
    throw stateConflictError(
      'This visit is already included in a payout. Cancel the payout before reverting or deleting it.',
    );
  }
};

const removeUnpaidEmployeeEarningForVisit = async (tx, req, visitId) => {
  const earning = await tx.employeeEarning.findUnique({
    where: { visitId },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  if (!earning) return null;
  if (earning.payoutId) {
    throw stateConflictError(
      'This visit is already included in a payout. Cancel the payout before reverting or deleting it.',
    );
  }

  const deleted = await tx.employeeEarning.delete({ where: { id: earning.id } });
  await recordAuditLog(tx, req, {
    action: 'delete employee earning',
    after: null,
    before: serializeEmployeeEarning(earning),
    entity: 'EmployeeEarning',
    entityId: deleted.id,
  });
  return deleted;
};

const earningAmountSum = (earnings = []) =>
  earnings.reduce((sum, earning) => sum.plus(decimal(earning.amount)), decimal(0)).toDecimalPlaces(2);

module.exports = {
  EMPLOYEE_EARNING_INCLUDE,
  VISIT_WITH_EARNING_INCLUDE,
  assertVisitCanBeRemoved,
  buildEmployeeEarningSnapshot,
  calculateEmployeeAmount,
  earningAmountSum,
  getActualPriceForEarning,
  serializeEmployeeEarning,
  serializeVisitWithEarning,
  removeUnpaidEmployeeEarningForVisit,
  stateConflictError,
  syncEmployeeEarningForCompletedVisit,
  validateCommissionPercent,
};
