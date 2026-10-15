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
  WEEKDAY_FULL_LABELS,
  addDays,
  applyOperationsFilters,
  expandTasksForRange,
  formatDateShort,
  formatDayMonth,
  formatDayMonthShort,
  formatHumanWeekRange,
  getChecklistProgress,
  getDayStats,
  getOverdueTasks,
  getTaskAssigneeName,
  getTaskAreaId,
  getTaskAreaLabel,
  getTaskAreaShortLabel,
  getTaskChecklist,
  getTaskColorId,
  getTaskDueDate,
  getTaskDueTime,
  getTaskEstimateMinutes,
  getTaskPayload,
  getTaskPriorityId,
  getTaskResultFields,
  getWarsawTime,
  getWarsawTodayInput,
  getWeekDays,
  getWeekRelativeLabel,
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

const getMonthRange = (date) => {
  const [year, month] = String(date).split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${endDay}`};
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

const TECHNICAL_CHECKLIST_LABELS = new Set(["сохранить показатели"]);

const formatTaskTimeRange = (task) => {
  const dueTime = getTaskDueTime(task);
  const estimateMinutes = getTaskEstimateMinutes(task);
  if (!dueTime && !estimateMinutes) return "Без времени";
  if (!dueTime) return formatMinutes(estimateMinutes);
  if (!estimateMinutes) return dueTime;

  const [hStr, mStr] = dueTime.split(":");
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return dueTime;

  const endTotal = hours * 60 + minutes + estimateMinutes;
  const endH = Math.floor((endTotal / 60) % 24);
  const endM = endTotal % 60;
  const endFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return `${dueTime} — ${endFormatted}`;
};

const formatDayFullTitle = (date) => {
  if (!date) return "Без даты";
  const weekdayIndex = (new Date(`${date}T12:00:00.000Z`).getUTCDay() || 7) - 1;
  const weekdayName = WEEKDAY_FULL_LABELS[weekdayIndex] || "";
  const dateFormatted = formatDayMonth(date);
  return `${weekdayName}, ${dateFormatted}`;
};

function MiniWeekDayTab({day, isCurrentDay, isSelected, onClick, tasks}) {
  const {isOver, setNodeRef} = useDroppable({
    id: `mini-day-${day.input}`,
    data: {date: day.input},
  });

  const completedCount = tasks.filter(isTaskCompleted).length;
  const totalCount = tasks.length;
  const minutes = tasks.reduce((sum, task) => sum + (Number(getTaskEstimateMinutes(task)) || 0), 0);
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const weekdayIndex = (new Date(`${day.input}T12:00:00.000Z`).getUTCDay() || 7) - 1;
  const weekdayName = WEEKDAY_FULL_LABELS[weekdayIndex] || day.label;
  const dayMonthText = formatDayMonthShort(day.input);

  return (
    <div
      ref={setNodeRef}
      className={`operations-mini-day-dropzone ${isOver ? "is-over" : ""}`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        className={`operations-mini-day-tab ${isSelected ? "is-selected" : ""} ${isCurrentDay ? "is-today" : ""}`}
        onClick={() => onClick(day.input)}
      >
        <div className="operations-mini-day-head">
          <span className="operations-mini-day-name">{weekdayName}</span>
          {isCurrentDay ? <span className="operations-mini-today-badge" title="Сегодня">Сегодня</span> : null}
        </div>
        <div className="operations-mini-day-date">{dayMonthText}</div>
        <div className="operations-mini-day-stats">
          <span className="operations-mini-day-count">
            {totalCount ? `${completedCount}/${totalCount} ${totalCount === 1 ? "задача" : totalCount < 5 ? "задачи" : "задач"}` : "Нет задач"}
          </span>
          {minutes ? (
            <span className="operations-mini-day-time">
              • {formatMinutes(minutes)}
            </span>
          ) : null}
        </div>
        <div className="operations-mini-day-progress-track">
          <div
            className="operations-mini-day-progress-bar"
            style={{width: `${progressPercent}%`}}
          />
        </div>
      </button>
    </div>
  );
}

function HorizontalDayTaskCard({
  dragHandleProps,
  nowTime,
  onComplete,
  onDelete,
  onEdit,
  onMain,
  onMove,
  onToggleChecklist,
  onView,
  openMenuId,
  setOpenMenuId,
  task,
  today,
}) {
  const taskDueDate = getTaskDueDate(task);
  const isDone = isTaskCompleted(task);
  const isPrimary = isTaskMainOnDate(task, taskDueDate);
  const isLate = isTaskOverdue(task, today, nowTime);
  const rawAssignee = getTaskAssigneeName(task);
  const priority = getTaskPriorityId(task);
  const colorId = getTaskColorId(task);
  const areaLabel = getTaskAreaShortLabel(task);
  const areaId = getTaskAreaId(task);
  const isHighPriority = priority === "high";
  const dueTime = getTaskDueTime(task);
  const estimateMinutes = getTaskEstimateMinutes(task);
  const timeRangeText = formatTaskTimeRange(task);

  const taskPayload = getTaskPayload(task);
  const rawChecklist = getTaskChecklist(task);
  const visibleChecklist = rawChecklist.filter((entry) => !(
    ACQUISITION_TEMPLATE_KEYS.includes(taskPayload.templateKey) &&
    TECHNICAL_CHECKLIST_LABELS.has(String(entry.text ?? "").trim().toLocaleLowerCase("ru"))
  ));
  const doneChecklistCount = visibleChecklist.filter((item) => item.done).length;
  const totalChecklistCount = visibleChecklist.length;

  return (
    <article
      className={[
        "operations-horizontal-task-card",
        `task-color-${colorId}`,
        `area-${areaId}`,
        isDone ? "is-completed" : "",
        isPrimary ? "is-main" : "",
        isLate ? "is-overdue" : "",
        isHighPriority ? "is-priority-high" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="operations-htask-left">
        <div className="operations-htask-time-block">
          <span className="operations-htask-time">{timeRangeText}</span>
          {dueTime && estimateMinutes ? (
            <span className="operations-htask-duration">({formatMinutes(estimateMinutes)})</span>
          ) : null}
        </div>
        <div className="operations-htask-tags">
          <span className="operations-htask-category-tag">{areaLabel}</span>
          {isPrimary ? (
            <span className="operations-htask-primary-tag" title="Главная задача дня">
              ★ Главная
            </span>
          ) : null}
          {rawAssignee ? (
            <span className="operations-htask-assignee-tag" title={`Исполнитель: ${rawAssignee}`}>
              @{rawAssignee}
            </span>
          ) : null}
        </div>
      </div>

      <div className="operations-htask-center">
        <div className="operations-htask-title-row">
          {isHighPriority ? (
            <span className="operations-priority-dot is-high" title="Срочный приоритет" />
          ) : null}
          <button
            type="button"
            className="operations-htask-title-btn"
            onClick={() => onView(task)}
          >
            <h3 className="operations-htask-title">{task.title}</h3>
          </button>
        </div>

        {task.note ? (
          <p className="operations-htask-note">{task.note}</p>
        ) : null}

        {totalChecklistCount > 0 ? (
          <div className="operations-htask-checklist-box">
            <div className="operations-htask-checklist-head">
              <span className="operations-htask-checklist-title">
                Чек-лист ({doneChecklistCount}/{totalChecklistCount})
              </span>
              <div className="operations-htask-checklist-mini-progress">
                <div
                  className="operations-htask-checklist-mini-bar"
                  style={{width: `${Math.round((doneChecklistCount / totalChecklistCount) * 100)}%`}}
                />
              </div>
            </div>
            <div className="operations-htask-checklist-items">
              {visibleChecklist.map((item) => (
                <label
                  key={item.id}
                  className={`operations-htask-check-item ${item.done ? "is-checked" : ""}`}
                >
                  <Checkbox
                    checked={item.done}
                    onChange={(event) => onToggleChecklist?.(task, item.id, event.target.checked)}
                  />
                  <span className="operations-htask-check-text">{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="operations-htask-right">
        <div className="operations-htask-top-actions">
          {isHighPriority ? (
            <span className="operations-htask-priority-badge">Срочно</span>
          ) : null}

          {dragHandleProps ? (
            <button
              aria-label="Перетащить на другой день"
              className="operations-task-drag-handle"
              type="button"
              {...dragHandleProps}
            >
              <AppIcon name="grip" size="xs" />
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
                disabled: !taskDueDate,
                icon: "star",
                label: "Главная",
                onClick: () => onMain(task),
              },
              {
                icon: isDone ? "rotateCcw" : "check",
                label: isDone ? "Вернуть" : "Завершить",
                onClick: () => onComplete(task),
              },
            ]}
            itemId={`htask-${task.id}`}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(task)}
            onEdit={() => onEdit(task)}
            onView={() => onView(task)}
          />
        </div>

        <div className="operations-htask-status-block">
          {isLate && !isDone ? (
            <span className="operations-htask-overdue-tag">Просрочено</span>
          ) : null}
          <button
            type="button"
            className={`operations-htask-complete-btn ${isDone ? "is-done" : ""}`}
            onClick={() => onComplete(task)}
            title={isDone ? "Вернуть задачу" : "Завершить задачу"}
          >
            <AppIcon name={isDone ? "rotateCcw" : "check"} size="sm" />
            <span>{isDone ? "Выполнено" : "Завершить"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function DraggableHorizontalTaskCard({cardProps, task}) {
  const {attributes, isDragging, listeners, setNodeRef, transform} = useDraggable({
    id: `htask-${task.id}-${getTaskDueDate(task)}`,
    data: {task},
  });

  return (
    <div
      ref={setNodeRef}
      className={`operations-htask-draggable ${isDragging ? "is-dragging" : ""}`}
      style={{transform: CSS.Translate.toString(transform)}}
    >
      <HorizontalDayTaskCard
        dragHandleProps={{...attributes, ...listeners}}
        task={task}
        {...cardProps}
      />
    </div>
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
          {checklistCount} действий
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
  const [saveState, setSaveState] = useState("idle");
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({
    checklist: item?.occurrenceChecklist ?? getTaskPayload(item).checklist ?? [],
    comment: item?.occurrenceComment ?? "",
    results: taskPayload.templateKey === "acquisition-meta-control" && !defaultResults.statsDate
      ? {...defaultResults, statsDate: addDays(taskDate, -1)}
      : defaultResults,
  }));

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
  const currentSnapshot = JSON.stringify({checklist, comment, results});
  const isDirty = currentSnapshot !== savedSnapshot;
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
    setSaveState("saving");
    const normalizedComment = comment.trim();
    const saved = await onSave?.(item, {
      checklist,
      comment: normalizedComment,
      results,
      ...(status ? {completedAt: new Date().toISOString(), status} : {}),
    });
    setSaving(false);
    if (!saved) {
      setSaveState("error");
      return;
    }
    setComment(normalizedComment);
    setSavedSnapshot(JSON.stringify({checklist, comment: normalizedComment, results}));
    setSaveState("saved");
    if (status === "completed") onClose();
  };

  const requestClose = () => {
    if (saving) return;
    if (isDirty && !window.confirm("Закрыть задачу без сохранения изменений?")) return;
    onClose();
  };

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || saving) return;
      if (isDirty && !window.confirm("Закрыть задачу без сохранения изменений?")) return;
      onClose();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDirty, onClose, saving]);

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
      <DialogBackdrop className="operations-detail-backdrop" onClick={requestClose}>
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
            <div className="operations-detail-header-actions">
              {isDirty ? <span>Есть несохранённые изменения</span> : saveState === "saved" ? <span className="is-saved">Сохранено</span> : null}
              <IconButton aria-label="Закрыть" icon="x" size="sm" title="Закрыть" variant="ghost" onClick={requestClose} />
            </div>
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
                  <div className="operations-history-entry" key={date}>
                    <strong>{formatDateShort(date)}</strong>
                    <span>{record.comment || (record.status === "completed" ? "Выполнено" : "Результат сохранён")}</span>
                    {Array.isArray(record.checklist) && record.checklist.length ? <small>{record.checklist.filter((entry) => entry.done).length}/{record.checklist.length} действий</small> : null}
                    {Object.entries(record.results ?? {}).length ? <dl>{Object.entries(record.results).map(([key, value]) => <div key={key}><dt>{resultFields.find((field) => field.id === key)?.label ?? key}</dt><dd>{String(value).trim() || "—"}</dd></div>)}</dl> : null}
                  </div>
                ))}
              </details>
            ) : null}
          </div>
          <footer className="operations-detail-actions">
            {completionIssues.length && !isCompleted ? <div className="operations-completion-requirements"><strong>Чтобы завершить:</strong>{completionIssues.map((issue) => <span key={issue}>{issue}</span>)}</div> : null}
            <div><Button disabled={saving || !isDirty} size="md" variant="secondary" onClick={() => save()}>{saving ? "Сохранение…" : saveState === "saved" && !isDirty ? "Сохранено" : "Сохранить"}</Button><Button disabled={saving || !canComplete} leftIcon="check" size="md" variant="primary" onClick={() => save("completed")}>{saving ? "Сохранение…" : "Завершить задачу"}</Button></div>
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
  const [weekViewMode, setWeekViewMode] = useState(storedView.weekViewMode ?? "workweek");
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
  const today = getWarsawTodayInput();
  const nowTime = getWarsawTime();
  const kanbanSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}));

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({activeTab, planMode, selectedDate, weekViewMode}));
  }, [activeTab, planMode, selectedDate, weekViewMode]);

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
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const dayTasksRaw = useMemo(
    () => expandTasksForRange(activeWorkTasks, selectedDate, selectedDate),
    [activeWorkTasks, selectedDate],
  );
  const weekTasksRaw = useMemo(
    () => expandTasksForRange(activeWorkTasks, weekStart, weekEnd),
    [activeWorkTasks, weekEnd, weekStart],
  );
  const currentViewingTask = viewingTask && viewingTask.type !== "note"
    ? weekTasksRaw.find((task) => (
      String(task.baseId ?? task.id) === String(viewingTask.baseId ?? viewingTask.id) &&
      getTaskDueDate(task) === getTaskDueDate(viewingTask)
    )) ?? viewingTask
    : viewingTask;
  const overdueTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(getOverdueTasks(activeWorkTasks, today, nowTime), filters)),
    [activeWorkTasks, filters, nowTime, today],
  );
  const weekTasks = useMemo(
    () => sortPlanTasks(applyOperationsFilters(weekTasksRaw, filters)),
    [filters, weekTasksRaw],
  );
  const weekStats = useMemo(() => getDayStats(weekTasksRaw), [weekTasksRaw]);
  const activeFilterCount = useMemo(() => Object.entries(DEFAULT_FILTERS).reduce((count, [key, defaultValue]) => (
    filters[key] !== defaultValue ? count + 1 : count
  ), 0), [filters]);
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
    if (offset === 0) {
      setSelectedDate(today);
      return;
    }
    const currentWeekdayIndex = Math.max(0, weekDays.findIndex((d) => d.input === selectedDate));
    const nextWeekStart = addDays(weekStart, offset * 7);
    const nextWeekDays = getWeekDays(nextWeekStart);
    const targetDay = nextWeekDays[currentWeekdayIndex]?.input ?? nextWeekStart;
    setSelectedDate(targetDay);
  };

  const handleToggleWeekViewMode = (mode) => {
    setWeekViewMode(mode);
    if (mode === "workweek") {
      const isWeekend = [weekDays[5]?.input, weekDays[6]?.input].filter(Boolean).includes(selectedDate);
      if (isWeekend) {
        setSelectedDate(weekDays[0]?.input || selectedDate);
      }
    }
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

  const handleToggleChecklist = async (task, itemId, nextDone) => {
    const currentList = getTaskChecklist(task);
    const updatedList = currentList.map((item) => (
      item.id === itemId ? {...item, done: nextDone} : item
    ));

    await onSaveTaskOccurrence?.(task, {
      checklist: updatedList,
      comment: task.occurrenceComment ?? "",
      results: task.occurrenceResults ?? {},
    });
  };

  const handleTaskCompletionRequest = (task) => {
    const listProgress = getChecklistProgress(task);
    const resultFields = getTaskResultFields(task);
    const results = task.occurrenceResults ?? {};
    const missingRequiredFields = resultFields.filter((field) => (
      field.required && String(results[field.id] ?? "").trim() === ""
    ));
    const hasUncheckedItems = listProgress.total > 0 && listProgress.done < listProgress.total;
    const isDone = isTaskCompleted(task);

    if (!isDone && (hasUncheckedItems || missingRequiredFields.length > 0)) {
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
    onToggleChecklist: handleToggleChecklist,
    onView: setViewingTask,
    openMenuId: openItemMenuId,
    setOpenMenuId: setOpenItemMenuId,
    today,
  };

  const tabMeta = `${dayStats.completed}/${dayStats.planned} задач · ${formatMinutes(dayStats.remainingMinutes)}`;
  const isTemplateManager = activeTab === "plan" && planMode === "templates";
  const weekendTaskCount = useMemo(() => {
    const weekendDates = [weekDays[5]?.input, weekDays[6]?.input].filter(Boolean);
    return weekTasksRaw.filter((task) => weekendDates.includes(getTaskDueDate(task))).length;
  }, [weekDays, weekTasksRaw]);

  const miniWeekDays = useMemo(() => {
    return weekViewMode === "workweek" ? weekDays.slice(0, 5) : weekDays;
  }, [weekDays, weekViewMode]);

  const selectedDayTasks = useMemo(() => {
    return weekTasks.filter((task) => getTaskDueDate(task) === selectedDate);
  }, [weekTasks, selectedDate]);

  const allSelectedDayTasksCount = useMemo(() => {
    return weekTasksRaw.filter((task) => getTaskDueDate(task) === selectedDate).length;
  }, [weekTasksRaw, selectedDate]);

  const selectedDayStats = useMemo(() => {
    const rawDayTasks = weekTasksRaw.filter((task) => getTaskDueDate(task) === selectedDate);
    const completed = rawDayTasks.filter(isTaskCompleted).length;
    const totalMinutes = rawDayTasks.reduce((sum, task) => sum + (Number(getTaskEstimateMinutes(task)) || 0), 0);
    return {
      completed,
      planned: rawDayTasks.length,
      totalMinutes,
    };
  }, [selectedDate, weekTasksRaw]);

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
                <div className="operations-week-info">
                  <div className="operations-week-title-row">
                    <h2>{formatHumanWeekRange(weekStart, weekEnd)}</h2>
                    <span className={`operations-week-relative-tag ${isCurrentWeek ? "is-current" : ""}`}>
                      {isCurrentWeek ? "● Текущая неделя" : getWeekRelativeLabel(weekStart, today)}
                    </span>
                  </div>
                </div>
                <div className="operations-week-controls">
                  <IconButton icon="chevronLeft" label="Предыдущая неделя" size="sm" variant="secondary" onClick={() => changeWeek(-1)} />
                  <Button
                    className={`operations-week-today-btn ${isCurrentWeek ? "is-on-current" : "is-jump-current"}`}
                    size="sm"
                    variant={isCurrentWeek ? "secondary" : "primary"}
                    onClick={() => changeWeek(0)}
                  >
                    {isCurrentWeek ? "Текущая неделя" : "← К текущей неделе"}
                  </Button>
                  <IconButton icon="chevronRight" label="Следующая неделя" size="sm" variant="secondary" onClick={() => changeWeek(1)} />

                  <div className="operations-week-mode-toggle" role="group" aria-label="Режим отображения недели">
                    <button
                      type="button"
                      className={`operations-week-mode-btn ${weekViewMode === "workweek" ? "is-active" : ""}`}
                      onClick={() => handleToggleWeekViewMode("workweek")}
                    >
                      Будни (5 дней)
                    </button>
                    <button
                      type="button"
                      className={`operations-week-mode-btn ${weekViewMode === "fullweek" ? "is-active" : ""}`}
                      onClick={() => handleToggleWeekViewMode("fullweek")}
                    >
                      Вся неделя (7)
                      {weekendTaskCount > 0 && weekViewMode === "workweek" ? (
                        <span className="operations-weekend-dot" title={`${weekendTaskCount} задач на выходных`} />
                      ) : null}
                    </button>
                  </div>
                </div>
              </div>
              <div className="operations-task-actions">
                <Button leftIcon="settings" size="sm" variant="secondary" onClick={() => setPlanMode("templates")}>Управление задачами</Button>
                <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({dueDate: selectedDate})}>Добавить задачу</Button>
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
              <div className="operations-task-search">
                <Input value={filters.query} placeholder="Поиск по задачам" onChange={(event) => updateFilter("query", event.target.value)} />
                {filters.query ? <IconButton icon="x" label="Очистить поиск" size="sm" variant="ghost" onClick={() => updateFilter("query", "")} /> : null}
              </div>
              <details className="operations-filter-menu">
                <summary>Фильтры{activeFilterCount ? <span>{activeFilterCount}</span> : null}</summary>
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
            ) : (
              <DndContext sensors={kanbanSensors} onDragEnd={handleKanbanDragEnd}>
                <div className={`operations-mini-week-bar mode-${weekViewMode}`} role="tablist" aria-label="Дни недели">
                  {miniWeekDays.map((day) => (
                    <MiniWeekDayTab
                      day={day}
                      isCurrentDay={day.input === today}
                      isSelected={day.input === selectedDate}
                      key={day.input}
                      onClick={setSelectedDate}
                      tasks={weekTasksRaw.filter((task) => getTaskDueDate(task) === day.input)}
                    />
                  ))}
                </div>

                <section className="operations-day-focus-view">
                  <header className="operations-day-focus-header">
                    <div className="operations-day-focus-title-block">
                      <div className="operations-day-focus-title-row">
                        <h2 className="operations-day-focus-title">
                          {formatDayFullTitle(selectedDate)}
                        </h2>
                        {selectedDate === today ? (
                          <span className="operations-day-today-pill">Сегодня</span>
                        ) : null}
                      </div>
                      <p className="operations-day-focus-subtitle">
                        {selectedDayStats.planned
                          ? `${selectedDayStats.planned} ${selectedDayStats.planned === 1 ? "задача" : selectedDayStats.planned < 5 ? "задачи" : "задач"} • ${selectedDayStats.completed} выполнено${selectedDayStats.totalMinutes ? ` • ${formatMinutes(selectedDayStats.totalMinutes)}` : ""}`
                          : "Задач на выбранный день пока нет"}
                      </p>
                    </div>
                    <div className="operations-day-focus-actions">
                      <Button
                        leftIcon="plus"
                        size="sm"
                        variant="primary"
                        onClick={() => onAddTask?.({dueDate: selectedDate})}
                      >
                        + Новая задача
                      </Button>
                    </div>
                  </header>

                  <div className="operations-day-focus-list">
                    {selectedDayTasks.map((task) => (
                      <DraggableHorizontalTaskCard
                        cardProps={cardProps}
                        key={`${task.id}-${getTaskDueDate(task)}`}
                        task={task}
                      />
                    ))}
                    {!selectedDayTasks.length ? (
                      <div className="operations-day-empty-state">
                        <div className="operations-day-empty-icon">
                          <AppIcon name="calendar" size="lg" />
                        </div>
                        <h3>{allSelectedDayTasksCount ? `Задачи скрыты фильтрами (${allSelectedDayTasksCount})` : "На этот день задач нет"}</h3>
                        <p>
                          {allSelectedDayTasksCount
                            ? "Попробуйте сбросить фильтры или очистить поисковый запрос, чтобы увидеть задачи."
                            : "Спланируйте важные дела студии или добавьте регулярную задачу на этот день."}
                        </p>
                        <div className="operations-day-empty-actions">
                          {allSelectedDayTasksCount ? (
                            <Button size="sm" variant="secondary" onClick={resetFilters}>
                              Показать все задачи
                            </Button>
                          ) : null}
                          <Button
                            leftIcon="plus"
                            size="sm"
                            variant="primary"
                            onClick={() => onAddTask?.({dueDate: selectedDate})}
                          >
                            + Новая задача
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              </DndContext>
            )}

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

      {currentViewingTask ? (
        <TaskDetailsDialog
          item={currentViewingTask}
          key={`${currentViewingTask.id}-${getTaskDueDate(currentViewingTask)}`}
          onClose={() => setViewingTask(null)}
          onSave={onSaveTaskOccurrence}
          relatedTasks={workTasks}
        />
      ) : null}
    </section>
  );
}

export default OperationsPage;
