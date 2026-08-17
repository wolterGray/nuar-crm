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
  employeeEarnings: {
    include: EMPLOYEE_EARNING_INCLUDE,
    orderBy: { id: 'asc' },
  },
};

const EARNING_SOURCE_VISIT = 'VISIT';
const EARNING_SOURCE_PACKAGE_SALE = 'PACKAGE_SALE';

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
    clientPackage: earning.clientPackage ? withStoredId(earning.clientPackage) : undefined,
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
  const employeeEarnings = Array.isArray(visit.employeeEarnings)
    ? visit.employeeEarnings.map(serializeEmployeeEarning)
    : [];
  return {
    ...stored,
    employeeEarning: employeeEarnings[0] ?? serializeEmployeeEarning(visit.employeeEarning),
    employeeEarnings,
  };
};

const isCompletedEarningEligibleVisit = (visitPayload) => {
  if (!visitPayload || visitPayload.recordType === 'operation') {
    return false;
  }
  if (isDayClosePackageVisit(visitPayload)) {
    return false;
  }
  return !isDayCloseCancelledVisit(visitPayload) && !isDayCloseBarterVisit(visitPayload);
};

const getActualPriceForEarning = (visitPayload) => {
  if (isDayCloseCertificateVisit(visitPayload)) {
    return normalizeDecimal(Math.max(0, getDayCloseDiscountedAmount(visitPayload)));
  }
  return normalizeDecimal(Math.max(0, getDayCloseServiceReceivedAmount(visitPayload)));
};

const resolveActualPriceForEarning = async (tx, visitPayload) => {
  if (isDayClosePackageVisit(visitPayload)) {
    return normalizeDecimal(0);
  }
  return getActualPriceForEarning(visitPayload);
};

const calculateEmployeeAmount = (actualPrice, commissionPercent) =>
  normalizeDecimal(decimal(actualPrice).mul(decimal(commissionPercent)).div(100));

const normalizeVisitParticipants = (visitPayload = {}) => {
  const rawParticipants = Array.isArray(visitPayload.parallelEmployees)
    ? visitPayload.parallelEmployees
    : Array.isArray(visitPayload.employees)
      ? visitPayload.employees
      : [];
  const participants = rawParticipants
    .map((participant) => ({
      employeeId: Number(participant?.employeeId) || null,
      name: String(participant?.name ?? participant?.master ?? '').trim(),
      shareAmount:
        participant?.shareAmount !== undefined && participant?.shareAmount !== null
          ? normalizeDecimal(Math.max(0, Number(participant.shareAmount) || 0))
          : null,
    }))
    .filter((participant) => participant.employeeId || participant.name);

  if (participants.length === 0) {
    participants.push({
      employeeId: Number(visitPayload?.employeeId) || null,
      name: String(visitPayload?.master ?? visitPayload?.employeeName ?? '').trim(),
      shareAmount: null,
    });
  }

  const seen = new Set();
  return participants.filter((participant) => {
    const key = participant.employeeId ? `id:${participant.employeeId}` : `name:${participant.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

const resolveEmployeeForVisitParticipant = async (tx, participant, visit, visitPayload) => {
  const employeeId = Number(participant?.employeeId);
  if (Number.isInteger(employeeId) && employeeId > 0) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (employee) return employee;
  }

  const master = String(participant?.name ?? '').trim();
  if (master) {
    const employee = await tx.employee.findFirst({ where: { name: master } });
    if (employee) return employee;
  }

  return resolveEmployeeForVisit(tx, visit, visitPayload);
};

const getClientPackagePayload = (clientPackage) =>
  clientPackage?.payload && typeof clientPackage.payload === 'object'
    ? clientPackage.payload
    : {};

const resolveEmployeeForClientPackage = async (tx, clientPackage, payload = {}) => {
  const employeeId = Number(clientPackage?.employeeId ?? payload?.employeeId);
  if (Number.isInteger(employeeId) && employeeId > 0) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (employee) return employee;
  }

  const master = String(clientPackage?.master ?? payload?.master ?? payload?.employeeName ?? payload?.seller ?? '').trim();
  if (!master) return null;

  return tx.employee.findFirst({ where: { name: master } });
};

const buildEmployeeEarningSnapshot = async (tx, visit) => {
  const snapshots = await buildEmployeeEarningSnapshots(tx, visit);
  return snapshots[0] ?? null;
};

const buildEmployeeEarningSnapshots = async (tx, visit) => {
  const visitPayload = getVisitPayloadForDayClose(visit);
  if (!isCompletedEarningEligibleVisit(visitPayload)) {
    return [];
  }

  const participants = normalizeVisitParticipants(visitPayload);
  const totalActualPrice = await resolveActualPriceForEarning(tx, visitPayload);
  const totalParticipantShares = participants.reduce(
    (total, participant) =>
      participant.shareAmount
        ? total.plus(decimal(participant.shareAmount))
        : total,
    decimal(0),
  );
  const defaultParticipantPrice =
    participants.length > 1
      ? normalizeDecimal(decimal(totalActualPrice).div(participants.length))
      : totalActualPrice;

  return Promise.all(
    participants.map(async (participant) => {
      const employee = await resolveEmployeeForVisitParticipant(tx, participant, visit, visitPayload);
      const commissionPercent = validateCommissionPercent(employee, {
        ...visitPayload,
        master: participant.name || visitPayload.master,
      });
      const actualPrice =
        participant.shareAmount && totalParticipantShares.gt(0)
          ? normalizeDecimal(
              decimal(totalActualPrice)
                .mul(decimal(participant.shareAmount))
                .div(totalParticipantShares),
            )
          : defaultParticipantPrice;
      const amount = calculateEmployeeAmount(actualPrice, commissionPercent);

      return {
        actualPrice,
        amount,
        commissionPercent,
        employee,
        employeeId: employee.id,
        sourceType: EARNING_SOURCE_VISIT,
      };
    }),
  );
};

const buildPackageSaleEarningSnapshot = async (tx, clientPackage) => {
  const payload = getClientPackagePayload(clientPackage);
  const hasSeller =
    Number(clientPackage?.employeeId ?? payload?.employeeId) > 0 ||
    String(clientPackage?.master ?? payload?.master ?? payload?.employeeName ?? payload?.seller ?? '').trim();
  if (!hasSeller) {
    return null;
  }

  const employee = await resolveEmployeeForClientPackage(tx, clientPackage, payload);
  const commissionPercent = validateCommissionPercent(employee, payload);
  const actualPrice = normalizeDecimal(Math.max(0, Number(clientPackage?.price ?? payload?.price) || 0));
  const amount = calculateEmployeeAmount(actualPrice, commissionPercent);

  return {
    actualPrice,
    amount,
    commissionPercent,
    employee,
    employeeId: employee.id,
    sourceType: EARNING_SOURCE_PACKAGE_SALE,
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
  const existing = await tx.employeeEarning.findMany({
    where: { visitId: visit.id },
    include: EMPLOYEE_EARNING_INCLUDE,
    orderBy: { id: 'asc' },
  });
  const snapshots = await buildEmployeeEarningSnapshots(tx, visit);

  if (snapshots.length === 0) {
    if (existing.some((earning) => earning.payoutId)) {
      throw stateConflictError(
        'This visit is already included in a payout. Cancel the payout before removing the earning.',
      );
    }
    for (const earning of existing) {
      const deleted = await tx.employeeEarning.delete({ where: { id: earning.id } });
      await recordAuditLog(tx, req, {
        action: 'delete employee earning',
        after: null,
        before: serializeEmployeeEarning(earning),
        entity: 'EmployeeEarning',
        entityId: deleted.id,
      });
    }
    return null;
  }

  for (const earning of existing.filter((item) => item.payoutId)) {
    const snapshot = snapshots.find((item) => Number(item.employeeId) === Number(earning.employeeId));
    if (!snapshot) {
      throw stateConflictError(
        'This visit is already included in a payout. Cancel the payout before changing financial details.',
      );
    }
    assertPaidEarningUnchanged(earning, snapshot);
  }

  const synced = [];
  const snapshotEmployeeIds = new Set(snapshots.map((snapshot) => Number(snapshot.employeeId)));

  for (const earning of existing) {
    if (!earning.payoutId && !snapshotEmployeeIds.has(Number(earning.employeeId))) {
      const deleted = await tx.employeeEarning.delete({ where: { id: earning.id } });
      await recordAuditLog(tx, req, {
        action: 'delete employee earning',
        after: null,
        before: serializeEmployeeEarning(earning),
        entity: 'EmployeeEarning',
        entityId: deleted.id,
      });
    }
  }

  for (const snapshot of snapshots) {
    const matching = existing.find((earning) => Number(earning.employeeId) === Number(snapshot.employeeId));
    const data = {
      actualPrice: snapshot.actualPrice,
      amount: snapshot.amount,
      commissionPercent: snapshot.commissionPercent,
      employeeId: snapshot.employeeId,
      sourceType: snapshot.sourceType,
    };

    const earning = matching
      ? await tx.employeeEarning.update({
          where: { id: matching.id },
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
      action: matching ? 'update employee earning' : 'create employee earning',
      after: serializeEmployeeEarning(earning),
      before: matching ? serializeEmployeeEarning(matching) : null,
      entity: 'EmployeeEarning',
      entityId: earning.id,
    });
    synced.push(earning);
  }

  return synced[0] ?? null;
};

const syncEmployeeEarningForClientPackageSale = async (tx, req, clientPackage) => {
  const existing = await tx.employeeEarning.findUnique({
    where: { clientPackageId: clientPackage.id },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  const snapshot = await buildPackageSaleEarningSnapshot(tx, clientPackage);

  if (!snapshot) {
    if (existing?.payoutId) {
      throw stateConflictError(
        'This package sale is already included in a payout. Cancel the payout before removing the earning.',
      );
    }
    if (existing) {
      const deleted = await tx.employeeEarning.delete({ where: { id: existing.id } });
      await recordAuditLog(tx, req, {
        action: 'delete package sale employee earning',
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
    sourceType: snapshot.sourceType,
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
          clientPackageId: clientPackage.id,
        },
        include: EMPLOYEE_EARNING_INCLUDE,
      });

  await recordAuditLog(tx, req, {
    action: existing ? 'update package sale employee earning' : 'create package sale employee earning',
    after: serializeEmployeeEarning(earning),
    before: existing ? serializeEmployeeEarning(existing) : null,
    entity: 'EmployeeEarning',
    entityId: earning.id,
  });

  return earning;
};

const removeUnpaidEmployeeEarningForClientPackage = async (tx, req, clientPackageId) => {
  const earning = await tx.employeeEarning.findUnique({
    where: { clientPackageId },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  if (!earning) return null;
  if (earning.payoutId) {
    throw stateConflictError(
      'This package sale is already included in a payout. Cancel the payout before changing or deleting it.',
    );
  }

  const deleted = await tx.employeeEarning.delete({ where: { id: earning.id } });
  await recordAuditLog(tx, req, {
    action: 'delete package sale employee earning',
    after: null,
    before: serializeEmployeeEarning(earning),
    entity: 'EmployeeEarning',
    entityId: deleted.id,
  });
  return deleted;
};

const assertVisitCanBeRemoved = async (tx, visitId) => {
  const earnings = await tx.employeeEarning.findMany({
    where: { visitId },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  if (earnings.some((earning) => earning.payoutId)) {
    throw stateConflictError(
      'This visit is already included in a payout. Cancel the payout before reverting or deleting it.',
    );
  }
};

const removeUnpaidEmployeeEarningForVisit = async (tx, req, visitId) => {
  const earnings = await tx.employeeEarning.findMany({
    where: { visitId },
    include: EMPLOYEE_EARNING_INCLUDE,
  });
  if (!earnings.length) return null;
  if (earnings.some((earning) => earning.payoutId)) {
    throw stateConflictError(
      'This visit is already included in a payout. Cancel the payout before reverting or deleting it.',
    );
  }

  const deleted = [];
  for (const earning of earnings) {
    const item = await tx.employeeEarning.delete({ where: { id: earning.id } });
    await recordAuditLog(tx, req, {
      action: 'delete employee earning',
      after: null,
      before: serializeEmployeeEarning(earning),
      entity: 'EmployeeEarning',
      entityId: item.id,
    });
    deleted.push(item);
  }
  return deleted[0] ?? null;
};

const earningAmountSum = (earnings = []) =>
  earnings.reduce((sum, earning) => sum.plus(decimal(earning.amount)), decimal(0)).toDecimalPlaces(2);

const cleanupPackageVisitEarningsAndEnsureSales = async (tx) => {
  const unpaidVisitEarnings = await tx.employeeEarning.findMany({
    where: {
      payoutId: null,
      visitId: { not: null },
    },
    include: {
      visit: true,
    },
  });

  const toDeleteIds = unpaidVisitEarnings
    .filter((earning) => {
      const visitPayload = getVisitPayloadForDayClose(earning.visit);
      return isDayClosePackageVisit(visitPayload);
    })
    .map((earning) => earning.id);

  if (toDeleteIds.length > 0) {
    await tx.employeeEarning.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
  }

  const clientPackages = await tx.clientPackage.findMany({
    include: {
      employeeEarning: true,
    },
  });

  for (const clientPackage of clientPackages) {
    if (!clientPackage.employeeEarning) {
      await syncEmployeeEarningForClientPackageSale(tx, null, clientPackage);
    }
  }
};

module.exports = {
  EMPLOYEE_EARNING_INCLUDE,
  VISIT_WITH_EARNING_INCLUDE,
  assertVisitCanBeRemoved,
  buildEmployeeEarningSnapshot,
  buildEmployeeEarningSnapshots,
  buildPackageSaleEarningSnapshot,
  calculateEmployeeAmount,
  cleanupPackageVisitEarningsAndEnsureSales,
  EARNING_SOURCE_PACKAGE_SALE,
  EARNING_SOURCE_VISIT,
  earningAmountSum,
  getActualPriceForEarning,
  serializeEmployeeEarning,
  serializeVisitWithEarning,
  removeUnpaidEmployeeEarningForClientPackage,
  removeUnpaidEmployeeEarningForVisit,
  stateConflictError,
  syncEmployeeEarningForClientPackageSale,
  syncEmployeeEarningForCompletedVisit,
  validateCommissionPercent,
};

