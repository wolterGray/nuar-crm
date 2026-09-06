const { recordAuditLog } = require('./loggingService');
const { validationError, withStoredId } = require('../utils/crudHelpers');
const { objectPayload } = require('../utils/financeHelpers');

const resolveClientPackageStatus = (remainingVisits, currentStatus) => {
  if (Number(remainingVisits) <= 0) {
    return 'Архив';
  }

  return ['Архив', 'Закончился'].includes(String(currentStatus ?? ''))
    ? 'Активен'
    : currentStatus;
};

const normalizeUsagePayload = (context) => {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    return context;
  }
  return context ? { reason: context } : {};
};

const getVisitPackageInfo = (visit) => {
  const payload = objectPayload(visit?.payload);

  return {
    clientPackageId: Number(visit?.packageUsageId ?? payload.packageUsageId),
    sessionsUsed: Number(visit?.packageSessionsUsed ?? payload.packageSessionsUsed) || 0,
  };
};

const restoreClientPackageUsage = async (tx, req, visit, usage, context = {}) => {
  if (usage && usage.revertedAt) {
    return { clientPackage: null, clientPackageUsage: null, skipped: true };
  }

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
    action: context.action || 'restore package',
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

const applyClientPackageUsage = async (tx, req, visitId, visitPayload, context = {}) => {
  const clientPackageId = Number(visitPayload.packageUsageId);
  const sessionsUsed = Number(visitPayload.packageSessionsUsed) || 1;
  const usagePayload = normalizeUsagePayload(context);

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

  if (existingUsage && !existingUsage.revertedAt) {
    const activeSessionsUsed = Number(existingUsage.sessionsUsed) || 1;

    if (activeSessionsUsed !== sessionsUsed) {
      throw validationError('Active package usage already exists with different sessions count');
    }

    return {
      clientPackage: clientPackageBefore,
      clientPackageUsage: existingUsage,
      idempotent: true,
    };
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
          payload: usagePayload,
          revertedAt: null,
          sessionsUsed,
        },
      })
    : await tx.clientPackageUsage.create({
        data: {
          clientPackageId,
          payload: usagePayload,
          sessionsUsed,
          visitId,
        },
      });
  const clientPackage = await tx.clientPackage.findUnique({
    where: { id: clientPackageId },
  });

  await recordAuditLog(tx, req, {
    action: context.action || 'use package',
    after: {
      clientPackage: clientPackage ? withStoredId(clientPackage) : null,
      clientPackageUsage: withStoredId(clientPackageUsage),
    },
    before: withStoredId(clientPackageBefore),
    entity: 'ClientPackage',
    entityId: clientPackageId,
  });

  return { clientPackage, clientPackageUsage, idempotent: false };
};

module.exports = {
  applyClientPackageUsage,
  getVisitPackageInfo,
  resolveClientPackageStatus,
  restoreClientPackageUsage,
};
