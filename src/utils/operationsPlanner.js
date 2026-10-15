const WARSAW_TIME_ZONE = "Europe/Warsaw";
const DAY_MS = 24 * 60 * 60 * 1000;

export const TASK_KIND_OPTIONS = [
  {id: "daily", label: "Регулярное дело"},
  {id: "development", label: "Задача развития"},
];

export const TASK_PRIORITY_OPTIONS = [
  {id: "low", label: "Низкий"},
  {id: "medium", label: "Средний"},
  {id: "high", label: "Высокий"},
];

export const TASK_STATUS_OPTIONS = [
  {id: "active", label: "В работе"},
  {id: "completed", label: "Готово"},
  {id: "paused", label: "Пауза"},
];

export const WORK_AREA_OPTIONS = [
  {id: "acquisition", label: "01. Привлечение новых клиентов"},
  {id: "sales", label: "02. Продажи и работа с клиентами"},
  {id: "content", label: "03. Контент и социальные сети"},
  {id: "retention", label: "04. Удержание клиентов и репутация"},
  {id: "growth", label: "05. Развитие бизнеса и партнёрства"},
  {id: "studio", label: "06. Управление студией и командой"},
  {id: "finance", label: "07. Финансы и аналитика"},
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (value) => String(value).padStart(2, "0");

const getWarsawParts = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
  })
    .formatToParts(date)
    .reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});

export const getWarsawTodayInput = (date = new Date()) => {
  const parts = getWarsawParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getWarsawTime = (date = new Date()) => {
  const parts = getWarsawParts(date);
  return `${parts.hour}:${parts.minute}`;
};

export const isInputDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

export const normalizeInputDate = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] ?? "";
};

export const addDays = (date, days) => {
  if (!isInputDate(date)) return "";
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + Number(days || 0));
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
};

export const compareInputDates = (left, right) =>
  String(left || "").localeCompare(String(right || ""));

export const getIsoWeekday = (date) => {
  if (!isInputDate(date)) return 1;
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

export const getWeekStart = (date) => {
  const weekday = getIsoWeekday(date);
  return addDays(date, 1 - weekday);
};

export const getWeekDays = (date) => {
  const start = getWeekStart(date);
  return Array.from({length: 7}, (_, index) => {
    const input = addDays(start, index);
    return {
      input,
      label: WEEKDAY_LABELS[index],
    };
  });
};

export const formatDateShort = (date) => {
  if (!isInputDate(date)) return "Без даты";
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
};

const objectPayload = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const taskRecord = (task) => objectPayload(task);

export const getTaskPayload = (task = {}) => {
  const basePayload = objectPayload(task?.basePayload);
  const raw = Object.keys(basePayload).length ? basePayload : objectPayload(task?.payload);
  const nested = objectPayload(raw.payload);
  if (Object.keys(nested).length) {
    const rest = {...raw};
    delete rest.payload;
    return {...rest, ...nested};
  }
  return raw;
};

const normalizePriorityId = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (["high", "высокий"].includes(text)) return "high";
  if (["low", "низкий"].includes(text)) return "low";
  return "medium";
};

const priorityLabelById = (id) =>
  TASK_PRIORITY_OPTIONS.find((option) => option.id === id)?.label ?? "Средний";

export const getTaskKind = (task = {}) => {
  const payload = getTaskPayload(task);
  const kind = String(payload.taskKind ?? payload.kind ?? "").trim();
  return kind === "development" ? "development" : "daily";
};

export const getTaskKindLabel = (task = {}) =>
  TASK_KIND_OPTIONS.find((option) => option.id === getTaskKind(task))?.label ?? "Регулярное дело";

export const getTaskAreaId = (task = {}) =>
  String(getTaskPayload(task).areaId ?? "general").trim() || "general";

export const getTaskAreaLabel = (task = {}) =>
  String(getTaskPayload(task).areaLabel ?? "").trim() ||
  (WORK_AREA_OPTIONS.find((option) => option.id === getTaskAreaId(task))?.label ?? "Другие задачи");

export const getTaskResultFields = (task = {}) => {
  const fields = getTaskPayload(task).resultFields;
  return Array.isArray(fields)
    ? fields.map((field, index) => ({
        id: String(field?.id ?? `result-${index}`),
        label: String(field?.label ?? "Результат").trim(),
        required: field?.required === true,
        type: ["date", "number", "textarea"].includes(field?.type) ? field.type : "text",
        unit: String(field?.unit ?? "").trim(),
      })).filter((field) => field.label)
    : [];
};

export const getTaskOccurrenceRecord = (task = {}, date = getTaskDueDate(task)) =>
  getTaskPayload(task).occurrences?.[date] ?? {};

export const getTaskAssigneeId = (task = {}) => {
  const record = taskRecord(task);
  return String(getTaskPayload(record).assigneeId ?? record.assigneeId ?? "").trim();
};

export const getTaskAssigneeName = (task = {}) => {
  const record = taskRecord(task);
  return String(getTaskPayload(record).assigneeName ?? record.assigneeName ?? "").trim();
};

export const getTaskDueDate = (task = {}) => {
  const record = taskRecord(task);
  return normalizeInputDate(record.occurrenceDate ?? getTaskPayload(record).dueDate ?? record.dueDate);
};

export const getTaskDueTime = (task = {}) => {
  const record = taskRecord(task);
  return String(record.occurrenceDueTime ?? getTaskPayload(record).dueTime ?? "").trim();
};

export const getTaskEstimateMinutes = (task = {}) => {
  const record = taskRecord(task);
  return Math.max(0, Number(record.occurrenceEstimateMinutes ?? getTaskPayload(record).estimateMinutes) || 0);
};

export const getTaskPriorityId = (task = {}) => {
  const record = taskRecord(task);
  return normalizePriorityId(getTaskPayload(record).priorityId ?? record.priority);
};

export const getTaskPriorityLabel = (task = {}) =>
  priorityLabelById(getTaskPriorityId(task));

export const getTaskChecklist = (task = {}) => {
  const record = taskRecord(task);
  const payload = getTaskPayload(record);
  const list = record.occurrenceChecklist ?? payload.checklist;
  return Array.isArray(list)
    ? list.map((item, index) => ({
        done: item?.done === true,
        id: String(item?.id ?? `item-${index}`),
        text: String(item?.text ?? "").trim(),
      })).filter((item) => item.text)
    : [];
};

export const getChecklistProgress = (task = {}) => {
  const items = getTaskChecklist(task);
  if (!items.length) return {done: 0, total: 0};
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
};

export const isTaskCompleted = (task = {}) =>
  taskRecord(task).occurrenceStatus === "completed" ||
  taskRecord(task).status === "completed" ||
  taskRecord(task).completed === true;

export const isTaskRepeating = (task = {}) => {
  const payload = getTaskPayload(task);
  return payload.repeat?.enabled === true || payload.taskKind === "daily";
};

export const isTaskMainOnDate = (task = {}, date = getTaskDueDate(task)) => {
  const payload = getTaskPayload(task);
  const occurrence = payload.occurrences?.[date];
  if (occurrence?.isMain === true) return true;
  return payload.isMain === true && normalizeInputDate(payload.mainDate ?? getTaskDueDate(task)) === date;
};

export const isTaskOverdue = (
  task = {},
  today = getWarsawTodayInput(),
  nowTime = getWarsawTime(),
) => {
  if (isTaskCompleted(task)) return false;
  const dueDate = getTaskDueDate(task);
  if (!dueDate) return false;
  if (compareInputDates(dueDate, today) < 0) return true;
  const dueTime = getTaskDueTime(task);
  return dueDate === today && dueTime && dueTime <= nowTime;
};

export const getTaskStatusLabel = (task = {}, today, nowTime) => {
  const record = taskRecord(task);
  if (isTaskCompleted(task)) return "Готово";
  if (isTaskOverdue(task, today, nowTime)) return "Просрочено";
  if (record.status === "paused") return "Пауза";
  const occurrence = getTaskOccurrenceRecord(task);
  const hasProgress = getTaskChecklist(task).some((item) => item.done) ||
    Object.values(objectPayload(record.occurrenceResults ?? occurrence.results)).some((value) => String(value ?? "").trim()) ||
    Boolean(String(record.occurrenceComment ?? occurrence.comment ?? "").trim());
  return hasProgress ? "В процессе" : "Не начата";
};

const weeksBetween = (startDate, date) => {
  const startWeek = getWeekStart(startDate);
  const dateWeek = getWeekStart(date);
  return Math.floor(
    (new Date(`${dateWeek}T12:00:00.000Z`) - new Date(`${startWeek}T12:00:00.000Z`)) /
      (7 * DAY_MS),
  );
};

export const occursOnDate = (task = {}, date) => {
  const payload = getTaskPayload(task);
  const repeat = payload.repeat ?? {};
  if (payload.templateArchived === true) return false;
  if (!isTaskRepeating(task) || !isInputDate(date)) return false;

  const startDate = normalizeInputDate(repeat.startDate ?? getTaskDueDate(task));
  if (!startDate || compareInputDates(date, startDate) < 0) return false;
  const endDate = normalizeInputDate(repeat.endDate);
  if (endDate && compareInputDates(date, endDate) > 0) return false;

  const weekday = getIsoWeekday(date);
  const selectedDays = Array.isArray(repeat.weekdays)
    ? repeat.weekdays.map(Number).filter((item) => item >= 1 && item <= 7)
    : [];
  const frequency = repeat.frequency ?? "daily";

  if (frequency === "daily") return true;
  if (frequency === "monthly") return date.slice(8, 10) === startDate.slice(8, 10);
  if (frequency === "weekdays") return selectedDays.includes(weekday);
  if (frequency === "weekly") {
    return selectedDays.length
      ? selectedDays.includes(weekday)
      : weekday === getIsoWeekday(startDate);
  }
  if (frequency === "intervalWeeks") {
    const interval = Math.max(1, Number(repeat.intervalWeeks) || 1);
    return weeksBetween(startDate, date) % interval === 0 && selectedDays.includes(weekday);
  }

  return false;
};

export const createTaskOccurrence = (task = {}, date) => {
  const record = taskRecord(task);
  const payload = getTaskPayload(record);
  const occurrence = payload.occurrences?.[date] ?? {};
  const checklist = occurrence.checklist ?? payload.checklist;
  return {
    ...record,
    baseCompleted: record.completed,
    baseCreatedAt: record.createdAt,
    baseDescription: record.description,
    baseDueDate: record.dueDate,
    baseId: record.id,
    baseNote: record.note,
    basePayload: payload,
    basePriority: record.priority,
    baseSortOrder: record.sortOrder,
    baseStatus: record.status,
    baseTitle: record.title,
    baseUpdatedAt: record.updatedAt,
    id: `${record.id}::${date}`,
    isVirtualOccurrence: true,
    occurrenceDate: date,
    occurrenceDueTime: occurrence.dueTime ?? payload.dueTime ?? "",
    occurrenceEstimateMinutes: occurrence.estimateMinutes ?? payload.estimateMinutes ?? 0,
    occurrenceKey: date,
    occurrenceStatus: occurrence.status ?? record.status ?? "active",
    occurrenceChecklist: checklist,
    occurrenceComment: occurrence.comment ?? "",
    occurrenceResults: objectPayload(occurrence.results),
    note: occurrence.note ?? record.note,
    payload: {
      ...payload,
      isMain: occurrence.isMain === true || (payload.isMain === true && payload.mainDate === date),
      mainDate: date,
    },
    status: occurrence.status ?? record.status ?? "active",
    title: occurrence.title ?? record.title,
  };
};

export const expandTasksForRange = (tasks = [], startDate, endDate, {includeNoDate = false} = {}) => {
  const result = [];
  const rangeStart = normalizeInputDate(startDate);
  const rangeEnd = normalizeInputDate(endDate || startDate);

  for (const task of tasks) {
    if (task?.type === "note") continue;
    const dueDate = getTaskDueDate(task);

    if (isTaskRepeating(task)) {
      const generatedDates = new Set();
      for (let date = rangeStart; date && compareInputDates(date, rangeEnd) <= 0; date = addDays(date, 1)) {
        if (occursOnDate(task, date)) {
          generatedDates.add(date);
          const occurrence = createTaskOccurrence(task, date);
          if (occurrence.occurrenceStatus !== "cancelled") result.push(occurrence);
        }
      }

      const occurrences = getTaskPayload(task).occurrences ?? {};
      Object.entries(occurrences).forEach(([date, occurrence]) => {
        if (!occurrence?.force || generatedDates.has(date)) return;
        if (compareInputDates(date, rangeStart) < 0 || compareInputDates(date, rangeEnd) > 0) return;
        const forcedOccurrence = createTaskOccurrence(task, date);
        if (forcedOccurrence.occurrenceStatus !== "cancelled") result.push(forcedOccurrence);
      });
      continue;
    }

    if (dueDate) {
      if (compareInputDates(dueDate, rangeStart) >= 0 && compareInputDates(dueDate, rangeEnd) <= 0) {
        result.push(createTaskOccurrence(task, dueDate));
      }
    } else if (includeNoDate) {
      result.push(task);
    }
  }

  return result;
};

export const getOverdueTasks = (tasks = [], today = getWarsawTodayInput(), nowTime = getWarsawTime()) => {
  const start = addDays(today, -60);
  return expandTasksForRange(tasks, start, today)
    .filter((task) => getTaskDueDate(task) !== today || getTaskDueTime(task))
    .filter((task) => {
      if (!isTaskRepeating(task)) return isTaskOverdue(task, today, nowTime);
      const occurrence = getTaskOccurrenceRecord(task);
      return Object.keys(occurrence).length > 0 && isTaskOverdue(task, today, nowTime);
    });
};

export const applyOperationsFilters = (tasks = [], filters = {}) => {
  const query = String(filters.query ?? "").trim().toLowerCase();
  return tasks.filter((task) => {
    if (!filters.showCompleted && isTaskCompleted(task)) return false;
    if (filters.assigneeId === "__none__" && getTaskAssigneeId(task)) return false;
    if (filters.assigneeId && filters.assigneeId !== "__all__" && filters.assigneeId !== "__none__") {
      if (getTaskAssigneeId(task) !== filters.assigneeId) return false;
    }
    if (filters.taskKind && filters.taskKind !== "__all__" && getTaskKind(task) !== filters.taskKind) return false;
    if (filters.priority && filters.priority !== "__all__" && getTaskPriorityId(task) !== filters.priority) return false;
    if (filters.status && filters.status !== "__all__") {
      const status = isTaskCompleted(task) ? "completed" : task.status === "paused" ? "paused" : "active";
      if (status !== filters.status) return false;
    }
    if (query) {
      const haystack = [
        task.title,
        task.note,
        task.description,
        getTaskPayload(task).outcome,
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
};

export const sortPlanTasks = (tasks = []) =>
  [...tasks].sort((left, right) => {
    if (isTaskMainOnDate(left, getTaskDueDate(left)) !== isTaskMainOnDate(right, getTaskDueDate(right))) {
      return isTaskMainOnDate(left, getTaskDueDate(left)) ? -1 : 1;
    }
    const leftTime = getTaskDueTime(left) || "99:99";
    const rightTime = getTaskDueTime(right) || "99:99";
    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
    if (getTaskPriorityId(left) !== getTaskPriorityId(right)) {
      const weight = {high: 0, medium: 1, low: 2};
      return weight[getTaskPriorityId(left)] - weight[getTaskPriorityId(right)];
    }
    return String(left.title ?? "").localeCompare(String(right.title ?? ""), "ru");
  });

export const getDayStats = (tasks = []) => {
  const planned = tasks.length;
  const completed = tasks.filter(isTaskCompleted).length;
  const remainingMinutes = tasks
    .filter((task) => !isTaskCompleted(task))
    .reduce((total, task) => total + getTaskEstimateMinutes(task), 0);
  return {
    completed,
    planned,
    progress: planned ? Math.round((completed / planned) * 100) : 0,
    remainingMinutes,
  };
};

const getBaseTaskFromOccurrence = (task, payload) => ({
  completed: task.baseCompleted ?? task.completed,
  createdAt: task.baseCreatedAt ?? task.createdAt,
  description: task.baseDescription ?? task.description,
  dueDate: task.baseDueDate ?? task.dueDate,
  id: task.baseId ?? task.id,
  note: task.baseNote ?? task.note,
  payload,
  priority: task.basePriority ?? task.priority,
  sortOrder: task.baseSortOrder ?? task.sortOrder,
  status: task.baseStatus ?? task.status,
  title: task.baseTitle ?? task.title,
  type: task.type,
  updatedAt: task.baseUpdatedAt ?? task.updatedAt,
});

export const patchOccurrence = (task, date, patch = {}) => {
  const payload = objectPayload(task?.basePayload) && Object.keys(objectPayload(task?.basePayload)).length
    ? objectPayload(task.basePayload)
    : getTaskPayload(task);
  const current = payload.occurrences?.[date] ?? {};
  const nextPayload = {
    ...payload,
    occurrences: {
      ...(payload.occurrences ?? {}),
      [date]: {
        ...current,
        ...patch,
      },
    },
  };

  if (task?.isVirtualOccurrence) {
    return getBaseTaskFromOccurrence(task, nextPayload);
  }

  return {
    ...task,
    payload: {
      ...nextPayload,
    },
  };
};

export const buildMovedTask = (task, nextDate) => {
  if (task.isVirtualOccurrence) {
    const payload = getTaskPayload(task);
    const previousDate = task.occurrenceDate;
    const currentOccurrence = payload.occurrences?.[previousDate] ?? {};
    const cancelledTask = patchOccurrence(task, previousDate, {
      movedTo: nextDate,
      status: "cancelled",
    });
    const nextPayload = getTaskPayload(cancelledTask);
    return {
      ...cancelledTask,
      payload: {
        ...nextPayload,
        occurrences: {
          ...(nextPayload.occurrences ?? {}),
          [nextDate]: {
            ...currentOccurrence,
            checklist: getTaskChecklist(task),
            dueTime: getTaskDueTime(task),
            estimateMinutes: getTaskEstimateMinutes(task),
            force: true,
            isMain: isTaskMainOnDate(task, previousDate),
            movedFrom: previousDate,
            note: task.note,
            status: "active",
            title: task.title,
          },
        },
      },
    };
  }
  const payload = getTaskPayload(task);
  return {
    ...task,
    dueDate: nextDate,
    payload: {
      ...payload,
      dueDate: nextDate,
      ...(payload.isMain ? {mainDate: nextDate} : {}),
    },
  };
};
