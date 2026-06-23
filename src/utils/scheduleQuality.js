const PROBLEM_STATUSES = new Set(["scheduled", "confirmed", "completed"]);
const CANCELLED_STATUSES = new Set(["cancelled", "no_show"]);

const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const findClient = (entry, clients = []) => {
  if (entry.clientId) {
    const byId = clients.find((client) => String(client.id) === String(entry.clientId));

    if (byId) {
      return byId;
    }
  }

  const name = normalizeText(entry.client);

  return clients.find((client) => normalizeText(client.name) === name) ?? null;
};

const buildIssue = ({action = "calendar", entry, id, message, priority, title, type}) => ({
  action,
  date: entry?.date ?? "",
  entryId: entry?.id ?? "",
  id,
  message,
  priority,
  title,
  type,
});

const groupByDateAndMaster = (entries) => {
  const groups = new Map();

  entries.forEach((entry) => {
    const key = `${entry.date || ""}::${entry.master || ""}`;
    const current = groups.get(key) ?? [];

    groups.set(key, [...current, entry]);
  });

  return Array.from(groups.values());
};

export const buildScheduleQualityReport = ({
  calendarEntries = [],
  clientProfiles = [],
  date,
  minGapMinutes = 10,
} = {}) => {
  const scopedEntries = calendarEntries
    .filter((entry) => entry?.kind === "visit")
    .filter((entry) => (date ? entry.date === date : true));
  const activeEntries = scopedEntries
    .filter((entry) => PROBLEM_STATUSES.has(String(entry.status ?? "scheduled")))
    .map((entry) => ({
      ...entry,
      endMinutes: toMinutes(entry.time) + Math.max(0, Number(entry.duration) || 0),
      startMinutes: toMinutes(entry.time),
    }));
  const issues = [];

  groupByDateAndMaster(activeEntries).forEach((group) => {
    const sorted = [...group].sort((left, right) => left.startMinutes - right.startMinutes);

    sorted.forEach((entry, index) => {
      const next = sorted[index + 1];

      if (!next) {
        return;
      }

      if (entry.endMinutes > next.startMinutes) {
        issues.push(
          buildIssue({
            entry,
            id: `overlap-${entry.id}-${next.id}`,
            message: `${entry.master || "Мастер"} · ${entry.time}-${toClockTime(
              entry.endMinutes,
            )} пересекается с ${next.time}`,
            priority: "critical",
            title: "Пересечение визитов",
            type: "calendar",
          }),
        );
      } else if (next.startMinutes - entry.endMinutes < minGapMinutes) {
        issues.push(
          buildIssue({
            entry,
            id: `gap-${entry.id}-${next.id}`,
            message: `${entry.master || "Мастер"} · между ${toClockTime(
              entry.endMinutes,
            )} и ${next.time} меньше ${minGapMinutes} мин`,
            priority: "action",
            title: "Короткий промежуток между визитами",
            type: "calendar",
          }),
        );
      }
    });
  });

  scopedEntries.forEach((entry) => {
    const status = String(entry.status ?? "scheduled");
    const client = findClient(entry, clientProfiles);

    if (!String(entry.client ?? "").trim()) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-client-${entry.id}`,
          message: `${entry.time} · ${entry.service || "Визит"}`,
          priority: "critical",
          title: "Запись без клиента",
          type: "calendar",
        }),
      );
    } else if (!String(client?.phone ?? entry.clientPhone ?? "").trim()) {
      issues.push(
        buildIssue({
          action: "clients",
          entry,
          id: `missing-phone-${entry.id}`,
          message: `${entry.client} · ${entry.time}`,
          priority: "action",
          title: "У клиента нет телефона",
          type: "client",
        }),
      );
    }

    if (status === "completed") {
      if (!(Number(entry.amount) > 0)) {
        issues.push(
          buildIssue({
            entry,
            id: `missing-amount-${entry.id}`,
            message: `${entry.client || "Клиент"} · ${entry.time}`,
            priority: "critical",
            title: "Завершённый визит без суммы",
            type: "finance",
          }),
        );
      }

      if (!String(entry.payment ?? "").trim() || entry.payment === "Не указано") {
        issues.push(
          buildIssue({
            entry,
            id: `missing-payment-${entry.id}`,
            message: `${entry.client || "Клиент"} · ${entry.time}`,
            priority: "action",
            title: "Не указан способ оплаты",
            type: "finance",
          }),
        );
      }
    }

    if (CANCELLED_STATUSES.has(status) && !String(entry.note ?? "").trim()) {
      issues.push(
        buildIssue({
          entry,
          id: `missing-cancel-reason-${entry.id}`,
          message: `${entry.client || "Клиент"} · ${entry.time}`,
          priority: "info",
          title: status === "no_show" ? "Неявка без комментария" : "Отмена без причины",
          type: "calendar",
        }),
      );
    }
  });

  const priorityOrder = {critical: 0, action: 1, info: 2};
  const sortedIssues = issues.sort(
    (left, right) =>
      (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2),
  );

  return {
    criticalCount: sortedIssues.filter((issue) => issue.priority === "critical").length,
    issues: sortedIssues,
    ok: sortedIssues.length === 0,
    warningCount: sortedIssues.filter((issue) => issue.priority === "action").length,
  };
};
