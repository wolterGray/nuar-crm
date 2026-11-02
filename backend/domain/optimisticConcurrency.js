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
  getExpectedUpdatedAt,
  staleWriteError,
  updateWithVersion,
};
