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
  Checkbox,
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

const formatWeekRange = (start, end) => `${formatDateShort(start)} — ${formatDateShort(end)}`;

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
  const statusTone = isCompleted ? "done" : isOverdue ? "overdue" : status === "В процессе" ? "progress" : "idle";

  return (
    <article
      className={[
        "operations-work-card",
        `status-${statusTone}`,
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
          <em className="operations-task-status">{status}</em>
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

const TECHNICAL_CHECKLIST_LABELS = new Set(["сохранить показатели"]);

function TaskDetailsDialog({item, onClose, onSave, relatedTasks}) {
  const taskDate = getTaskDueDate(item);
  const taskPayload = getTaskPayload(item);
  const defaultResults = item?.occurrenceResults ?? {};
  const [checklist, setChecklist] = useState(() => item?.occurrenceChecklist ?? getTaskPayload(item).checklist ?? []);
  const [results, setResults] = useState(() => taskPayload.templateKey === "acquisition-meta-control" && !defaultResults.statsDate
    ? {...defaultResults, statsDate: addDays(taskDate, -1)}
    : defaultResults);
  const [comment, setComment] = useState(() => item?.occurrenceComment ?? "");
  const [saving, setSaving] = useState(false);

  if (!item) return null;
  const visibleChecklist = checklist.filter((entry) => !(
    ACQUISITION_TEMPLATE_KEYS.includes(taskPayload.templateKey) &&
    TECHNICAL_CHECKLIST_LABELS.has(String(entry.text ?? "").trim().toLocaleLowerCase("ru"))
  ));
  const progress = getChecklistProgress({...item, occurrenceChecklist: visibleChecklist});
  const resultFields = getTaskResultFields(item);
  const dateResultFields = resultFields.filter((field) => field.type === "date");
  const valueResultFields = resultFields.filter((field) => field.type !== "date");
  const missingRequiredFields = resultFields.filter((field) => field.required && String(results[field.id] ?? "").trim() === "");
  const incompleteActions = Math.max(0, progress.total - progress.done);
  const hasEnteredResults = valueResultFields.some((field) => String(results[field.id] ?? "").trim() !== "");
  const hasActivity = progress.done > 0 || hasEnteredResults || Boolean(comment.trim());
  const isCompleted = isTaskCompleted(item);
  const currentStatus = isCompleted ? "Выполнена" : hasActivity ? "В работе" : "Не начата";
  const completionIssues = [
    ...(incompleteActions ? [`Выполните оставшиеся действия: ${incompleteActions}`] : []),
    ...missingRequiredFields.map((field) => `Заполните поле «${field.label}»`),
  ];
  const canComplete = !isCompleted && completionIssues.length === 0;
  const history = Object.entries(getTaskPayload(item).occurrences ?? {})
    .filter(([, record]) => record?.status === "completed" || Object.keys(record?.results ?? {}).length)
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 8);
  const hasResultValue = (id) => String(results[id] ?? "").trim() !== "";
  const spend = Number(results.adSpend);
  const leads = Number(results.leads);
  const bookings = Number(results.bookings);
  const acquisitionSummary = relatedTasks.reduce((summary, task) => {
    const record = getTaskPayload(task).occurrences?.[taskDate];
    if (!record?.results) return summary;
    return {
      adSpend: summary.adSpend + (Number(record.results.adSpend) || 0),
      bookings: summary.bookings + (Number(record.results.bookings) || 0),
      contacts: summary.contacts + (Number(record.results.contacts) || 0),
      leads: summary.leads + (Number(record.results.leads) || 0),
      offers: summary.offers + (Number(record.results.offers) || 0),
      replies: summary.replies + (Number(record.results.replies) || 0),
    };
  }, {adSpend: 0, bookings: 0, contacts: 0, leads: 0, offers: 0, replies: 0});
  const hasAcquisitionMetric = (metric) => relatedTasks.some((task) => {
    const value = getTaskPayload(task).occurrences?.[taskDate]?.results?.[metric];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
  const save = async (status) => {
    if (status === "completed" && !canComplete) return;
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

  const updateResult = (id, value) => setResults((current) => ({...current, [id]: value}));
  const renderResultField = (field) => (
    <label className={field.type === "textarea" ? "is-wide" : ""} key={field.id}>
      <span>{field.label}{field.required ? " *" : ""}</span>
      {field.type === "textarea" ? (
        <textarea rows="3" value={results[field.id] ?? ""} onChange={(event) => updateResult(field.id, event.target.value)} />
      ) : (
        <span className="operations-result-input"><input min={field.type === "number" ? "0" : undefined} type={field.type} value={results[field.id] ?? ""} onChange={(event) => updateResult(field.id, event.target.value)} />{field.unit ? <em>{field.unit}</em> : null}</span>
      )}
    </label>
  );

  return (
    <Dialog open={Boolean(item)}>
      <DialogBackdrop className="operations-detail-backdrop" onClick={onClose}>
        <DialogContent
          aria-labelledby="operation-detail-title"
          className="operations-detail-dialog"
          role="dialog"
          onClick={(event) => event.stopPropagation()}>
          <header className="operations-detail-header">
            <div className="operations-detail-heading">
              <h2 id="operation-detail-title">{item.title}</h2>
              <div className="operations-detail-summary">
                <span>{formatPlannerDate(taskDate)}</span>
                <strong className={`status-${currentStatus === "Выполнена" ? "done" : currentStatus === "В работе" ? "progress" : "idle"}`}>{currentStatus}</strong>
                <span>{progress.total ? `${progress.done} из ${progress.total} действий` : "Без чек-листа"}</span>
              </div>
              <span className="operations-detail-progress"><i style={{width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : isCompleted ? 100 : 0}%`}} /></span>
            </div>
            <IconButton aria-label="Закрыть" icon="x" size="sm" title="Закрыть" variant="ghost" onClick={onClose} />
          </header>
          <div className="operations-detail-body">
            {item.note || item.description || taskPayload.instructions ? (
              <details className="operations-detail-guide">
                <summary>Как выполнить</summary>
                {item.note || item.description ? <p>{item.note || item.description}</p> : null}
                {taskPayload.instructions && taskPayload.instructions !== (item.note || item.description) ? <p>{taskPayload.instructions}</p> : null}
              </details>
            ) : null}
            {visibleChecklist.length ? (
              <section className="operations-detail-section">
                <div className="operations-detail-section-head"><div><h3>Действия на сегодня</h3><span>{progress.done} из {progress.total}</span></div><b>{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%</b></div>
                <div className="operations-detail-checklist">
                  {visibleChecklist.map((entry) => (
                    <label className={entry.done ? "is-done" : ""} key={entry.id}>
                      <span className="operations-check-hit"><Checkbox checked={entry.done === true} onChange={(event) => setChecklist((current) => current.map((value) => value.id === entry.id ? {...value, done: event.target.checked} : value))} /></span>
                      <span>{entry.text}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {resultFields.length ? (
              <section className="operations-detail-section operations-results-section">
                <div className="operations-detail-section-head"><div><h3>Результаты</h3><span>Зафиксируйте фактические значения</span></div></div>
                {dateResultFields.length ? <div className="operations-result-date"><span>Дата статистики</span>{dateResultFields.map(renderResultField)}</div> : null}
                {taskPayload.resultSource === "acquisitionSummary" ? (
                  <div className="operations-auto-summary">
                    <div><span>Расходы Meta</span><strong>{hasAcquisitionMetric("adSpend") ? `${acquisitionSummary.adSpend} zł` : "—"}</strong></div>
                    <div><span>Обращения</span><strong>{hasAcquisitionMetric("leads") ? acquisitionSummary.leads : "—"}</strong></div>
                    <div><span>Записи</span><strong>{hasAcquisitionMetric("bookings") ? acquisitionSummary.bookings : "—"}</strong></div>
                    <div><span>Новые контакты</span><strong>{hasAcquisitionMetric("contacts") ? acquisitionSummary.contacts : "—"}</strong></div>
                    <div><span>Предложения</span><strong>{hasAcquisitionMetric("offers") ? acquisitionSummary.offers : "—"}</strong></div>
                    <div><span>Ответы</span><strong>{hasAcquisitionMetric("replies") ? acquisitionSummary.replies : "—"}</strong></div>
                  </div>
                ) : null}
                {valueResultFields.length ? <div className="operations-result-grid">{valueResultFields.map(renderResultField)}</div> : null}
                {taskPayload.templateKey === "acquisition-meta-control" ? (
                  <div className="operations-derived-results">
                    <div><span>Стоимость обращения</span><strong>{hasResultValue("adSpend") && hasResultValue("leads") && leads > 0 ? `${(spend / leads).toFixed(2)} zł` : "—"}</strong></div>
                    <div><span>Стоимость записи</span><strong>{hasResultValue("adSpend") && hasResultValue("bookings") && bookings > 0 ? `${(spend / bookings).toFixed(2)} zł` : "—"}</strong></div>
                  </div>
                ) : null}
              </section>
            ) : null}
            <section className="operations-detail-section">
              <div className="operations-detail-section-head"><div><h3>Вывод за день</h3><span>Коротко: что получилось и что делать дальше</span></div></div>
              <textarea rows="4" value={comment} placeholder={taskPayload.templateKey === "acquisition-meta-control" ? "Что сработало и что требует внимания" : "Выводы, проблемы или следующее действие"} onChange={(event) => setComment(event.target.value)} />
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
            {completionIssues.length && !isCompleted ? <div className="operations-completion-requirements"><strong>Чтобы завершить:</strong>{completionIssues.map((issue) => <span key={issue}>{issue}</span>)}</div> : null}
            <div><Button disabled={saving} size="md" variant="secondary" onClick={() => save()}>Сохранить</Button><Button disabled={saving || !canComplete} leftIcon="check" size="md" variant="primary" onClick={() => save("completed")}>Завершить задачу</Button></div>
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
  const [expandedWeekDays, setExpandedWeekDays] = useState(() => new Set([getWarsawTodayInput()]));
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
  const weekStats = useMemo(() => getDayStats(weekTasksRaw), [weekTasksRaw]);
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
  const acquisitionNeedsUpgrade = tasks.some((task) => ACQUISITION_TEMPLATE_KEYS.includes(getTaskPayload(task).templateKey) && Number(getTaskPayload(task).templateVersion) < 2);

  useEffect(() => {
    if (!tasks.length || (!legacyAcquisitionRecord && !acquisitionNeedsSync && !acquisitionNeedsUpgrade) || acquisitionSyncStarted.current || !onInitializeAcquisitionPlan) return;
    acquisitionSyncStarted.current = true;
    onInitializeAcquisitionPlan();
  }, [acquisitionNeedsSync, acquisitionNeedsUpgrade, legacyAcquisitionRecord, onInitializeAcquisitionPlan, tasks.length]);
  const completedOccurrences = useMemo(
    () => workTasks.flatMap((task) => Object.entries(getTaskPayload(task).occurrences ?? {}).map(([date, record]) => ({date, record, task}))).filter(({record}) => record.status === "completed"),
    [workTasks],
  );
  const monthPrefix = selectedDate.slice(0, 7);
  const monthRange = getMonthRange(selectedDate);
  const reportWeekTasks = expandTasksForRange(workTasks, weekStart, weekEnd);
  const reportMonthTasks = expandTasksForRange(workTasks, monthRange.start, monthRange.end);
  const weekCompleted = weekStats.completed;
  const monthCompleted = completedOccurrences.filter(({date}) => date.startsWith(monthPrefix)).length;
  const monthResults = completedOccurrences
    .filter(({date}) => date.startsWith(monthPrefix))
    .reduce((totals, {record}) => ({
      adSpend: totals.adSpend + (Number(record.results?.adSpend) || 0),
      leads: totals.leads + (Number(record.results?.leads) || 0) + (Number(record.results?.totalLeads) || 0),
      bookings: totals.bookings + (Number(record.results?.bookings) || 0) + (Number(record.results?.totalBookings) || 0),
      contacts: totals.contacts + (Number(record.results?.contacts) || 0),
    }), {adSpend: 0, bookings: 0, contacts: 0, leads: 0});
  const weekProgress = weekStats.progress;
  const monthProgress = reportMonthTasks.length ? Math.min(100, Math.round((monthCompleted / reportMonthTasks.length) * 100)) : 0;

  const updateFilter = (key, value) => {
    setFilters((current) => ({...current, [key]: value}));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const changeWeek = (offset) => {
    const nextDate = offset === 0 ? today : addDays(weekStart, offset * 7);
    setSelectedDate(nextDate);
    setExpandedWeekDays(new Set(offset === 0 ? [today] : []));
  };

  const toggleWeekDay = (date) => {
    setSelectedDate(date);
    setExpandedWeekDays((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

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
        className="operations-page-header"
        collapsedMeta={tabMeta}
        collapsible={false}
        description={isMobile ? undefined : "Задачи, заметки, расходники и лист ожидания"}
        title="Работа"
      />

      <nav aria-label="Разделы работы" className="operations-page-tabs operations-main-tabs">
        <SegmentButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")}>Задачи</SegmentButton>
        <SegmentButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>Заметки</SegmentButton>
        <SegmentButton active={activeTab === "supplies"} onClick={() => setActiveTab("supplies")}>Расходники</SegmentButton>
        <SegmentButton active={activeTab === "waitlist"} onClick={() => setActiveTab("waitlist")}>Лист ожидания</SegmentButton>
      </nav>

      {activeTab === "plan" ? (
        <div className="operations-plan-layout">
          {lowStockCount > 0 ? (
            <button className="operations-stock-alert" type="button" onClick={() => setActiveTab("supplies")}>
              <AppIcon name="packagePlus" size="sm" />
              {lowStockCount} расходников ниже минимума
            </button>
          ) : null}

          <section className="panel operations-planner-panel">
            <div className="operations-task-commandbar">
              <div className="operations-plan-mode">
                <SegmentButton active={planMode === "today"} onClick={() => setPlanMode("today")}>Сегодня</SegmentButton>
                <SegmentButton active={planMode === "week"} onClick={() => { setPlanMode("week"); changeWeek(0); }}>Неделя</SegmentButton>
                <SegmentButton active={planMode === "all"} onClick={() => setPlanMode("all")}>Все</SegmentButton>
              </div>
              <div className="operations-planner-head">
                <h2>{planMode === "week" ? formatWeekRange(weekStart, weekEnd) : planMode === "all" ? "Все задачи" : formatPlannerDate(selectedDate)}</h2>
                {planMode === "week" ? (
                  <div className="operations-week-controls">
                    <IconButton icon="chevronLeft" label="Предыдущая неделя" size="sm" variant="secondary" onClick={() => changeWeek(-1)} />
                    <Button size="sm" variant="secondary" onClick={() => changeWeek(0)}>Текущая неделя</Button>
                    <IconButton icon="chevronRight" label="Следующая неделя" size="sm" variant="secondary" onClick={() => changeWeek(1)} />
                  </div>
                ) : planMode === "today" ? (
                  <div className="operations-date-controls">
                    <IconButton icon="chevronLeft" label="Предыдущий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))} />
                    <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                    <IconButton icon="chevronRight" label="Следующий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))} />
                    <Button size="sm" variant="secondary" onClick={() => setSelectedDate(today)}>Сегодня</Button>
                  </div>
                ) : null}
              </div>
              <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({dueDate: selectedDate})}>Добавить задачу</Button>
            </div>

            <div className="operations-workday-summary">
              <span><strong>{planMode === "week" ? weekStats.planned : planMode === "all" ? allTasks.length : dayStats.planned}</strong> задач</span>
              <span><strong>{planMode === "week" ? weekStats.completed : dayStats.completed}</strong> выполнено</span>
              <span className={overdueTasks.length ? "is-alert" : ""}><strong>{overdueTasks.length}</strong> просрочено</span>
              <span className="operations-summary-progress"><i style={{width: `${planMode === "week" ? weekProgress : dayStats.progress}%`}} /></span>
              <b>{planMode === "week" ? weekProgress : dayStats.progress}%</b>
            </div>

            <section className="operations-list-toolbar">
              <Input value={filters.query} placeholder="Поиск по задачам" onChange={(event) => updateFilter("query", event.target.value)} />
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
                <section className="operations-week-progress" aria-label="Прогресс недели">
                  <div><span>Прогресс недели</span><strong>{weekStats.completed} из {weekStats.planned}</strong></div>
                  <b>{weekProgress}%</b>
                  <span><i style={{width: `${weekProgress}%`}} /></span>
                </section>
                {weekDays.map((day) => {
                  const tasksForDay = weekTasks.filter((task) => getTaskDueDate(task) === day.input);
                  const rawTasksForDay = weekTasksRaw.filter((task) => getTaskDueDate(task) === day.input);
                  const stats = getDayStats(rawTasksForDay);
                  const isExpanded = expandedWeekDays.has(day.input);
                  return (
                    <section className={`operations-week-day ${isExpanded ? "is-expanded" : ""} ${day.input === today ? "is-today" : ""}`} key={day.input}>
                      <button aria-expanded={isExpanded} className="operations-week-day-toggle" type="button" onClick={() => toggleWeekDay(day.input)}>
                        <div><strong>{day.label}</strong><span>{formatDateShort(day.input)}{day.input === today ? " · Сегодня" : ""}</span></div>
                        <span className="operations-week-day-count"><b>{stats.completed}</b> / {stats.planned}</span>
                        <AppIcon name={isExpanded ? "chevronUp" : "chevronDown"} size="sm" />
                      </button>
                      {isExpanded ? (
                        <div className={`operations-week-day-content ${tasksForDay.length ? "" : "is-empty"}`}>
                          {tasksForDay.length ? (
                            <div className="operations-task-list">
                              {tasksForDay.map((task) => <TaskCard key={task.id} task={task} {...cardProps} />)}
                            </div>
                          ) : <p className="operations-week-empty">Задач на этот день нет.</p>}
                          <Button leftIcon="plus" size="sm" variant="ghost" onClick={() => onAddTask?.({dueDate: day.input})}>Добавить задачу</Button>
                        </div>
                      ) : null}
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
          onClose={() => setViewingTask(null)}
          onSave={onSaveTaskOccurrence}
          relatedTasks={workTasks}
        />
      ) : null}
    </section>
  );
}

export default OperationsPage;
