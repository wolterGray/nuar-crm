import {useEffect, useMemo, useRef, useState} from "react";
import {DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors} from "@dnd-kit/core";
import {CSS} from "@dnd-kit/utilities";
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
  WORK_AREA_OPTIONS,
  addDays,
  applyOperationsFilters,
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
const AREA_ORDER_STORAGE_KEY = "nuar-crm-task-area-order-v1";

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
  "marketing-monday-meta-analytics",
  "marketing-monday-microbloggers",
  "marketing-monday-content-editing",
  "marketing-monday-content-planning",
  "core-tuesday-dormant-clients",
  "core-tuesday-reviews-reactivation",
  "core-wednesday-studio-supplies",
  "core-thursday-studio-strategy",
  "core-friday-finance-reconciliation",
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

const formatRepeatSchedule = (task) => {
  const repeat = getTaskPayload(task).repeat ?? {};
  if (!repeat.enabled) return "Без повторения";
  if (repeat.frequency === "daily") return "Каждый день";
  if (repeat.frequency === "monthly") return "Ежемесячно";
  if (repeat.frequency === "weekly") return "Еженедельно";
  if (repeat.frequency === "intervalWeeks") return `Каждые ${repeat.intervalWeeks || 1} нед.`;
  return "По выбранным дням";
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
  compact = false,
  dragHandleProps,
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
          {!compact ? <em>{getTaskKindLabel(task)}</em> : null}
          {!compact && getTaskAssigneeName(task) ? <em>{assigneeName}</em> : null}
          {compact && getTaskDueTime(task) ? <em>{getTaskDueTime(task)}</em> : null}
          {!compact && (dueDate !== today || getTaskDueTime(task)) ? <em>{formatTaskDateTime(task)}</em> : null}
          {getTaskEstimateMinutes(task) ? <em>{formatMinutes(getTaskEstimateMinutes(task))}</em> : null}
          {!compact && priority !== "medium" ? <em>{getTaskPriorityLabel(task)}</em> : null}
          {checklist.total ? <em>{checklist.done}/{checklist.total}</em> : null}
          <em className="operations-task-status">{status}</em>
        </span>
      </button>
      {dragHandleProps ? (
        <button
          aria-label="Перетащить задачу"
          className="operations-task-drag-handle"
          type="button"
          {...dragHandleProps}>
          <AppIcon name="grip" size="sm" />
        </button>
      ) : null}
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

function TaskTemplateCard({onDelete, onEdit, onMoveArea, onSelect, onToggleArchived, openMenuId, selected, setOpenMenuId, task, today}) {
  const payload = getTaskPayload(task);
  const archived = payload.templateArchived === true;
  const systemTemplate = ACQUISITION_TEMPLATE_KEYS.includes(payload.templateKey);
  const checklistCount = Array.isArray(payload.checklist) ? payload.checklist.length : 0;
  const resultCount = getTaskResultFields(task).length;
  let nextDate = "";
  if (!archived) {
    for (let offset = 0; offset <= 90; offset += 1) {
      const candidate = addDays(today, offset);
      if (occursOnDate(task, candidate)) {
        nextDate = candidate;
        break;
      }
    }
  }

  return (
    <article className={`operations-template-card ${archived ? "is-archived" : ""} ${selected ? "is-selected" : ""}`}>
      <Checkbox aria-label={`Выбрать шаблон «${task.title}»`} checked={selected} onChange={(event) => onSelect(task, event.target.checked)} />
      <button className="operations-template-card-main" type="button" onClick={() => onEdit(task)}>
        <span><strong>{task.title}</strong>{systemTemplate ? <em>Системный</em> : null}{archived ? <em>В архиве</em> : null}</span>
        {task.note ? <small>{task.note}</small> : null}
        <span className="operations-template-card-meta">
          <em>{formatRepeatSchedule(task)}</em>
          {nextDate ? <em>Ближайшая: {formatDateShort(nextDate)}</em> : null}
          <em>{checklistCount} действий</em>
          {resultCount ? <em>{resultCount} полей результата</em> : null}
        </span>
      </button>
      <Select aria-label="Направление шаблона" value={getTaskAreaId(task)} onChange={(event) => onMoveArea(task, event.target.value)}>
        <option value="general">Другие задачи</option>
        {WORK_AREA_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
      <Button size="sm" variant="ghost" onClick={() => onToggleArchived(task, !archived)}>{archived ? "Активировать" : "В архив"}</Button>
      <RowActionsMenu
        itemId={`template-${task.id}`}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onDelete={() => onDelete(task)}
        onEdit={() => onEdit(task)}
      />
    </article>
  );
}

function KanbanTaskCard({cardProps, task}) {
  const {attributes, isDragging, listeners, setNodeRef, transform} = useDraggable({
    id: `kanban-${task.id}-${getTaskDueDate(task)}`,
    data: {task},
  });
  return <div className={`operations-kanban-draggable ${isDragging ? "is-dragging" : ""}`} ref={setNodeRef} style={{transform: CSS.Translate.toString(transform)}}>
    <TaskCard compact dragHandleProps={{...attributes, ...listeners}} task={task} {...cardProps} />
  </div>;
}

function KanbanDaySection({cardProps, date, label, onAddTask, tasks, today}) {
  const {isOver, setNodeRef} = useDroppable({id: `kanban-day-${date}`, data: {date}});
  const completed = tasks.filter(isTaskCompleted).length;
  const minutes = tasks.reduce((total, task) => total + (Number(getTaskEstimateMinutes(task)) || 0), 0);
  return <section className={`operations-kanban-day ${isOver ? "is-over" : ""} ${date === today ? "is-today" : ""} ${tasks.length ? "" : "is-empty"}`} data-kanban-date={date} ref={setNodeRef}>
    <header>
      <div><strong>{label}</strong><span>{formatDateShort(date)}{date === today ? " · Сегодня" : ""}</span></div>
      <div className="operations-kanban-day-stats"><em>{completed}/{tasks.length}</em>{minutes ? <em>{formatMinutes(minutes)}</em> : null}</div>
    </header>
    <div className="operations-kanban-column-body">
      {tasks.map((task) => <KanbanTaskCard cardProps={cardProps} key={`${task.id}-${getTaskDueDate(task)}`} task={task} />)}
      {!tasks.length ? <span className="operations-kanban-empty">Свободный день</span> : null}
      <button className="operations-kanban-add" type="button" onClick={() => onAddTask?.({dueDate: date})}><AppIcon name="plus" size="sm" />Добавить</button>
    </div>
  </section>;
}

function KanbanDayColumn({cardProps, dates, labels, onAddTask, tasks, today}) {
  return <section className={`operations-kanban-column ${dates.length > 1 ? "is-weekend" : ""}`}>
    {dates.map((date, index) => (
      <KanbanDaySection
        cardProps={cardProps}
        date={date}
        key={date}
        label={labels[index]}
        onAddTask={onAddTask}
        tasks={tasks.filter((task) => getTaskDueDate(task) === date)}
        today={today}
      />
    ))}
  </section>;
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
  onBulkDeleteTasks,
  onDeleteTask,
  onEditTask,
  onEditWaitlistEntry,
  onMessageWaitlistEntry,
  onMoveTask,
  onMoveTaskTemplateToArea,
  onRenameTaskArea,
  onInitializeAcquisitionPlan,
  onRemoveWaitlistEntry,
  onSetMainTask,
  onSaveTaskOccurrence,
  onSetTaskTemplateArchived,
  onAddSupply,
  onEditSupply,
  onDeleteSupply,
  onChangeSupplyStock,
}) {
  const {isMobile} = useBreakpoint();
  const storedView = readStoredJson(VIEW_STORAGE_KEY, {});
  const [activeTab, setActiveTab] = useState(storedView.activeTab ?? "plan");
  const [planMode, setPlanMode] = useState(storedView.planMode === "templates" ? "templates" : "week");
  const [selectedDate, setSelectedDate] = useState(storedView.selectedDate ?? getWarsawTodayInput());
  const [filters, setFilters] = useState(() => readStoredJson(FILTER_STORAGE_KEY, DEFAULT_FILTERS));
  const [openItemMenuId, setOpenItemMenuId] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(() => new Set());
  const [areaOrder, setAreaOrder] = useState(() => {
    const storedAreaOrder = readStoredJson(AREA_ORDER_STORAGE_KEY, []);
    return Array.isArray(storedAreaOrder) ? storedAreaOrder : [];
  });
  const acquisitionSyncStarted = useRef(false);
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const [moveUndo, setMoveUndo] = useState(null);
  const kanbanBoardRef = useRef(null);
  const today = getWarsawTodayInput();
  const nowTime = getWarsawTime();
  const kanbanSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}));

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({activeTab, planMode, selectedDate}));
  }, [activeTab, planMode, selectedDate]);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    window.localStorage.setItem(AREA_ORDER_STORAGE_KEY, JSON.stringify(areaOrder));
  }, [areaOrder]);

  useEffect(() => {
    if (!moveUndo) return undefined;
    const timer = window.setTimeout(() => setMoveUndo(null), 7000);
    return () => window.clearTimeout(timer);
  }, [moveUndo]);

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
  const legacyAcquisitionRecord = tasks.find((task) => {
    const payload = getTaskPayload(task);
    return !payload.templateKey && payload.hiddenFromPlan !== true && String(task.title ?? "").trim().toLocaleLowerCase("ru") === "01. привлечение новых клиентов";
  });
  const workTasks = tasks.filter((task) => task.type !== "note" && getTaskPayload(task).hiddenFromPlan !== true);
  const activeWorkTasks = workTasks.filter((task) => getTaskPayload(task).templateArchived !== true);
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
    () => expandTasksForRange(activeWorkTasks, selectedDate, selectedDate),
    [activeWorkTasks, selectedDate],
  );
  const weekTasksRaw = useMemo(
    () => expandTasksForRange(activeWorkTasks, weekStart, weekEnd),
    [activeWorkTasks, weekEnd, weekStart],
  );
  const overdueTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(getOverdueTasks(activeWorkTasks, today, nowTime), filters)),
    [activeWorkTasks, filters, nowTime, today],
  );
  const weekTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(weekTasksRaw, filters)),
    [filters, weekTasksRaw],
  );
  const weekStats = useMemo(() => getDayStats(weekTasksRaw), [weekTasksRaw]);
  const taskTemplates = useMemo(
    () => sortPlanTasks(applyOperationsFilters(workTasks.filter((task) => isTaskRepeating(task) && (showArchivedTemplates || getTaskPayload(task).templateArchived !== true)), filters)),
    [filters, showArchivedTemplates, workTasks],
  );
  const templateGroups = useMemo(() => {
    const groups = new Map();
    taskTemplates.forEach((task) => {
      const areaId = getTaskAreaId(task);
      if (!groups.has(areaId)) groups.set(areaId, {id: areaId, label: getTaskAreaLabel(task), tasks: []});
      groups.get(areaId).tasks.push(task);
    });
    return [...groups.values()].sort((left, right) => {
      const leftIndex = areaOrder.indexOf(left.id);
      const rightIndex = areaOrder.indexOf(right.id);
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
      return left.label.localeCompare(right.label, "ru");
    });
  }, [areaOrder, taskTemplates]);
  const selectedTemplates = useMemo(
    () => taskTemplates.filter((task) => selectedTemplateIds.has(String(task.id))),
    [selectedTemplateIds, taskTemplates],
  );

  const setTemplateSelected = (task, selected) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (selected) next.add(String(task.id));
      else next.delete(String(task.id));
      return next;
    });
  };

  const setTemplatesSelected = (templates, selected) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      templates.forEach((task) => {
        if (selected) next.add(String(task.id));
        else next.delete(String(task.id));
      });
      return next;
    });
  };

  const deleteSelectedTemplates = async () => {
    if (!selectedTemplates.length) return;
    const confirmed = window.confirm(`Удалить выбранные шаблоны (${selectedTemplates.length})? История этих задач также будет удалена.`);
    if (!confirmed) return;
    await onBulkDeleteTasks?.(selectedTemplates);
    setSelectedTemplateIds(new Set());
  };

  const moveTemplateArea = (areaId, offset) => {
    const ids = templateGroups.map((group) => group.id);
    const index = ids.indexOf(areaId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setAreaOrder(ids);
  };
  const dayStats = getDayStats(dayTasksRaw);
  const acquisitionNeedsUpgrade = tasks.some((task) => ACQUISITION_TEMPLATE_KEYS.includes(getTaskPayload(task).templateKey) && Number(getTaskPayload(task).templateVersion) < 4);

  useEffect(() => {
    if (!tasks.length || (!legacyAcquisitionRecord && !acquisitionNeedsUpgrade) || acquisitionSyncStarted.current || !onInitializeAcquisitionPlan) return;
    acquisitionSyncStarted.current = true;
    onInitializeAcquisitionPlan();
  }, [acquisitionNeedsUpgrade, legacyAcquisitionRecord, onInitializeAcquisitionPlan, tasks.length]);
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
  };

  useEffect(() => {
    if (!isMobile || planMode !== "week") return undefined;
    const targetDate = selectedDate >= weekStart && selectedDate <= weekEnd ? selectedDate : weekStart;
    const frame = window.requestAnimationFrame(() => {
      const board = kanbanBoardRef.current;
      const target = board?.querySelector(`[data-kanban-date="${targetDate}"]`);
      if (!board || !target) return;
      board.scrollTo({behavior: "smooth", left: Math.max(0, target.offsetLeft - board.offsetLeft)});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, planMode, selectedDate, weekEnd, weekStart]);

  const focusKanbanDate = (date) => {
    setSelectedDate(date);
    const board = kanbanBoardRef.current;
    const target = board?.querySelector(`[data-kanban-date="${date}"]`);
    if (!board || !target) return;
    board.scrollTo({behavior: "smooth", left: Math.max(0, target.offsetLeft - board.offsetLeft)});
  };

  const submitQuickNote = (event) => {
    event.preventDefault();
    const title = noteText.trim();
    if (!title) return;
    onAddNote({category: noteCategory, title});
    setNoteText("");
  };

  const moveTaskWithUndo = async (task, nextDate) => {
    const previousDate = getTaskDueDate(task);
    if (!nextDate || previousDate === nextDate) return;
    const moved = await onMoveTask?.(task, nextDate);
    if (moved) setMoveUndo({from: previousDate, task, to: nextDate});
  };

  const handleMoveTask = (task) => {
    const nextDate = window.prompt("Новая дата задачи (YYYY-MM-DD)", getTaskDueDate(task) || selectedDate);
    if (!nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    moveTaskWithUndo(task, nextDate);
  };

  const undoTaskMove = async () => {
    if (!moveUndo?.from) return;
    const restored = await onMoveTask?.(moveUndo.task, moveUndo.from);
    if (restored) setMoveUndo(null);
  };

  const handleTaskCompletionRequest = (task) => {
    const requiresWorkspace = getChecklistProgress(task).total > 0 || getTaskResultFields(task).length > 0;
    if (!isTaskCompleted(task) && requiresWorkspace) {
      setViewingTask(task);
      return;
    }
    onCompleteTask?.(task);
  };

  const cardProps = {
    nowTime,
    onComplete: handleTaskCompletionRequest,
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
  const isTemplateManager = activeTab === "plan" && planMode === "templates";
  const kanbanColumns = useMemo(() => {
    if (isMobile) {
      return weekDays.map((day) => ({
        dates: [day.input],
        labels: [day.label],
        tasks: weekTasks.filter((task) => getTaskDueDate(task) === day.input),
      }));
    }
    const weekdayColumns = weekDays.slice(0, 5).map((day) => ({dates: [day.input], labels: [day.label]}));
    const weekend = weekDays.slice(5);
    return [...weekdayColumns, {dates: weekend.map((day) => day.input), labels: weekend.map((day) => day.label)}].map((column) => ({
      ...column,
      tasks: weekTasks.filter((task) => column.dates.includes(getTaskDueDate(task))),
    }));
  }, [isMobile, weekDays, weekTasks]);

  const handleKanbanDragEnd = ({active, over}) => {
    const task = active.data.current?.task;
    const date = over?.data.current?.date;
    if (!task || !date || getTaskDueDate(task) === date) return;
    moveTaskWithUndo(task, date);
  };

  return (
    <section className={`operations-page operations-workspace ${isMobile ? "operations-page-mobile" : ""}`}>
      <PageHeader
        className="operations-page-header"
        collapsedMeta={tabMeta}
        collapsible={false}
        description={isMobile ? undefined : isTemplateManager ? "Направления, расписания и шаблоны регулярных задач" : "Задачи, заметки, расходники и лист ожидания"}
        headerActions={isTemplateManager ? <Button leftIcon="chevronLeft" size="sm" variant="secondary" onClick={() => setPlanMode("week")}>К задачам</Button> : undefined}
        title={isTemplateManager ? "Управление задачами" : "Работа"}
      />

      {!isTemplateManager ? <nav aria-label="Разделы работы" className="operations-page-tabs operations-main-tabs">
        <SegmentButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")}>Задачи</SegmentButton>
        <SegmentButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>Заметки</SegmentButton>
        <SegmentButton active={activeTab === "supplies"} onClick={() => setActiveTab("supplies")}>Расходники</SegmentButton>
        <SegmentButton active={activeTab === "waitlist"} onClick={() => setActiveTab("waitlist")}>Лист ожидания</SegmentButton>
      </nav> : null}

      {activeTab === "plan" ? (
        <div className="operations-plan-layout">
          {!isTemplateManager && lowStockCount > 0 ? (
            <button className="operations-stock-alert" type="button" onClick={() => setActiveTab("supplies")}>
              <AppIcon name="packagePlus" size="sm" />
              {lowStockCount} расходников ниже минимума
            </button>
          ) : null}

          <section className="panel operations-planner-panel">
            {isTemplateManager ? (
              <div className="operations-template-manager-head">
                <div>
                  <span>Настройки рабочего плана</span>
                  <h2>Направления и шаблоны</h2>
                  <p>Управляйте структурой работы и расписанием регулярных задач.</p>
                </div>
                <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({taskKind: "daily"})}>Новый шаблон</Button>
              </div>
            ) : <div className="operations-task-commandbar operations-kanban-commandbar">
              <div className="operations-planner-head">
                <h2>{formatWeekRange(weekStart, weekEnd)}</h2>
                <div className="operations-week-controls">
                  <IconButton icon="chevronLeft" label="Предыдущая неделя" size="sm" variant="secondary" onClick={() => changeWeek(-1)} />
                  <Button size="sm" variant="secondary" onClick={() => changeWeek(0)}>Текущая неделя</Button>
                  <IconButton icon="chevronRight" label="Следующая неделя" size="sm" variant="secondary" onClick={() => changeWeek(1)} />
                </div>
              </div>
              <div className="operations-task-actions">
                <Button leftIcon="settings" size="sm" variant="secondary" onClick={() => setPlanMode("templates")}>Управление задачами</Button>
                <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({dueDate: today >= weekStart && today <= weekEnd ? today : weekStart})}>Добавить задачу</Button>
              </div>
            </div>}

            {moveUndo ? (
              <div className="operations-move-undo" role="status">
                <span><strong>Задача перенесена</strong><small>{formatDateShort(moveUndo.from)} → {formatDateShort(moveUndo.to)}</small></span>
                <Button size="sm" variant="ghost" onClick={undoTaskMove}>Отменить</Button>
                <IconButton icon="x" label="Скрыть" size="sm" variant="ghost" onClick={() => setMoveUndo(null)} />
              </div>
            ) : null}

            {planMode === "templates" ? (
              <div className="operations-template-summary">
                <div><span><strong>{taskTemplates.length}</strong> регулярных шаблонов</span><span>Изменения расписания применяются к будущим дням</span></div>
                <div className="operations-template-summary-actions">
                  <label className="operations-template-select-all"><Checkbox checked={taskTemplates.length > 0 && selectedTemplates.length === taskTemplates.length} onChange={(event) => setTemplatesSelected(taskTemplates, event.target.checked)} /><span>Выбрать все</span></label>
                  <label className="operations-template-archive-toggle"><Checkbox checked={showArchivedTemplates} onChange={(event) => setShowArchivedTemplates(event.target.checked)} /><span>Показать архив</span></label>
                  {selectedTemplates.length ? <Button leftIcon="trash" size="sm" variant="danger" onClick={deleteSelectedTemplates}>Удалить ({selectedTemplates.length})</Button> : null}
                </div>
              </div>
            ) : <div className="operations-workday-summary">
              <span><strong>{weekStats.planned}</strong> задач</span>
              <span><strong>{weekStats.completed}</strong> выполнено</span>
              <span className={overdueTasks.length ? "is-alert" : ""}><strong>{overdueTasks.length}</strong> просрочено</span>
              <span className="operations-summary-progress"><i style={{width: `${weekProgress}%`}} /></span>
              <b>{weekProgress}%</b>
            </div>}

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

            {planMode === "templates" ? (
              <section className="operations-template-list" aria-label="Шаблоны задач">
                {templateGroups.length ? templateGroups.map((group, groupIndex) => (
                  <details className="operations-template-group" key={group.id} open>
                    <summary><span><label className="operations-template-group-select" onClick={(event) => event.stopPropagation()}><Checkbox checked={group.tasks.every((task) => selectedTemplateIds.has(String(task.id)))} onChange={(event) => setTemplatesSelected(group.tasks, event.target.checked)} /><span className="sr-only">Выбрать направление</span></label><strong>{group.label}</strong><em>{group.tasks.length}</em></span><span><IconButton disabled={groupIndex === 0} icon="chevronUp" label="Поднять направление" size="sm" variant="ghost" onClick={(event) => { event.preventDefault(); moveTemplateArea(group.id, -1); }} /><IconButton disabled={groupIndex === templateGroups.length - 1} icon="chevronDown" label="Опустить направление" size="sm" variant="ghost" onClick={(event) => { event.preventDefault(); moveTemplateArea(group.id, 1); }} />{group.id !== "acquisition" ? <Button size="sm" variant="ghost" onClick={(event) => { event.preventDefault(); const label = window.prompt("Название направления", group.label)?.trim(); if (label && label !== group.label) onRenameTaskArea?.(group.id, label); }}>Переименовать</Button> : <em>Системное направление</em>}<AppIcon className="operations-template-group-chevron" name="chevronDown" size="sm" /></span></summary>
                    {group.tasks.map((task) => (
                      <TaskTemplateCard
                        key={task.id}
                        task={task}
                        today={today}
                        onDelete={onDeleteTask}
                        onEdit={onEditTask}
                        onMoveArea={onMoveTaskTemplateToArea}
                        onSelect={setTemplateSelected}
                        onToggleArchived={onSetTaskTemplateArchived}
                        openMenuId={openItemMenuId}
                        selected={selectedTemplateIds.has(String(task.id))}
                        setOpenMenuId={setOpenItemMenuId}
                      />
                    ))}
                  </details>
                )) : <p className="operations-empty">Регулярных шаблонов по выбранным фильтрам нет.</p>}
              </section>
            ) : <>
              {isMobile ? <nav aria-label="Дни недели" className="operations-mobile-day-switcher">
                {weekDays.map((day) => {
                  const count = weekTasks.filter((task) => getTaskDueDate(task) === day.input).length;
                  return <button className={`${selectedDate === day.input ? "is-active" : ""} ${today === day.input ? "is-today" : ""}`} key={day.input} type="button" onClick={() => focusKanbanDate(day.input)}><strong>{day.label}</strong><span>{Number(day.input.slice(-2))}</span><em>{count}</em></button>;
                })}
              </nav> : null}
              <DndContext sensors={kanbanSensors} onDragEnd={handleKanbanDragEnd}>
                <div className="operations-kanban-board" ref={kanbanBoardRef}>
                  {kanbanColumns.map((column) => <KanbanDayColumn cardProps={cardProps} dates={column.dates} key={column.dates.join("-")} labels={column.labels} onAddTask={onAddTask} tasks={column.tasks} today={today} />)}
                </div>
              </DndContext>
            </>}

            {!isTemplateManager ? <details className="operations-report">
              <summary>Итоги и история</summary>
              <div className="operations-report-grid">
                <div><span>За день</span><strong>{dayStats.completed}/{dayStats.planned}</strong><small>выполнено</small></div>
                <div><span>За неделю</span><strong>{weekProgress}%</strong><small>{weekCompleted} из {reportWeekTasks.length} задач</small></div>
                <div><span>За месяц</span><strong>{monthProgress}%</strong><small>{monthCompleted} из {reportMonthTasks.length} задач</small></div>
                <div><span>Привлечение за месяц</span><strong>{monthResults.adSpend} zł</strong><small>{monthResults.leads} обращений · {monthResults.bookings} записей · {monthResults.contacts} контактов</small></div>
              </div>
            </details> : null}
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
          key={`${viewingTask.id}-${getTaskDueDate(viewingTask)}`}
          onClose={() => setViewingTask(null)}
          onSave={onSaveTaskOccurrence}
          relatedTasks={workTasks}
        />
      ) : null}
    </section>
  );
}

export default OperationsPage;
