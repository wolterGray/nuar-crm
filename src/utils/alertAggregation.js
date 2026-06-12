const PRIORITY_ORDER = {critical: 0, action: 1, info: 2};

const getHighestPriority = (alerts) =>
  alerts.reduce((best, alert) => {
    if (PRIORITY_ORDER[alert.priority] < PRIORITY_ORDER[best]) {
      return alert.priority;
    }

    return best;
  }, "info");

const formatNameList = (alerts, limit = 2) => {
  const names = alerts.map((alert) => alert.title);

  if (names.length <= limit) {
    return names.join(", ");
  }

  const visible = names.slice(0, limit).join(", ");
  return `${visible} и ещё ${names.length - limit}`;
};

const buildAggregateAlert = ({
  aggregateKind,
  alerts,
  group,
  message,
  page,
  section,
  title,
}) => ({
  actions: ["open", "snooze"],
  aggregateKind,
  children: alerts,
  group,
  id: `aggregate-${aggregateKind}`,
  message,
  page,
  priority: getHighestPriority(alerts),
  section,
  title,
  type: "aggregate",
});

export const aggregateDisplayAlerts = (alerts, appSettings = {}) => {
  if (appSettings.alertAggregationEnabled === false) {
    return alerts;
  }

  const inactiveLimit = Math.max(
    3,
    Number(appSettings.inactiveClientAlertLimit) || 5,
  );
  const preservedTypes = new Set(["calendar", "forecast", "undo"]);
  const preserved = alerts.filter((alert) => preservedTypes.has(alert.type));
  const aggregatable = alerts.filter((alert) => !preservedTypes.has(alert.type));

  const buckets = aggregatable.reduce((accumulator, alert) => {
    const bucket = accumulator[alert.type] ?? [];
    bucket.push(alert);
    accumulator[alert.type] = bucket;
    return accumulator;
  }, {});

  const result = [...preserved];

  if ((buckets.supply?.length ?? 0) >= 2) {
    const items = buckets.supply;
    result.push(
      buildAggregateAlert({
        aggregateKind: "supplies",
        alerts: items,
        group: "operations",
        message: formatNameList(items),
        page: "operations",
        section: "supplies",
        title: `Склад · ${items.length} позиций ниже минимума`,
      }),
    );
  } else if (buckets.supply?.length) {
    result.push(...buckets.supply);
  }

  if ((buckets.task?.length ?? 0) >= 2) {
    const items = buckets.task;
    result.push(
      buildAggregateAlert({
        aggregateKind: "tasks",
        alerts: items,
        group: "operations",
        message: formatNameList(items),
        page: "operations",
        section: "tasks",
        title: `Задачи · ${items.length} требуют внимания`,
      }),
    );
  } else if (buckets.task?.length) {
    result.push(...buckets.task);
  }

  if ((buckets.package?.length ?? 0) >= 2) {
    const items = buckets.package;
    result.push(
      buildAggregateAlert({
        aggregateKind: "packages",
        alerts: items,
        group: "packages",
        message: formatNameList(items),
        page: "clients",
        title: `Пакеты · ${items.length} клиентов с низким остатком`,
      }),
    );
  } else if (buckets.package?.length) {
    result.push(...buckets.package);
  }

  if ((buckets.inactive?.length ?? 0) > inactiveLimit) {
    const items = buckets.inactive;
    result.push(
      buildAggregateAlert({
        aggregateKind: "inactive",
        alerts: items,
        group: "inactive",
        message: formatNameList(items),
        page: "clients",
        title: `Клиенты · ${items.length} давно не были`,
      }),
    );
  } else if (buckets.inactive?.length) {
    result.push(...buckets.inactive);
  }

  if ((buckets.birthday?.length ?? 0) >= 3) {
    const items = buckets.birthday;
    result.push(
      buildAggregateAlert({
        aggregateKind: "birthdays",
        alerts: items,
        group: "birthdays",
        message: formatNameList(items),
        page: "templates",
        title: `Дни рождения · ${items.length} клиентов`,
      }),
    );
  } else if (buckets.birthday?.length) {
    result.push(...buckets.birthday);
  }

  return result.sort((left, right) => {
    const priorityDiff =
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(left.title).localeCompare(String(right.title), "ru");
  });
};

export const getAggregateChildIds = (alert) =>
  alert.type === "aggregate"
    ? alert.children.map((child) => child.id)
    : [alert.id];

export const CLIENT_ALERT_TYPES = new Set(["birthday", "inactive", "package"]);
export const OPERATIONS_ALERT_TYPES = new Set(["task", "supply", "aggregate"]);
