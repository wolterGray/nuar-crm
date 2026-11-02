const getExpectedUpdatedAt = (payload) => {
  const value = payload?.expectedUpdatedAt ?? payload?.updatedAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const staleWriteError = () => {
  const error = new Error(
    'Запись уже была изменена на другом устройстве. Обновите данные и повторите действие.',
  );
  error.code = 'STALE_WRITE';
  error.status = 409;
  return error;
};

const assertRecordVersion = (record, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) return;
  if (!record || new Date(record.updatedAt).getTime() !== expectedUpdatedAt.getTime()) {
    throw staleWriteError();
  }
};

const getRequestVersion = (req, header = 'x-expected-updated-at') => {
  const raw = req?.headers?.[header];
  if (!raw) return null;
  const version = getExpectedUpdatedAt({ expectedUpdatedAt: raw });
  if (version) return version;
  const error = new Error(`Invalid ${header} header`);
  error.status = 400;
  throw error;
};

async function deleteWithVersion(model, { expectedUpdatedAt, id }) {
  const before = await model.findUnique({ where: { id } });
  if (!before) {
    const error = new Error('Record not found');
    error.status = 404;
    throw error;
  }
  assertRecordVersion(before, expectedUpdatedAt);
  await model.delete({ where: { id } });
  return before;
}

async function updateWithVersion(model, { data, id, payload }) {
  const expectedUpdatedAt = getExpectedUpdatedAt(payload);
  if (!expectedUpdatedAt) return model.update({ where: { id }, data });

  const updated = await model.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data,
  });
  if (updated.count !== 1) throw staleWriteError();
  return model.findUnique({ where: { id } });
}

module.exports = {
  assertRecordVersion,
  deleteWithVersion,
  getExpectedUpdatedAt,
  getRequestVersion,
  staleWriteError,
  updateWithVersion,
};
