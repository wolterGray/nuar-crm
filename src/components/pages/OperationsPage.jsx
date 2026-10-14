import {useEffect, useMemo, useRef, useState} from "react";
import WaitlistPanel from "../WaitlistPanel.jsx";
import PageHeader from "../PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {
  getSupplyStockStatus,
  getSupplyStockStatusLabel,
  isSupplyLowStock,
} from "../../utils/supplyStock.js";
import {openSupplyOrderUrl} from "../../utils/supplyOrder.js";
import {
  TASK_KIND_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  addDays,
  applyOperationsFilters,
  createTaskOccurrence,
  expandTasksForRange,
  formatDateShort,
  getChecklistProgress,
  getDayStats,
  getOverdueTasks,
  getTaskAssigneeName,
  getTaskAreaId,
  getTaskAreaLabel,
  getTaskDueDate,
  getTaskDueTime,
  getTaskEstimateMinutes,
  getTaskKindLabel,
  getTaskPayload,
  getTaskPriorityId,
  getTaskPriorityLabel,
  getTaskResultFields,
  getTaskStatusLabel,
  getWarsawTime,
  getWarsawTodayInput,
  getWeekDays,
  getWeekStart,
  isTaskCompleted,
  isTaskMainOnDate,
  isTaskOverdue,
  isTaskRepeating,
  occursOnDate,
  sortPlanTasks,
} from "../../utils/operationsPlanner.js";
import {
  AppIcon,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  IconButton,
  Input,
  Select,
} from "../ui/index.js";

const NOTE_CATEGORIES = ["Мысль", "Заказать", "Идея", "Личное"];
const VIEW_STORAGE_KEY = "nuar-crm-operations-view-v2";
const FILTER_STORAGE_KEY = "nuar-crm-operations-filters-v3";

const DEFAULT_FILTERS = {
  assigneeId: "__all__",
  priority: "__all__",
  query: "",
  showCompleted: true,
  status: "__all__",
  taskKind: "__all__",
};

const ACQUISITION_TEMPLATE_KEYS = [
  "acquisition-meta-control",
  "acquisition-channel-control",
  "acquisition-partners",
  "acquisition-results-accounting",
];

const readStoredJson = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? {...fallback, ...JSON.parse(value)} : fallback;
  } catch {
    return fallback;
  }
};

const formatMinutes = (minutes) => {
  const value = Math.max(0, Number(minutes) || 0);
  if (!value) return "0 мин";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
};

const formatPlannerDate = (date) => {
  if (!date) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00`));
};

const getMonthRange = (date) => {
  const [year, month] = String(date).split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${endDay}`};
};

const formatTaskDateTime = (task) => {
  const date = getTaskDueDate(task);
  const time = getTaskDueTime(task);
  if (!date && !time) return "Без даты";
  return [date || "Без даты", time].filter(Boolean).join(" · ");
};

const formatRepeatSchedule = (task) => {
  const repeat = getTaskPayload(task).repeat ?? {};
  if (!repeat.enabled) return "Однократно";
  if (repeat.frequency === "daily") return "Каждый день";
  if (repeat.frequency === "monthly") return "Ежемесячно";
  if (repeat.frequency === "weekly") return "Еженедельно";
  if (repeat.frequency === "intervalWeeks") return `Каждые ${repeat.intervalWeeks || 1} нед.`;
  return "По рабочим / выбранным дням";
};

function SegmentButton({active, children, onClick}) {
  return (
    <Button
      className={active ? "active" : ""}
      size="sm"
      type="button"
      variant="ghost"
      onClick={onClick}>
      {children}
    </Button>
  );
}

function TaskCard({
  nowTime,
  onComplete,
  onDelete,
  onEdit,
  onMain,
  onMove,
  onView,
  openMenuId,
  setOpenMenuId,
  task,
  today,
}) {
  const dueDate = getTaskDueDate(task);
  const status = getTaskStatusLabel(task, today, nowTime);
  const isCompleted = isTaskCompleted(task);
  const isMain = isTaskMainOnDate(task, dueDate);
  const isOverdue = isTaskOverdue(task, today, nowTime);
  const checklist = getChecklistProgress(task);
  const assigneeName = getTaskAssigneeName(task) || "Без исполнителя";
  const priority = getTaskPriorityId(task);

  return (
    <article
      className={[
        "operations-work-card",
        isCompleted ? "is-completed" : "",
        isMain ? "is-main" : "",
        isOverdue ? "is-overdue" : "",
      ].filter(Boolean).join(" ")}>
      <IconButton
        className={`operations-task-check ${isCompleted ? "is-on" : ""}`}
        icon={isCompleted ? "rotateCcw" : "check"}
        label={isCompleted ? "Вернуть задачу" : "Завершить задачу"}
        size="sm"
        variant="ghost"
        onClick={() => onComplete(task)}
      />
      <button
        className="operations-work-card-main"
        type="button"
        onClick={() => onView(task)}>
        <span className="operations-work-card-title">
          {isMain ? <AppIcon name="star" size="sm" /> : null}
          <strong>{task.title}</strong>
        </span>
        {task.note ? <small>{task.note}</small> : null}
        <span className="operations-work-card-meta">
          <em>{getTaskKindLabel(task)}</em>
          {getTaskAssigneeName(task) ? <em>{assigneeName}</em> : null}
          {dueDate !== today || getTaskDueTime(task) ? <em>{formatTaskDateTime(task)}</em> : null}
          {getTaskEstimateMinutes(task) ? <em>{formatMinutes(getTaskEstimateMinutes(task))}</em> : null}
          {priority !== "medium" ? <em>{getTaskPriorityLabel(task)}</em> : null}
          {checklist.total ? <em>{checklist.done}/{checklist.total}</em> : null}
          {status !== "В работе" ? <em>{status}</em> : null}
        </span>
      </button>
      <RowActionsMenu
        className="operations-row-actions"
        extraActions={[
          {
            icon: "calendar",
            label: "Перенести",
            onClick: () => onMove(task),
          },
          {
            disabled: !dueDate,
            icon: "star",
            label: "Главная",
            onClick: () => onMain(task),
          },
          {
            icon: isCompleted ? "rotateCcw" : "check",
            label: isCompleted ? "Вернуть" : "Завершить",
            onClick: () => onComplete(task),
          },
        ]}
        itemId={`task-${task.id}`}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onDelete={() => onDelete(task)}
        onEdit={() => onEdit(task)}
        onView={() => onView(task)}
      />
    </article>
  );
}

function TaskDetailsDialog({item, nowTime, onClose, onDelete, onEdit, onSave, today}) {
  const [checklist, setChecklist] = useState(() => item?.occurrenceChecklist ?? getTaskPayload(item).checklist ?? []);
  const [results, setResults] = useState(() => item?.occurrenceResults ?? {});
  const [comment, setComment] = useState(() => item?.occurrenceComment ?? "");
  const [saving, setSaving] = useState(false);

  if (!item) return null;
  const progress = getChecklistProgress({...item, occurrenceChecklist: checklist});
  const resultFields = getTaskResultFields(item);
  const missingRequiredResult = resultFields.some((field) => field.required && String(results[field.id] ?? "").trim() === "");
  const history = Object.entries(getTaskPayload(item).occurrences ?? {})
    .filter(([, record]) => record?.status === "completed" || Object.keys(record?.results ?? {}).length)
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 8);

  const save = async (status) => {
    const missing = status === "completed"
      ? resultFields.find((field) => field.required && String(results[field.id] ?? "").trim() === "")
      : null;
    if (missing) return;
    setSaving(true);
    const saved = await onSave?.(item, {
      checklist,
      comment: comment.trim(),
      results,
      ...(status ? {completedAt: new Date().toISOString(), status} : {}),
    });
    setSaving(false);
    if (saved && status === "completed") onClose();
  };

  return (
    <Dialog open={Boolean(item)}>
      <DialogBackdrop className="operations-detail-backdrop" onClick={onClose}>
        <DialogContent
          aria-labelledby="operation-detail-title"
          className="operations-detail-dialog"
          role="dialog"
          onClick={(event) => event.stopPropagation()}>
          <header className="operations-detail-header">
            <div>
              <span>{getTaskKindLabel(item)}</span>
              <h2 id="operation-detail-title">{item.title}</h2>
            </div>
            <IconButton
              aria-label="Закрыть"
              icon="x"
              size="sm"
              title="Закрыть"
              variant="ghost"
              onClick={onClose}
            />
          </header>
          <div className="operations-detail-body">
            <div className="operations-detail-meta">
              <span>{formatTaskDateTime(item)}</span>
              <span>{getTaskAssigneeName(item) || "Без исполнителя"}</span>
              <span>{getTaskPriorityLabel(item)}</span>
              <span>{getTaskStatusLabel(item, today, nowTime)}</span>
              <span>{formatRepeatSchedule(item)}</span>
              {getTaskEstimateMinutes(item) ? <span>{formatMinutes(getTaskEstimateMinutes(item))}</span> : null}
              {progress.total ? <span>Чек-лист {progress.done}/{progress.total}</span> : null}
            </div>
            <section className="operations-detail-text">
              <p>{item.note || item.description || "Без описания"}</p>
            </section>
            {getTaskPayload(item).instructions ? (
              <section className="operations-detail-section operations-detail-instructions">
                <h3>Как выполнить</h3>
                <p>{getTaskPayload(item).instructions}</p>
              </section>
            ) : null}
            {checklist.length ? (
              <section className="operations-detail-section">
                <h3>Действия <span>{progress.done}/{progress.total}</span></h3>
                <div className="operations-detail-checklist">
                  {checklist.map((entry) => (
                    <label key={entry.id}>
                      <input checked={entry.done === true} type="checkbox" onChange={(event) => setChecklist((current) => current.map((value) => value.id === entry.id ? {...value, done: event.target.checked} : value))} />
                      <span>{entry.text}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {resultFields.length ? (
              <section className="operations-detail-section">
                <h3>Результат</h3>
                <div className="operations-result-grid">
                  {resultFields.map((field) => (
                    <label key={field.id}>
                      <span>{field.label}{field.required ? " *" : ""}</span>
                      {field.type === "textarea" ? (
                        <textarea rows="3" value={results[field.id] ?? ""} onChange={(event) => setResults((current) => ({...current, [field.id]: event.target.value}))} />
                      ) : (
                        <span className="operations-result-input"><input min={field.type === "number" ? "0" : undefined} type={field.type} value={results[field.id] ?? ""} onChange={(event) => setResults((current) => ({...current, [field.id]: event.target.value}))} />{field.unit ? <em>{field.unit}</em> : null}</span>
                      )}
                    </label>
                  ))}
                </div>
                {missingRequiredResult ? <small className="operations-result-hint">Заполните обязательные поля, чтобы завершить задачу.</small> : null}
              </section>
            ) : null}
            <section className="operations-detail-section">
              <h3>Комментарий</h3>
              <textarea rows="3" value={comment} placeholder="Выводы, проблемы или следующее действие" onChange={(event) => setComment(event.target.value)} />
            </section>
            {history.length ? (
              <details className="operations-task-history">
                <summary>Предыдущие выполнения ({history.length})</summary>
                {history.map(([date, record]) => (
                  <div key={date}><strong>{formatDateShort(date)}</strong><span>{record.comment || (record.status === "completed" ? "Выполнено" : "Результат сохранён")}</span></div>
                ))}
              </details>
            ) : null}
          </div>
          <footer className="operations-detail-actions">
            <Button disabled={saving} size="sm" variant="secondary" onClick={() => save()}>Сохранить</Button>
            <Button disabled={saving || isTaskCompleted(item) || missingRequiredResult} leftIcon="check" size="sm" variant="primary" onClick={() => save("completed")}>Завершить за день</Button>
            <Button leftIcon="edit" size="sm" variant="secondary" onClick={() => onEdit(item)}>
              Изменить
            </Button>
            <Button className="operations-detail-delete" leftIcon="trash" size="sm" variant="danger" onClick={() => onDelete(item)}>
              Удалить
            </Button>
          </footer>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}

function WorkAreaGroup({label, onAddTask, tasks, ...cardProps}) {
  const completed = tasks.filter(isTaskCompleted).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  return (
    <details className="operations-area" open>
      <summary>
        <span><strong>{label}</strong><small>{completed} из {tasks.length} выполнено</small></span>
        <span className="operations-area-progress"><i style={{width: `${progress}%`}} /><em>{progress}%</em></span>
      </summary>
      <div className="operations-area-actions">
        <Button leftIcon="plus" size="sm" variant="ghost" onClick={onAddTask}>Добавить задачу</Button>
      </div>
      <div className="operations-task-list">
        {tasks.map((task) => <TaskCard key={task.id} task={task} {...cardProps} />)}
      </div>
    </details>
  );
}

function TaskGroup({empty, onAddTask, tasks, title, ...cardProps}) {
  return (
    <section className="operations-plan-group">
      <header>
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </header>
      {tasks.length ? (
        <div className="operations-task-list">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} {...cardProps} />
          ))}
        </div>
      ) : (
        <div className="operations-empty">
          <span>{empty}</span>
          {onAddTask ? (
            <Button leftIcon="plus" size="sm" variant="secondary" onClick={onAddTask}>
              Добавить
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function OperationsPage({
  alertFocus,
  employees = [],
  tasks,
  supplies,
  waitlistEntries = [],
  onAddTask,
  onAddNote,
  onAddWaitlistEntry,
  onAlertFocusHandled,
  onBookWaitlistEntry,
  onCompleteTask,
  onDeleteTask,
  onEditTask,
  onEditWaitlistEntry,
  onMessageWaitlistEntry,
  onMoveTask,
  onInitializeAcquisitionPlan,
  onRemoveWaitlistEntry,
  onSetMainTask,
  onSaveTaskOccurrence,
  onAddSupply,
  onEditSupply,
  onDeleteSupply,
  onChangeSupplyStock,
}) {
  const {isMobile} = useBreakpoint();
  const storedView = readStoredJson(VIEW_STORAGE_KEY, {});
  const [activeTab, setActiveTab] = useState(storedView.activeTab ?? "plan");
  const [planMode, setPlanMode] = useState(storedView.planMode ?? "today");
  const [selectedDate, setSelectedDate] = useState(storedView.selectedDate ?? getWarsawTodayInput());
  const [filters, setFilters] = useState(() => readStoredJson(FILTER_STORAGE_KEY, DEFAULT_FILTERS));
  const [openItemMenuId, setOpenItemMenuId] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const acquisitionSyncStarted = useRef(false);
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const today = getWarsawTodayInput();
  const nowTime = getWarsawTime();

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({activeTab, planMode, selectedDate}));
  }, [activeTab, planMode, selectedDate]);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (!alertFocus?.entityId) return undefined;
    const nextTab =
      alertFocus.section === "supplies"
        ? "supplies"
        : alertFocus.section === "tasks" || alertFocus.type === "task"
          ? "plan"
          : null;
    const focusTimer = nextTab ? window.setTimeout(() => setActiveTab(nextTab), 0) : null;
    const clearTimer = window.setTimeout(() => onAlertFocusHandled?.(), 4500);
    return () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      window.clearTimeout(clearTimer);
    };
  }, [alertFocus, onAlertFocusHandled]);

  const notes = tasks.filter((task) => task.type === "note");
  const legacyAcquisitionRecord = tasks.find((task) => !getTaskPayload(task).templateKey && String(task.title ?? "").trim().toLocaleLowerCase("ru") === "01. привлечение новых клиентов");
  const workTasks = tasks.filter((task) => task.type !== "note" && getTaskPayload(task).hiddenFromPlan !== true);
  const lowStockCount = supplies.filter(isSupplyLowStock).length;
  const activeWaitlistCount = waitlistEntries.filter((entry) => entry.status === "active").length;
  const sortedSupplies = useMemo(
    () =>
      [...supplies].sort((left, right) => {
        const leftLow = isSupplyLowStock(left) ? 0 : 1;
        const rightLow = isSupplyLowStock(right) ? 0 : 1;
        if (leftLow !== rightLow) return leftLow - rightLow;
        return String(left.name).localeCompare(String(right.name), "ru");
      }),
    [supplies],
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const weekStart = weekDays[0]?.input ?? getWeekStart(selectedDate);
  const weekEnd = weekDays[6]?.input ?? addDays(weekStart, 6);
  const dayTasksRaw = useMemo(
    () => expandTasksForRange(workTasks, selectedDate, selectedDate),
    [selectedDate, workTasks],
  );
  const weekTasksRaw = useMemo(
    () => expandTasksForRange(workTasks, weekStart, weekEnd),
    [weekEnd, weekStart, workTasks],
  );
  const allTasksRaw = useMemo(
    () =>
      workTasks.map((task) =>
        isTaskRepeating(task) && occursOnDate(task, selectedDate)
          ? createTaskOccurrence(task, selectedDate)
          : task,
      ),
    [selectedDate, workTasks],
  );
  const overdueTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(getOverdueTasks(workTasks, today, nowTime), filters)),
    [filters, nowTime, today, workTasks],
  );
  const dayTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(dayTasksRaw, filters)),
    [dayTasksRaw, filters],
  );
  const weekTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(weekTasksRaw, filters)),
    [filters, weekTasksRaw],
  );
  const allTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(allTasksRaw, filters)),
    [allTasksRaw, filters],
  );
  const dayStats = getDayStats(dayTasksRaw);
  const visibleAreas = useMemo(() => {
    const groups = new Map();
    dayTasks.forEach((task) => {
      const areaId = getTaskAreaId(task);
      if (!groups.has(areaId)) groups.set(areaId, {id: areaId, label: getTaskAreaLabel(task), tasks: []});
      groups.get(areaId).tasks.push(task);
    });
    return [...groups.values()].sort((left, right) => {
      if (left.id === "acquisition") return -1;
      if (right.id === "acquisition") return 1;
      return left.label.localeCompare(right.label, "ru");
    });
  }, [dayTasks]);
  const hasAcquisitionPlan = workTasks.some((task) => getTaskAreaId(task) === "acquisition");
  const acquisitionNeedsSync = ACQUISITION_TEMPLATE_KEYS.some((key) => !tasks.some((task) => getTaskPayload(task).templateKey === key));

  useEffect(() => {
    if (!tasks.length || (!legacyAcquisitionRecord && !acquisitionNeedsSync) || acquisitionSyncStarted.current || !onInitializeAcquisitionPlan) return;
    acquisitionSyncStarted.current = true;
    onInitializeAcquisitionPlan();
  }, [acquisitionNeedsSync, legacyAcquisitionRecord, onInitializeAcquisitionPlan, tasks.length]);
  const completedOccurrences = useMemo(
    () => workTasks.flatMap((task) => Object.entries(getTaskPayload(task).occurrences ?? {}).map(([date, record]) => ({date, record, task}))).filter(({record}) => record.status === "completed"),
    [workTasks],
  );
  const monthPrefix = selectedDate.slice(0, 7);
  const monthRange = getMonthRange(selectedDate);
  const reportWeekTasks = expandTasksForRange(workTasks, weekStart, weekEnd);
  const reportMonthTasks = expandTasksForRange(workTasks, monthRange.start, monthRange.end);
  const weekCompleted = completedOccurrences.filter(({date}) => date >= weekStart && date <= weekEnd).length;
  const monthCompleted = completedOccurrences.filter(({date}) => date.startsWith(monthPrefix)).length;
  const monthResults = completedOccurrences
    .filter(({date}) => date.startsWith(monthPrefix))
    .reduce((totals, {record}) => ({
      adSpend: totals.adSpend + (Number(record.results?.adSpend) || 0),
      leads: totals.leads + (Number(record.results?.leads) || 0) + (Number(record.results?.totalLeads) || 0),
      bookings: totals.bookings + (Number(record.results?.bookings) || 0) + (Number(record.results?.totalBookings) || 0),
      contacts: totals.contacts + (Number(record.results?.contacts) || 0),
    }), {adSpend: 0, bookings: 0, contacts: 0, leads: 0});
  const weekProgress = reportWeekTasks.length ? Math.min(100, Math.round((weekCompleted / reportWeekTasks.length) * 100)) : 0;
  const monthProgress = reportMonthTasks.length ? Math.min(100, Math.round((monthCompleted / reportMonthTasks.length) * 100)) : 0;

  const updateFilter = (key, value) => {
    setFilters((current) => ({...current, [key]: value}));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const submitQuickNote = (event) => {
    event.preventDefault();
    const title = noteText.trim();
    if (!title) return;
    onAddNote({category: noteCategory, title});
    setNoteText("");
  };

  const handleMoveTask = (task) => {
    const nextDate = window.prompt("Новая дата задачи (YYYY-MM-DD)", getTaskDueDate(task) || selectedDate);
    if (!nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    onMoveTask?.(task, nextDate);
  };

  const cardProps = {
    nowTime,
    onComplete: onCompleteTask,
    onDelete: onDeleteTask,
    onEdit: onEditTask,
    onMain: (task) => onSetMainTask?.(task, getTaskDueDate(task) || selectedDate),
    onMove: handleMoveTask,
    onView: setViewingTask,
    openMenuId: openItemMenuId,
    setOpenMenuId: setOpenItemMenuId,
    today,
  };

  const tabMeta = `${dayStats.completed}/${dayStats.planned} задач · ${formatMinutes(dayStats.remainingMinutes)}`;

  return (
    <section className={`operations-page operations-workspace ${isMobile ? "operations-page-mobile" : ""}`}>
      <PageHeader
        collapsedMeta={tabMeta}
        collapsible={false}
        description={isMobile ? undefined : "План дня, заметки, расходники и лист ожидания"}
        title="Операции"
        actions={
          <>
            <div className="operations-page-tabs operations-main-tabs">
              <SegmentButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")}>План работы</SegmentButton>
              <SegmentButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>Заметки</SegmentButton>
              <SegmentButton active={activeTab === "supplies"} onClick={() => setActiveTab("supplies")}>Расходники</SegmentButton>
              <SegmentButton active={activeTab === "waitlist"} onClick={() => setActiveTab("waitlist")}>Лист ожидания</SegmentButton>
            </div>
          </>
        }
      />

      {activeTab === "plan" ? (
        <div className="operations-plan-layout">
          {lowStockCount > 0 ? (
            <button className="operations-stock-alert" type="button" onClick={() => setActiveTab("supplies")}>
              <AppIcon name="packagePlus" size="sm" />
              {lowStockCount} расходников ниже минимума
            </button>
          ) : null}

          <section className="panel operations-planner-panel">
            <div className="operations-workday-label">Мой рабочий день</div>
            <div className="operations-planner-head">
              <div>
                <span>{selectedDate === today ? "Сегодня" : "Выбранный день"}</span>
                <h2>{formatPlannerDate(selectedDate)}</h2>
              </div>
              <div className="operations-date-controls">
                <IconButton icon="chevronLeft" label="Предыдущий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, planMode === "week" ? -7 : -1))} />
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                <IconButton icon="chevronRight" label="Следующий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, planMode === "week" ? 7 : 1))} />
                <Button size="sm" variant="secondary" onClick={() => setSelectedDate(today)}>Сегодня</Button>
              </div>
            </div>

            <div className="operations-workday-summary">
              <div><strong>{dayStats.planned}</strong><span>задач</span></div>
              <div><strong>{dayStats.completed}</strong><span>выполнено</span></div>
              <div><strong>{dayStats.progress}%</strong><span>прогресс</span></div>
              <div className={overdueTasks.length ? "is-alert" : ""}><strong>{overdueTasks.length}</strong><span>просрочено</span></div>
              <span className="operations-workday-progress"><i style={{width: `${dayStats.progress}%`}} /></span>
            </div>

            <div className="operations-plan-mode">
              <SegmentButton active={planMode === "today"} onClick={() => setPlanMode("today")}>Сегодня</SegmentButton>
              <SegmentButton active={planMode === "week"} onClick={() => setPlanMode("week")}>Предстоящие</SegmentButton>
              <SegmentButton active={planMode === "all"} onClick={() => setPlanMode("all")}>Все</SegmentButton>
            </div>

            <section className="operations-list-toolbar">
              <Input value={filters.query} placeholder="Поиск по задачам" onChange={(event) => updateFilter("query", event.target.value)} />
              <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({dueDate: selectedDate})}>Добавить задачу</Button>
              <details className="operations-filter-menu">
                <summary>Фильтры</summary>
                <div className="operations-filter-menu-content">
                  <label className="settings-checkbox">
                    <input checked={filters.showCompleted} type="checkbox" onChange={(event) => updateFilter("showCompleted", event.target.checked)} />
                    <span>Показывать завершённые</span>
                  </label>
                  <Select value={filters.assigneeId} onChange={(event) => updateFilter("assigneeId", event.target.value)}>
                    <option value="__all__">Все исполнители</option>
                    <option value="__none__">Без исполнителя</option>
                    {employees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name}</option>)}
                  </Select>
                  <Select value={filters.taskKind} onChange={(event) => updateFilter("taskKind", event.target.value)}>
                    <option value="__all__">Все типы</option>
                    {TASK_KIND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </Select>
                  <Select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
                    <option value="__all__">Любой приоритет</option>
                    {TASK_PRIORITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </Select>
                  <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                    <option value="__all__">Любой статус</option>
                    {TASK_STATUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" onClick={resetFilters}>Сбросить</Button>
                </div>
              </details>
            </section>

            {planMode === "today" ? (
              <div className="operations-plan-columns">
                {overdueTasks.length ? (
                  <TaskGroup title="Просрочено" tasks={overdueTasks} empty="Просроченных задач нет." {...cardProps} />
                ) : null}
                {!hasAcquisitionPlan ? (
                  <section className="operations-plan-setup">
                    <div><strong>01. Привлечение новых клиентов</strong><span>Подготовьте четыре регулярные задачи с чек-листами и измеримыми результатами.</span></div>
                    <Button size="sm" variant="secondary" onClick={onInitializeAcquisitionPlan}>Подготовить задачи</Button>
                  </section>
                ) : null}
                {visibleAreas.map((area) => (
                  <WorkAreaGroup
                    key={area.id}
                    label={area.label}
                    tasks={area.tasks}
                    onAddTask={() => onAddTask?.({areaId: area.id, dueDate: selectedDate, taskKind: "daily"})}
                    {...cardProps}
                  />
                ))}
                {!dayTasks.length && hasAcquisitionPlan ? <p className="operations-empty">На выбранный день задач нет.</p> : null}
              </div>
            ) : planMode === "week" ? (
              <div className="operations-week-list">
                {weekDays.map((day) => {
                  const tasksForDay = weekTasks.filter((task) => getTaskDueDate(task) === day.input);
                  return (
                    <section className="operations-week-day" key={day.input}>
                      <header>
                        <div><strong>{day.label}</strong><span>{formatDateShort(day.input)}</span></div>
                        <Button size="sm" variant="secondary" onClick={() => { setSelectedDate(day.input); onAddTask?.({dueDate: day.input}); }}>Добавить</Button>
                      </header>
                      {tasksForDay.length ? (
                        <div className="operations-task-list">
                          {tasksForDay.map((task) => <TaskCard key={task.id} task={task} {...cardProps} />)}
                        </div>
                      ) : <p className="operations-empty">Нет задач.</p>}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="operations-plan-columns">
                <TaskGroup title="Все задачи" tasks={allTasks.filter((task) => getTaskDueDate(task))} empty="Ничего не найдено по фильтрам." onAddTask={onAddTask} {...cardProps} />
                <TaskGroup title="Без даты" tasks={allTasks.filter((task) => !getTaskDueDate(task))} empty="Задач без даты нет." onAddTask={onAddTask} {...cardProps} />
              </div>
            )}

            <details className="operations-report">
              <summary>Итоги и история</summary>
              <div className="operations-report-grid">
                <div><span>За день</span><strong>{dayStats.completed}/{dayStats.planned}</strong><small>выполнено</small></div>
                <div><span>За неделю</span><strong>{weekProgress}%</strong><small>{weekCompleted} из {reportWeekTasks.length} задач</small></div>
                <div><span>За месяц</span><strong>{monthProgress}%</strong><small>{monthCompleted} из {reportMonthTasks.length} задач</small></div>
                <div><span>Привлечение за месяц</span><strong>{monthResults.adSpend} zł</strong><small>{monthResults.leads} обращений · {monthResults.bookings} записей · {monthResults.contacts} контактов</small></div>
              </div>
            </details>
          </section>
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <section className="panel operations-panel operations-notes-panel">
          <div className="operations-panel-header">
            <div><AppIcon name="stickyNote" size="md" /><div><h2>Заметки</h2><p>{notes.length} записей</p></div></div>
            <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.("note")}>Заметка</Button>
          </div>
          <form className="quick-note-form" onSubmit={submitQuickNote}>
            <Input value={noteText} placeholder="Мысль, идея или что заказать" onChange={(event) => setNoteText(event.target.value)} />
            <Select value={noteCategory} onChange={(event) => setNoteCategory(event.target.value)}>
              {NOTE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </Select>
            <Button leftIcon="plus" type="submit" variant="primary">Записать</Button>
          </form>
          <div className="operations-list">
            {notes.map((note) => (
              <article className="note-row" key={note.id}>
                <span className="operations-card-icon note-card-icon"><AppIcon name="stickyNote" size="sm" /></span>
                <button className="operations-card-body operations-card-view" type="button" onClick={() => setViewingTask(note)}>
                  <strong>{note.title}</strong>
                  <span>{note.priority || "Мысль"}</span>
                </button>
                <RowActionsMenu itemId={`note-${note.id}`} openMenuId={openItemMenuId} setOpenMenuId={setOpenItemMenuId} onDelete={() => onDeleteTask(note)} onEdit={() => onEditTask(note)} />
              </article>
            ))}
            {!notes.length ? <p className="operations-empty">Заметок пока нет.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "supplies" ? (
        <section className="panel operations-panel operations-panel-supplies">
          <div className="operations-panel-header">
            <div><AppIcon name="packagePlus" size="md" /><div><h2>Расходники</h2><p>{supplies.length} позиций · {lowStockCount} пополнить</p></div></div>
            <Button leftIcon="plus" size="sm" variant="primary" onClick={onAddSupply}>Добавить</Button>
          </div>
          <div className="operations-list">
            {sortedSupplies.map((item) => {
              const stockStatus = getSupplyStockStatus(item);
              return (
                <article className={`supply-row ${isSupplyLowStock(item) ? "supply-low" : ""}`} key={item.id}>
                  <div className="operations-card-head">
                    <span className="operations-card-icon supply-card-icon"><AppIcon name="packagePlus" size="sm" /></span>
                    <div className="operations-card-body">
                      <strong>{item.name}</strong>
                      <span>{item.note || "Расходный материал"}</span>
                    </div>
                    <div className="supply-row-aside">
                      <span className="supply-stock-badge">{getSupplyStockStatusLabel(stockStatus)}</span>
                      <RowActionsMenu
                        extraActions={[{disabled: !item.orderUrl, icon: "external", label: "Заказать", onClick: () => openSupplyOrderUrl(item.orderUrl)}]}
                        itemId={`supply-${item.id}`}
                        openMenuId={openItemMenuId}
                        setOpenMenuId={setOpenItemMenuId}
                        onDelete={() => onDeleteSupply(item)}
                        onEdit={() => onEditSupply(item)}
                      />
                    </div>
                  </div>
                  <div className="supply-meta">
                    <span><strong>{item.stock} {item.unit}</strong><small>мин {item.minStock}</small></span>
                    <span><strong>{formatMoney(item.cost)}</strong></span>
                  </div>
                  <div className="supply-actions">
                    <IconButton icon="minus" label="Уменьшить остаток" size="sm" variant="secondary" onClick={() => onChangeSupplyStock(item, -1)} />
                    <IconButton icon="plus" label="Увеличить остаток" size="sm" variant="secondary" onClick={() => onChangeSupplyStock(item, 1)} />
                  </div>
                </article>
              );
            })}
            {!supplies.length ? <p className="operations-empty">Добавьте первый расходник.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "waitlist" ? (
        <section className="operations-panel-waitlist">
          <WaitlistPanel
            openMenuId={openItemMenuId}
            setOpenMenuId={setOpenItemMenuId}
            waitlistEntries={waitlistEntries}
            onAdd={onAddWaitlistEntry}
            onBook={onBookWaitlistEntry}
            onEdit={onEditWaitlistEntry}
            onMessage={onMessageWaitlistEntry}
            onRemove={onRemoveWaitlistEntry}
          />
          <p className="operations-waitlist-meta">{activeWaitlistCount} активных заявок</p>
        </section>
      ) : null}

      {viewingTask ? (
        <TaskDetailsDialog
          item={viewingTask}
          key={viewingTask.id}
          nowTime={nowTime}
          today={today}
          onClose={() => setViewingTask(null)}
          onDelete={onDeleteTask}
          onEdit={onEditTask}
          onSave={onSaveTaskOccurrence}
        />
      ) : null}
    </section>
  );
}

export default OperationsPage;
