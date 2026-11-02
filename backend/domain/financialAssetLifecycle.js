const CLIENT_PACKAGE_STATUS = Object.freeze({
  ACTIVE: 'Активен',
  PAUSED: 'Пауза',
  ARCHIVED: 'Архив',
  FINISHED: 'Закончился',
});

const CERTIFICATE_STATUS = Object.freeze({
  ACTIVE: 'Активен',
  PARTIAL: 'Частично',
  REDEEMED: 'Погашен',
  EXPIRED: 'Просрочен',
  ARCHIVED: 'Архив',
});

const createStatusNormalizer = (statuses, aliases = {}) => {
  const lookup = new Map(
    Object.values(statuses).map((status) => [status.toLocaleLowerCase('ru'), status]),
  );
  Object.entries(aliases).forEach(([alias, status]) => lookup.set(alias, status));

  return (value, fallback) => {
    const normalized = String(value ?? '').trim().toLocaleLowerCase('ru');
    if (!normalized) return fallback;
    const status = lookup.get(normalized);
    if (!status) {
      const error = new Error(`Unknown financial asset status: ${value}`);
      error.status = 422;
      throw error;
    }
    return status;
  };
};

const normalizeClientPackageStatus = createStatusNormalizer(CLIENT_PACKAGE_STATUS, {
  active: CLIENT_PACKAGE_STATUS.ACTIVE,
  archived: CLIENT_PACKAGE_STATUS.ARCHIVED,
  finished: CLIENT_PACKAGE_STATUS.FINISHED,
  paused: CLIENT_PACKAGE_STATUS.PAUSED,
});

const normalizeCertificateStatus = createStatusNormalizer(CERTIFICATE_STATUS, {
  active: CERTIFICATE_STATUS.ACTIVE,
  archived: CERTIFICATE_STATUS.ARCHIVED,
  expired: CERTIFICATE_STATUS.EXPIRED,
  partial: CERTIFICATE_STATUS.PARTIAL,
  redeemed: CERTIFICATE_STATUS.REDEEMED,
});

const resolveClientPackageStatus = (remainingVisits, currentStatus) => {
  if (Number(remainingVisits) <= 0) return CLIENT_PACKAGE_STATUS.ARCHIVED;

  const status = normalizeClientPackageStatus(currentStatus, CLIENT_PACKAGE_STATUS.ACTIVE);
  return [CLIENT_PACKAGE_STATUS.ARCHIVED, CLIENT_PACKAGE_STATUS.FINISHED].includes(status)
    ? CLIENT_PACKAGE_STATUS.ACTIVE
    : status;
};

const resolveCertificateStatus = (remainingBalance, nominal, currentStatus) => {
  const remaining = Number(remainingBalance) || 0;
  const total = Number(nominal) || 0;

  if (remaining <= 0) return CERTIFICATE_STATUS.REDEEMED;
  if (remaining < total) return CERTIFICATE_STATUS.PARTIAL;

  const status = normalizeCertificateStatus(currentStatus, CERTIFICATE_STATUS.ACTIVE);
  return [
    CERTIFICATE_STATUS.ARCHIVED,
    CERTIFICATE_STATUS.REDEEMED,
    CERTIFICATE_STATUS.EXPIRED,
  ].includes(status)
    ? CERTIFICATE_STATUS.ACTIVE
    : status;
};

module.exports = {
  CERTIFICATE_STATUS,
  CLIENT_PACKAGE_STATUS,
  normalizeCertificateStatus,
  normalizeClientPackageStatus,
  resolveCertificateStatus,
  resolveClientPackageStatus,
};
