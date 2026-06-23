const STATUS_LABELS = {
  applied: "Записаны",
  pending: "Новые",
  rejected: "Отклонены",
};

const toDateMs = (value) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const minutesBetween = (start, end) => {
  const startMs = toDateMs(start);
  const endMs = toDateMs(end);

  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }

  return Math.round((endMs - startMs) / (60 * 1000));
};

const formatMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return "—";
  }

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;

  return `${hours} ч`;
};

const getRequestAgeHours = (request, now) => {
  const createdMs = toDateMs(request?.created_at ?? request?.createdAt);

  if (createdMs === null) {
    return null;
  }

  return (now.getTime() - createdMs) / (60 * 60 * 1000);
};

export const buildSiteBookingFunnel = ({
  pendingStaleHours = 2,
  requests = [],
  now = new Date(),
} = {}) => {
  const safeRequests = Array.isArray(requests) ? requests : [];
  const statusCounts = safeRequests.reduce(
    (result, request) => {
      const status = String(request?.status ?? "pending");

      return {
        ...result,
        [status]: (result[status] || 0) + 1,
      };
    },
    {applied: 0, pending: 0, rejected: 0},
  );
  const completedDurations = safeRequests
    .filter((request) => ["applied", "rejected"].includes(request?.status))
    .map((request) =>
      minutesBetween(
        request.created_at ?? request.createdAt,
        request.updated_at ?? request.updatedAt,
      ),
    )
    .filter((value) => Number.isFinite(value));
  const averageResponseMinutes =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((sum, value) => sum + value, 0) /
            completedDurations.length,
        )
      : null;
  const stalePendingRequests = safeRequests
    .filter((request) => String(request?.status ?? "pending") === "pending")
    .filter((request) => {
      const ageHours = getRequestAgeHours(request, now);

      return ageHours === null || ageHours >= pendingStaleHours;
    })
    .sort((left, right) => {
      const leftMs = toDateMs(left.created_at ?? left.createdAt) ?? 0;
      const rightMs = toDateMs(right.created_at ?? right.createdAt) ?? 0;

      return leftMs - rightMs;
    });
  const stages = ["pending", "applied", "rejected"].map((status) => ({
    count: statusCounts[status] || 0,
    id: status,
    label: STATUS_LABELS[status],
  }));

  return {
    averageResponseLabel: formatMinutes(averageResponseMinutes),
    averageResponseMinutes,
    stalePendingCount: stalePendingRequests.length,
    stalePendingRequests,
    stages,
    statusCounts,
    total: safeRequests.length,
  };
};
