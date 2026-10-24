import {useEffect, useMemo, useRef, useState} from "react";
import "./OperationsPage.css";
import {DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors} from "@dnd-kit/core";
import {CSS} from "@dnd-kit/utilities";
import WaitlistPanel from "../WaitlistPanel.jsx";
import NotionNotesWorkspace from "../NotionNotesWorkspace.jsx";
import HintIcon from "../HintIcon.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import OperationsHistory from "../OperationsHistory.jsx";
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
  WEEKDAY_FULL_LABELS,
  addDays,
  applyOperationsFilters,
  compareInputDates,
  expandTasksForRange,
  formatDateShort,
  formatDayMonth,
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
  isTaskUnfinished,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
  Select,
} from "../ui/index.js";

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

import {isWaitlistEntryActive} from "../../utils/waitlist.js";

function SegmentButton({active, badge, children, onClick}) {
  return (
    <button
      className={`operations-tab-btn ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span className="operations-tab-label-wrap">
        <span>{children}</span>
        {badge ? (
          <span className="operations-tab-badge" aria-label={`Заявок: ${badge}`}>
            {badge}
          </span>
        ) : null}
      </span>
      {active ? <span className="operations-tab-underline" /> : null}
    </button>
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

const WEEKDAY_SHORT_LABELS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

const formatTaskNounRu = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return "задач";
  if (mod10 === 1) return "задача";
  if (mod10 >= 2 && mod10 <= 4) return "задачи";
  return "задач";
};

const formatTaskCountRu = (count) => {
  if (count === 0) return "Нет задач";
  return `${count} ${formatTaskNounRu(count)}`;
};

const formatDebtCountRu = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} долгов`;
  if (mod10 === 1) return `${count} долг`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} долга`;
  return `${count} долгов`;
};

const formatCompactWeekRange = (start, end) => {
  const full = formatHumanWeekRange(start, end);
  return full.replace(/\s*\d{4}\b/, "").trim();
};

function OperationsDatePickerDialogContent({
  initialDate,
  minDate,
  onClose,
  onSelectDate,
  title,
}) {
  const today = getWarsawTodayInput();
  const [selectedDate, setSelectedDate] = useState(initialDate || today);
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      onSelectDate?.(selectedDate);
      onClose();
    }
  };

  return (
    <DialogContent
      className="operations-reschedule-dialog"
      onClick={(e) => e.stopPropagation()}
    >
      <DialogHeader>
        <DialogTitle>{title || "Выберите дату"}</DialogTitle>
      </DialogHeader>

      <form className="operations-reschedule-form" onSubmit={handleSubmit}>
        <div className="operations-reschedule-quick-pills">
          <Button
            size="sm"
            type="button"
            variant={selectedDate === today ? "primary" : "secondary"}
            onClick={() => setSelectedDate(today)}
          >
            Сегодня
          </Button>
          <Button
            size="sm"
            type="button"
            variant={selectedDate === tomorrow ? "primary" : "secondary"}
            onClick={() => setSelectedDate(tomorrow)}
          >
            Завтра
          </Button>
          <Button
            size="sm"
            type="button"
            variant={selectedDate === dayAfter ? "primary" : "secondary"}
            onClick={() => setSelectedDate(dayAfter)}
          >
            Послезавтра
          </Button>
        </div>

        <div className="operations-reschedule-input-wrap">
          <label className="operations-reschedule-label" htmlFor="reschedule-date-input">
            Дата
          </label>
          <Input
            autoFocus
            id="reschedule-date-input"
            min={minDate}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button size="sm" type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!selectedDate} size="sm" type="submit" variant="primary">
            Перенести
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function OperationsDatePickerDialog({
  initialDate,
  isOpen,
  minDate,
  onClose,
  onSelectDate,
  title,
}) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogBackdrop onClick={onClose}>
        <OperationsDatePickerDialogContent
          key={initialDate}
          initialDate={initialDate}
          minDate={minDate}
          onClose={onClose}
          onSelectDate={onSelectDate}
          title={title}
        />
      </DialogBackdrop>
    </Dialog>
  );
}

function MiniWeekDayTab({day, isCurrentDay, isPastDay, isSelected, onClick, tasks}) {
  const {isOver, setNodeRef} = useDroppable({
    id: `mini-day-${day.input}`,
    data: {date: day.input},
  });

  const totalCount = tasks.length;
  const unfinishedCount = tasks.filter(isTaskUnfinished).length;
  const allCompleted = totalCount > 0 && unfinishedCount === 0;
  const hasDebt = isPastDay && unfinishedCount > 0;

  const weekdayIndex = (new Date(`${day.input}T12:00:00.000Z`).getUTCDay() || 7) - 1;
  const weekdayShort = WEEKDAY_SHORT_LABELS[weekdayIndex] || day.label;
  const dayOfMonth = day.input ? String(parseInt(day.input.split("-")[2], 10)) : "";
  const taskCountText = formatTaskCountRu(totalCount);

  return (
    <div
      ref={setNodeRef}
      className={`operations-mini-day-dropzone ${isOver ? "is-over" : ""}`}
    >
      <button
        aria-selected={isSelected}
        className={`operations-mini-day-tab ${isSelected ? "is-selected" : ""} ${isCurrentDay ? "is-today" : ""} ${hasDebt ? "has-debt" : ""}`}
        role="tab"
        type="button"
        onClick={() => onClick(day.input)}
      >
        <span className="operations-mini-day-weekday">{weekdayShort}</span>
        <span className="operations-mini-day-num-wrap">
          <span className="operations-mini-day-num">{dayOfMonth}</span>
          {isCurrentDay && !isSelected && (
            <span className="operations-mini-day-today-dot" title="Сегодня" aria-label="Сегодня" />
          )}
        </span>
        <span className="operations-mini-day-task-count">
          <span className="operations-mini-day-count-full">
            {hasDebt ? (
              <span className="operations-mini-day-debt-text">{formatDebtCountRu(unfinishedCount)}</span>
            ) : allCompleted ? (
              <span className="operations-mini-day-done-text">
                <AppIcon name="check" size="xs" /> Готово
              </span>
            ) : (
              taskCountText
            )}
          </span>
          <span className="operations-mini-day-count-compact-wrap">
            {hasDebt ? (
              <span
                className="operations-mini-day-count-compact is-debt"
                title={`Долг: ${unfinishedCount}`}
              >
                {unfinishedCount}
              </span>
            ) : allCompleted ? (
              <span
                className="operations-mini-day-count-compact is-done"
                title="Все задачи выполнены"
              >
                <AppIcon name="check" size="xs" />
              </span>
            ) : (
              <span className="operations-mini-day-count-compact">
                {totalCount > 0 ? totalCount : "—"}
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

function HorizontalDayTaskCard({
  dragHandleProps,
  isMobile = false,
  nowTime,
  onComplete,
  onDelete,
  onEdit,
  onMain,
  onMove,
  onMoveToDate,
  onOpenDatePicker,
  onToggleChecklist,
  onTransferChecklistItem,
  onView,
  openMenuId,
  selectedDate,
  setOpenMenuId,
  task,
  today,
}) {
  const [expanded, setExpanded] = useState(false);
  const {isMobile: isMobileViewport} = useBreakpoint();
  const isMobileEffective = Boolean(isMobile || isMobileViewport);
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
  const estimateMinutes = getTaskEstimateMinutes(task);
  const timeRangeText = formatTaskTimeRange(task);

  const effectiveDueDate = taskDueDate || selectedDate || today;
  const isPastDate = compareInputDates(effectiveDueDate, today) < 0;
  const tomorrow = addDays(effectiveDueDate, 1);
  const dayAfter = addDays(effectiveDueDate, 2);

  const taskPayload = getTaskPayload(task);
  const rawChecklist = getTaskChecklist(task);
  const visibleChecklist = rawChecklist.filter((entry) => !(
    ACQUISITION_TEMPLATE_KEYS.includes(taskPayload.templateKey) &&
    TECHNICAL_CHECKLIST_LABELS.has(String(entry.text ?? "").trim().toLocaleLowerCase("ru"))
  ));
  const doneChecklistCount = visibleChecklist.filter((item) => item.done).length;
  const totalChecklistCount = visibleChecklist.length;

  const moveSubActions = [
    ...(isPastDate || isLate ? [
      {
        icon: "calendar",
        label: "На сегодня",
        onClick: () => (onMoveToDate ? onMoveToDate(task, today) : onMove(task)),
      },
    ] : []),
    {
      icon: "calendar",
      label: "На завтра",
      onClick: () => (onMoveToDate ? onMoveToDate(task, tomorrow) : onMove(task)),
    },
    {
      icon: "calendar",
      label: "На послезавтра",
      onClick: () => (onMoveToDate ? onMoveToDate(task, dayAfter) : onMove(task)),
    },
    {
      icon: "calendar",
      label: "Выбрать дату…",
      onClick: () => {
        if (onOpenDatePicker) {
          onOpenDatePicker({
            defaultDate: effectiveDueDate,
            task,
            type: "task",
          });
        } else {
          onMove(task);
        }
      },
    },
  ];

  const rowMenuActions = [
    {
      icon: "calendar",
      label: "Перенести",
      subActions: moveSubActions,
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
  ];

  return (
    <article
      className={[
        "operations-linear-row",
        `task-color-${colorId}`,
        `area-${areaId}`,
        isDone ? "is-completed" : "",
        isPrimary ? "is-main" : "",
        isLate && !isDone ? "is-overdue" : "",
        expanded ? "is-expanded" : "",
        isMobileEffective ? "is-mobile-row" : "",
      ].filter(Boolean).join(" ")}
    >
      {isMobileEffective ? (
        <div
          className="operations-m-task-card"
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((prev) => !prev);
            }
          }}
        >
          {/* 1. Верхняя строка: Чекбокс, Статус/индикатор прогресса, Просрочено, Меню ··· */}
          <div className="operations-m-task-top">
            <div className="operations-m-task-top-left">
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={isDone ? "Вернуть задачу" : "Завершить задачу"}
                className={`operations-m-checkbox ${isDone ? "is-checked" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(task);
                }}
              >
                {isDone ? <AppIcon name="check" size="xs" /> : null}
              </button>

              {totalChecklistCount > 0 ? (
                <span
                  className={`operations-linear-checklist-badge ${doneChecklistCount === totalChecklistCount ? "is-complete" : ""}`}
                  title={`Чек-лист: ${doneChecklistCount}/${totalChecklistCount}`}
                >
                  <AppIcon name="list" size="xs" />
                  <span>{doneChecklistCount}/{totalChecklistCount}</span>
                </span>
              ) : null}

              {isHighPriority ? (
                <span className="operations-linear-priority-badge">Срочно</span>
              ) : null}

              {isLate && !isDone ? (
                <span className="operations-linear-overdue-badge">Просрочено</span>
              ) : null}
            </div>

            <div className="operations-m-task-top-right" onClick={(e) => e.stopPropagation()}>
              <RowActionsMenu
                className="operations-row-actions"
                extraActions={rowMenuActions}
                itemId={`htask-${task.id}`}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onDelete={() => onDelete(task)}
                onEdit={() => onEdit(task)}
                onView={() => onView(task)}
              />
            </div>
          </div>

          {/* 2. Основная часть: Название задачи на ВСЮ доступную ширину */}
          <div className="operations-m-task-body">
            {isPrimary ? (
              <span className="operations-linear-primary-star" title="Главная задача дня">★</span>
            ) : null}
            <span className="operations-m-task-title">{task.title}</span>
          </div>

          {/* 3. Дополнительная информация: только существующие данные */}
          {(areaLabel || (timeRangeText && timeRangeText !== "Без времени") || rawAssignee) ? (
            <div className="operations-m-task-meta">
              {areaLabel ? (
                <span className={`operations-linear-category-tag area-pill-${areaId}`} title={`Категория: ${areaLabel}`}>
                  {areaLabel}
                </span>
              ) : null}
              {timeRangeText && timeRangeText !== "Без времени" ? (
                <span className="operations-m-task-time">
                  <AppIcon name="clock" size="xs" />
                  <span>{timeRangeText}</span>
                </span>
              ) : null}
              {rawAssignee ? (
                <span className="operations-linear-assignee-tag">
                  @{rawAssignee}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="operations-linear-main-line"
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((prev) => !prev);
            }
          }}
        >
          <div className="operations-linear-left">
            <button
              type="button"
              role="checkbox"
              aria-checked={isDone}
              aria-label={isDone ? "Вернуть задачу" : "Завершить задачу"}
              className={`operations-linear-checkbox ${isDone ? "is-checked" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task);
              }}
            >
              {isDone ? <AppIcon name="check" size="xs" /> : null}
            </button>

            {timeRangeText && timeRangeText !== "Без времени" ? (
              <span className="operations-linear-time" title={`Время: ${timeRangeText}`}>
                {timeRangeText}
              </span>
            ) : (
              <span className="operations-linear-time is-empty">—</span>
            )}

            <span className={`operations-linear-category-tag area-pill-${areaId}`} title={`Категория: ${areaLabel}`}>
              {areaLabel}
            </span>

            <div className="operations-linear-title-wrap">
              {isHighPriority ? (
                <span className="operations-linear-priority-dot" title="Срочная задача" />
              ) : null}
              {isPrimary ? (
                <span className="operations-linear-primary-star" title="Главная задача дня">★</span>
              ) : null}
              <span className="operations-linear-title">{task.title}</span>
              {rawAssignee ? (
                <span className="operations-linear-assignee-tag" title={`Исполнитель: ${rawAssignee}`}>
                  @{rawAssignee}
                </span>
              ) : null}
            </div>
          </div>

          <div className="operations-linear-right">
            {totalChecklistCount > 0 ? (
              <span
                className={`operations-linear-checklist-badge ${doneChecklistCount === totalChecklistCount ? "is-complete" : ""}`}
                title={`Чек-лист: ${doneChecklistCount}/${totalChecklistCount}`}
              >
                <AppIcon name="list" size="xs" />
                <span>{doneChecklistCount}/{totalChecklistCount}</span>
              </span>
            ) : null}

            {isHighPriority ? (
              <span className="operations-linear-priority-badge">Срочно</span>
            ) : null}

            {isLate && !isDone ? (
              <span className="operations-linear-overdue-badge">Просрочено</span>
            ) : null}

            {dragHandleProps ? (
              <button
                aria-label="Перетащить на другой день"
                className="operations-linear-drag-handle"
                type="button"
                onClick={(e) => e.stopPropagation()}
                {...dragHandleProps}
              >
                <AppIcon name="grip" size="xs" />
              </button>
            ) : null}

            <button
              type="button"
              className="operations-linear-chevron-btn"
              aria-label={expanded ? "Свернуть" : "Развернуть"}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              <AppIcon name={expanded ? "chevronUp" : "chevronDown"} size="xs" />
            </button>

            <div onClick={(e) => e.stopPropagation()}>
              <RowActionsMenu
                className="operations-row-actions"
                extraActions={rowMenuActions}
                itemId={`htask-${task.id}`}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onDelete={() => onDelete(task)}
                onEdit={() => onEdit(task)}
                onView={() => onView(task)}
              />
            </div>
          </div>
        </div>
      )}

      {expanded ? (
        <div className="operations-linear-drawer">
          {task.note ? (
            <p className="operations-linear-drawer-note">{task.note}</p>
          ) : null}

          {totalChecklistCount > 0 ? (
            <div className="operations-linear-drawer-checklist">
              <div className="operations-linear-drawer-checklist-head">
                <span className="operations-linear-drawer-checklist-title">
                  Чек-лист ({doneChecklistCount}/{totalChecklistCount})
                </span>
                <div className="operations-linear-drawer-progress-track">
                  <div
                    className="operations-linear-drawer-progress-bar"
                    style={{width: `${Math.round((doneChecklistCount / totalChecklistCount) * 100)}%`}}
                  />
                </div>
              </div>
              <div className="operations-linear-drawer-checklist-items">
                {visibleChecklist.map((item) => {
                  const itemSubActions = [
                    ...(isPastDate || isLate ? [
                      {
                        icon: "calendar",
                        label: "Перенести на сегодня",
                        onClick: () => onTransferChecklistItem?.(task, item, today),
                      },
                    ] : []),
                    {
                      icon: "calendar",
                      label: "Перенести на завтра",
                      onClick: () => onTransferChecklistItem?.(task, item, tomorrow),
                    },
                    {
                      icon: "calendar",
                      label: "Перенести на послезавтра",
                      onClick: () => onTransferChecklistItem?.(task, item, dayAfter),
                    },
                    {
                      icon: "calendar",
                      label: "Выбрать дату…",
                      onClick: () => onOpenDatePicker?.({
                        defaultDate: effectiveDueDate,
                        item,
                        task,
                        type: "checklist-item",
                      }),
                    },
                  ];

                  return (
                    <div
                      key={item.id}
                      className={`operations-linear-drawer-check-item ${item.done ? "is-checked" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="operations-linear-drawer-check-label">
                        <Checkbox
                          checked={item.done}
                          onChange={(event) => onToggleChecklist?.(task, item.id, event.target.checked)}
                        />
                        <span className="operations-linear-drawer-check-text">{item.text}</span>
                      </label>
                      {!item.done ? (
                        <div className="operations-checklist-item-actions">
                          <RowActionsMenu
                            extraActions={itemSubActions}
                            itemId={`chk-${task.id}-${item.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="operations-linear-drawer-footer">
            <div className="operations-linear-drawer-meta">
              {rawAssignee ? (
                <span>Исполнитель: <strong>{rawAssignee}</strong></span>
              ) : null}
              {isTaskRepeating(task) ? (
                <span>Повтор: <strong>{formatRepeatSchedule(task)}</strong></span>
              ) : null}
              {estimateMinutes ? (
                <span>Длительность: <strong>{formatMinutes(estimateMinutes)}</strong></span>
              ) : null}
            </div>
            <div className="operations-linear-drawer-actions">
              <button
                type="button"
                className="operations-linear-drawer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
              >
                <AppIcon name="edit" size="xs" />
                <span>Редактировать</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function TaskTemplateCard({onDelete, onEdit, onSelect, onToggleArchived, openMenuId, selected, setOpenMenuId, task, today}) {
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
      <Button className="operations-template-edit-btn" leftIcon="edit" size="sm" variant="secondary" onClick={() => onEdit(task)}>Редактировать</Button>
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

function TaskDetailsDialog({
  item,
  onClose,
  onOpenDatePicker,
  onSave,
  onTransferChecklistItem,
  openMenuId,
  relatedTasks,
  setOpenMenuId,
  today = getWarsawTodayInput(),
}) {
  const taskDate = getTaskDueDate(item) || today;
  const isPastDate = compareInputDates(taskDate, today) < 0;
  const tomorrow = addDays(taskDate, 1);
  const dayAfter = addDays(taskDate, 2);
  const taskPayload = getTaskPayload(item);
  const defaultResults = item?.occurrenceResults ?? {};
  const [checklist, setChecklist] = useState(() => item?.occurrenceChecklist ?? getTaskPayload(item).checklist ?? []);

  const handleTransferItemFromDialog = async (entry, targetDate) => {
    if (!onTransferChecklistItem) return;
    const success = await onTransferChecklistItem(item, entry, targetDate);
    if (success) {
      setChecklist((current) => current.filter((value) => value.id !== entry.id));
    }
  };
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
                  {visibleChecklist.map((entry) => {
                    const itemSubActions = [
                      ...(isPastDate ? [
                        {
                          icon: "calendar",
                          label: "Перенести на сегодня",
                          onClick: () => handleTransferItemFromDialog(entry, today),
                        },
                      ] : []),
                      {
                        icon: "calendar",
                        label: "Перенести на завтра",
                        onClick: () => handleTransferItemFromDialog(entry, tomorrow),
                      },
                      {
                        icon: "calendar",
                        label: "Перенести на послезавтра",
                        onClick: () => handleTransferItemFromDialog(entry, dayAfter),
                      },
                      {
                        icon: "calendar",
                        label: "Выбрать дату…",
                        onClick: () => onOpenDatePicker?.({
                          defaultDate: taskDate,
                          item: entry,
                          onTransferSuccess: (newDate) => handleTransferItemFromDialog(entry, newDate),
                          task: item,
                          type: "checklist-item-dialog",
                        }),
                      },
                    ];

                    return (
                      <div className={`operations-detail-checklist-row ${entry.done ? "is-done" : ""}`} key={entry.id}>
                        <label className="operations-detail-checklist-label">
                          <span className="operations-check-hit">
                            <Checkbox
                              checked={entry.done === true}
                              onChange={(event) => setChecklist((current) => current.map((value) => value.id === entry.id ? {...value, done: event.target.checked} : value))}
                            />
                          </span>
                          <span>{entry.text}</span>
                        </label>
                        {!entry.done ? (
                          <div className="operations-checklist-item-actions">
                            <RowActionsMenu
                              extraActions={itemSubActions}
                              itemId={`dialog-chk-${item.id}-${entry.id}`}
                              openMenuId={openMenuId}
                              setOpenMenuId={setOpenMenuId}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
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
  canManageTasks = true,
  employees = [],
  tasks,
  supplies,
  waitlistEntries = [],
  onAddTask,
  onAddNote,
  onUpdateNote,
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
  onTransferChecklistItem,
  onRenameTaskArea,
  onInitializeAcquisitionPlan,
  onRemoveWaitlistEntry,
  onRestoreWaitlistEntry,
  clientProfiles = [],
  serviceCatalog = [],
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
  const [activeTab, setActiveTab] = useState(() => {
    const storedTab = storedView.activeTab ?? "plan";
    return !canManageTasks && ["plan", "history"].includes(storedTab) ? "notes" : storedTab;
  });
  const [planMode, setPlanMode] = useState(storedView.planMode === "templates" ? "templates" : "week");
  const [selectedDate, setSelectedDate] = useState(() => getWarsawTodayInput());
  const [datePickerState, setDatePickerState] = useState(null);
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
  const [moveUndo, setMoveUndo] = useState(null);
  const today = getWarsawTodayInput();
  const nowTime = getWarsawTime();
  const kanbanSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}));

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({activeTab, planMode, weekViewMode}));
  }, [activeTab, planMode, weekViewMode]);

  useEffect(() => {
    if (!canManageTasks && ["plan", "history"].includes(activeTab)) {
      const timer = window.setTimeout(() => setActiveTab("notes"), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeTab, canManageTasks]);

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
      alertFocus.section === "waitlist" || alertFocus.section === "waitlist_entry" || alertFocus.type === "waitlist" || alertFocus.type === "site_booking"
        ? "waitlist"
        : alertFocus.section === "supplies" || alertFocus.section === "supply" || String(alertFocus.type ?? "").startsWith("supply")
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
  const activeWaitlistCount = waitlistEntries.filter(isWaitlistEntryActive).length;
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

  const tabsNavRef = useRef(null);

  useEffect(() => {
    if (isMobile && tabsNavRef.current) {
      const activeBtn = tabsNavRef.current.querySelector(".is-active");
      if (activeBtn) {
        activeBtn.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
      }
    }
  }, [activeTab, isMobile]);

  const cardProps = {
    isMobile,
    nowTime,
    onComplete: handleTaskCompletionRequest,
    onDelete: onDeleteTask,
    onEdit: onEditTask,
    onMain: (task) => onSetMainTask?.(task, getTaskDueDate(task) || selectedDate),
    onMove: handleMoveTask,
    onMoveToDate: (task, targetDate) => moveTaskWithUndo(task, targetDate),
    onOpenDatePicker: setDatePickerState,
    onToggleChecklist: handleToggleChecklist,
    onTransferChecklistItem,
    onView: setViewingTask,
    openMenuId: openItemMenuId,
    selectedDate,
    setOpenMenuId: setOpenItemMenuId,
    today,
  };

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
      {/* Top Title Bar */}
      <div className="operations-top-bar">
        <div className="operations-top-title-wrap">
          {isTemplateManager ? (
            <IconButton
              className="operations-back-to-tasks-btn"
              icon="chevronLeft"
              label="Вернуться к неделе"
              size="sm"
              variant="secondary"
              onClick={() => setPlanMode("week")}
            />
          ) : null}
          <h1 className="operations-top-title">
            {isTemplateManager ? "Управление задачами" : "Работа"}
          </h1>
          <HintIcon text="Управление ежедневными и регулярными задачами салона, закупками и листом ожидания." />
        </div>
        {!isTemplateManager ? (
          <div className="operations-tabs-action-bar">
            <nav aria-label="Разделы работы" className="operations-tabs-nav" ref={tabsNavRef}>
              {canManageTasks ? (
                <>
                  <SegmentButton
                    active={activeTab === "plan"}
                    onClick={() => {
                      setActiveTab("plan");
                      setSelectedDate(getWarsawTodayInput());
                    }}
                  >
                    Задачи
                  </SegmentButton>
                  <SegmentButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                    История
                  </SegmentButton>
                </>
              ) : null}
              <SegmentButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>
                Заметки
              </SegmentButton>
              <SegmentButton active={activeTab === "supplies"} onClick={() => setActiveTab("supplies")}>
                {isMobile ? "Склад" : "Расходники"}
              </SegmentButton>
              <SegmentButton
                active={activeTab === "waitlist"}
                badge={activeWaitlistCount > 0 ? activeWaitlistCount : null}
                onClick={() => setActiveTab("waitlist")}
              >
                {isMobile ? "Очередь" : "Лист ожидания"}
              </SegmentButton>
            </nav>
            {activeTab === "plan" ? <div className="operations-tabs-right">
              <Button
                className="operations-add-task-cta"
                leftIcon="plus"
                size="sm"
                variant="primary"
                onClick={() => onAddTask?.({dueDate: selectedDate})}
              >
                Добавить задачу
              </Button>
            </div> : null}
          </div>
        ) : null}
        <div className="operations-top-actions">
          <PageNotificationsSlot />
        </div>
      </div>

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
              <>
              <div className="operations-template-manager-head">
                <div className="operations-template-manager-copy">
                  <span>Настройка повторяющейся работы</span>
                  <h2>Регулярные задачи</h2>
                  <p>Здесь задаются дела, которые CRM автоматически показывает в нужные дни недели.</p>
                </div>
                <div className="operations-template-create-actions">
                  <Button leftIcon="folder" size="sm" variant="secondary" onClick={() => {
                    const areaLabel = window.prompt("Название нового направления")?.trim();
                    if (!areaLabel) return;
                    onAddTask?.({areaId: `custom-${Date.now()}`, areaLabel, taskKind: "daily"});
                  }}>Новое направление</Button>
                  <Button className="operations-add-template-btn" leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({taskKind: "daily"})}>Новая регулярная задача</Button>
                </div>
              </div>
              </>
            ) : (
              <div className="operations-task-commandbar">
                <div className="operations-week-switcher">
                  <div className="operations-week-nav-group">
                    <IconButton
                      className="operations-week-nav-btn"
                      icon="chevronLeft"
                      label="Предыдущая неделя"
                      size="sm"
                      variant="secondary"
                      onClick={() => changeWeek(-1)}
                    />
                    <div className="operations-week-info">
                      <div className="operations-week-title-row">
                        <h2 className="operations-week-title">
                          {isMobile ? formatCompactWeekRange(weekStart, weekEnd) : formatHumanWeekRange(weekStart, weekEnd)}
                        </h2>
                        <span className={`operations-week-relative-tag ${isCurrentWeek ? "is-current" : ""}`}>
                          {isCurrentWeek ? (isMobile ? "Текущая" : "Текущая неделя") : getWeekRelativeLabel(weekStart, today)}
                        </span>
                      </div>
                    </div>
                    <IconButton
                      className="operations-week-nav-btn"
                      icon="chevronRight"
                      label="Следующая неделя"
                      size="sm"
                      variant="secondary"
                      onClick={() => changeWeek(1)}
                    />
                  </div>

                  {!isCurrentWeek ? (
                    <Button
                      className="operations-week-today-btn is-jump-current"
                      size="sm"
                      variant="secondary"
                      onClick={() => changeWeek(0)}
                    >
                      {isMobile ? "← К текущей" : "← К текущей неделе"}
                    </Button>
                  ) : null}
                </div>

                <div className="operations-week-controls-row">
                  <div className="operations-week-mode-toggle" role="group" aria-label="Режим отображения недели">
                    <button
                      type="button"
                      className={`operations-week-mode-btn ${weekViewMode === "workweek" ? "is-active" : ""}`}
                      onClick={() => handleToggleWeekViewMode("workweek")}
                    >
                      Будни (5)
                    </button>
                    <button
                      type="button"
                      className={`operations-week-mode-btn ${weekViewMode === "fullweek" ? "is-active" : ""}`}
                      onClick={() => handleToggleWeekViewMode("fullweek")}
                    >
                      {isMobile ? "Вся (7)" : "Вся неделя (7)"}
                      {weekendTaskCount > 0 && weekViewMode === "workweek" ? (
                        <span className="operations-weekend-dot" title={`${weekendTaskCount} задач на выходных`} />
                      ) : null}
                    </button>
                  </div>

                  <Button
                    className="operations-manage-tasks-btn"
                    leftIcon="settings"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPlanMode("templates")}
                  >
                    {isMobile ? "Шаблоны" : "Управление задачами"}
                  </Button>
                </div>
              </div>
            )}

            {moveUndo ? (
              <div className="operations-move-undo" role="status">
                <span><strong>Задача перенесена</strong><small>{formatDateShort(moveUndo.from)} → {formatDateShort(moveUndo.to)}</small></span>
                <Button size="sm" variant="ghost" onClick={undoTaskMove}>Отменить</Button>
                <IconButton icon="x" label="Скрыть" size="sm" variant="ghost" onClick={() => setMoveUndo(null)} />
              </div>
            ) : null}

            {planMode === "templates" ? (
              <div className="operations-template-summary">
                <div><span><strong>{taskTemplates.length}</strong> регулярных задач</span><span>Изменения применяются к будущим дням; история выполнений сохраняется</span></div>
                <div className="operations-template-summary-actions">
                  <label className="operations-template-select-all"><Checkbox checked={taskTemplates.length > 0 && selectedTemplates.length === taskTemplates.length} onChange={(event) => setTemplatesSelected(taskTemplates, event.target.checked)} /><span>Выбрать все</span></label>
                  <label className="operations-template-archive-toggle"><Checkbox checked={showArchivedTemplates} onChange={(event) => setShowArchivedTemplates(event.target.checked)} /><span>Показать архив</span></label>
                  {selectedTemplates.length ? <Button leftIcon="trash" size="sm" variant="danger" onClick={deleteSelectedTemplates}>Удалить ({selectedTemplates.length})</Button> : null}
                </div>
              </div>
            ) : (
              <div className="operations-workday-summary">
                <div className="operations-summary-stats">
                  <span><strong>{weekStats.planned}</strong> {formatTaskNounRu(weekStats.planned)}</span>
                  <span><strong>{weekStats.completed}</strong> выполнено</span>
                  <span className={overdueTasks.length ? "is-alert" : ""}>
                    <strong>{overdueTasks.length}</strong> {overdueTasks.length === 1 ? "просрочена" : "просрочено"}
                  </span>
                </div>
                <div className="operations-summary-progress-wrap">
                  <span className="operations-summary-progress">
                    <i style={{width: `${weekProgress}%`}} />
                  </span>
                  <b>{weekProgress}%</b>
                </div>
              </div>
            )}

            <section className="operations-list-toolbar">
              <div className="operations-task-search">
                <AppIcon name="search" size="sm" className="operations-task-search-icon" />
                <Input
                  value={filters.query}
                  placeholder="Поиск по задачам"
                  className="operations-task-search-input"
                  onChange={(event) => updateFilter("query", event.target.value)}
                />
                {filters.query ? (
                  <IconButton
                    icon="x"
                    label="Очистить поиск"
                    size="sm"
                    variant="ghost"
                    className="operations-task-search-clear"
                    onClick={() => updateFilter("query", "")}
                  />
                ) : null}
              </div>
              <details className="operations-filter-menu">
                <summary className="operations-filter-summary">
                  <AppIcon name="sliders" size="xs" />
                  <span>Фильтры</span>
                  {activeFilterCount ? <span className="operations-filter-badge">{activeFilterCount}</span> : null}
                </summary>
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
              <section className="operations-template-list" aria-label="Регулярные задачи по направлениям">
                {templateGroups.length ? templateGroups.map((group, groupIndex) => (
                  <details className="operations-template-group" key={group.id} open>
                    <summary>
                      <span className="operations-template-group-title">
                        <label className="operations-template-group-select" onClick={(event) => event.stopPropagation()}><Checkbox checked={group.tasks.every((task) => selectedTemplateIds.has(String(task.id)))} onChange={(event) => setTemplatesSelected(group.tasks, event.target.checked)} /><span className="sr-only">Выбрать направление</span></label>
                        <span><small>Направление</small><strong>{group.label}</strong></span>
                        <em>{group.tasks.length} {group.tasks.length === 1 ? "задача" : "задачи"}</em>
                      </span>
                      <span className="operations-template-group-actions" onClick={(event) => event.stopPropagation()}>
                        <Button leftIcon="plus" size="sm" variant="secondary" onClick={() => onAddTask?.({areaId: group.id, areaLabel: group.label, taskKind: "daily"})}>Добавить задачу</Button>
                        <Button leftIcon="edit" size="sm" variant="ghost" onClick={() => { const label = window.prompt("Название направления", group.label)?.trim(); if (label && label !== group.label) onRenameTaskArea?.(group.id, label); }}>Переименовать</Button>
                        <IconButton disabled={groupIndex === 0} icon="chevronUp" label="Поднять направление" size="sm" variant="ghost" onClick={() => moveTemplateArea(group.id, -1)} />
                        <IconButton disabled={groupIndex === templateGroups.length - 1} icon="chevronDown" label="Опустить направление" size="sm" variant="ghost" onClick={() => moveTemplateArea(group.id, 1)} />
                        <AppIcon className="operations-template-group-chevron" name="chevronDown" size="sm" />
                      </span>
                    </summary>
                    {group.tasks.map((task) => (
                      <TaskTemplateCard
                        key={task.id}
                        task={task}
                        today={today}
                        onDelete={onDeleteTask}
                        onEdit={onEditTask}
                        onSelect={setTemplateSelected}
                        onToggleArchived={onSetTaskTemplateArchived}
                        openMenuId={openItemMenuId}
                        selected={selectedTemplateIds.has(String(task.id))}
                        setOpenMenuId={setOpenItemMenuId}
                      />
                    ))}
                  </details>
                )) : <p className="operations-empty">Регулярных задач по выбранным фильтрам нет.</p>}
              </section>
            ) : (
              <DndContext sensors={kanbanSensors} onDragEnd={handleKanbanDragEnd}>
                <div className="operations-linear-container">
                  <div className={`operations-mini-week-bar mode-${weekViewMode}`} role="tablist" aria-label="Дни недели">
                    {miniWeekDays.map((day) => (
                      <MiniWeekDayTab
                        day={day}
                        isCurrentDay={day.input === today}
                        isPastDay={compareInputDates(day.input, today) < 0}
                        isSelected={day.input === selectedDate}
                        key={day.input}
                        onClick={setSelectedDate}
                        tasks={weekTasksRaw.filter((task) => getTaskDueDate(task) === day.input)}
                      />
                    ))}
                  </div>

                  <section className="operations-day-focus-view">
                    <header className="operations-day-focus-header">
                      <div className="operations-day-focus-title-row">
                        <h2 className="operations-day-focus-title">
                          {formatDayFullTitle(selectedDate)}
                        </h2>
                        {selectedDate === today ? (
                          <span className="operations-day-today-pill">Сегодня</span>
                        ) : null}
                        <span className="operations-day-meta-badge">
                          {selectedDayStats.planned
                            ? `${formatTaskCountRu(selectedDayStats.planned)}${selectedDayStats.totalMinutes ? ` • ${formatMinutes(selectedDayStats.totalMinutes)}` : ""}`
                            : "0 задач"}
                        </span>
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
                              Новая задача
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
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
        <NotionNotesWorkspace
          notes={notes}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteTask}
          onUpdateNote={onUpdateNote}
        />
      ) : null}

      {activeTab === "history" ? <OperationsHistory tasks={workTasks} /> : null}

      {activeTab === "supplies" ? (
        <section className="panel operations-panel operations-panel-supplies">
          <div className="operations-panel-header">
            <div><AppIcon name="packagePlus" size="md" /><div><h2>Расходники</h2><p>{supplies.length} позиций · {lowStockCount} пополнить</p></div></div>
            {canManageTasks ? (
              <Button leftIcon="plus" size="sm" variant="primary" onClick={onAddSupply}>Добавить</Button>
            ) : null}
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
                      {canManageTasks ? (
                        <RowActionsMenu
                          extraActions={[{disabled: !item.orderUrl, icon: "external", label: "Заказать", onClick: () => openSupplyOrderUrl(item.orderUrl)}]}
                          itemId={`supply-${item.id}`}
                          openMenuId={openItemMenuId}
                          setOpenMenuId={setOpenItemMenuId}
                          onDelete={() => onDeleteSupply(item)}
                          onEdit={() => onEditSupply(item)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="supply-meta">
                    <span><strong>{item.stock} {item.unit}</strong><small>мин {item.minStock}</small></span>
                    {canManageTasks ? <span><strong>{formatMoney(item.cost)}</strong></span> : null}
                  </div>
                  <div className="supply-actions">
                    <IconButton icon="minus" label="Уменьшить остаток" size="sm" variant="secondary" onClick={() => onChangeSupplyStock(item, -1)} />
                    <IconButton icon="plus" label="Увеличить остаток" size="sm" variant="secondary" onClick={() => onChangeSupplyStock(item, 1)} />
                  </div>
                </article>
              );
            })}
            {!supplies.length ? <p className="operations-empty">Расходников пока нет.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "waitlist" ? (
        <section className="operations-panel-waitlist">
          <WaitlistPanel
            alertFocus={alertFocus}
            clientProfiles={clientProfiles}
            employees={employees}
            openMenuId={openItemMenuId}
            serviceCatalog={serviceCatalog}
            setOpenMenuId={setOpenItemMenuId}
            waitlistEntries={waitlistEntries}
            onAdd={onAddWaitlistEntry}
            onBook={onBookWaitlistEntry}
            onEdit={onEditWaitlistEntry}
            onMessage={onMessageWaitlistEntry}
            onRemove={onRemoveWaitlistEntry}
            onRestore={onRestoreWaitlistEntry}
            onAlertFocusHandled={onAlertFocusHandled}
          />
        </section>
      ) : null}

      {currentViewingTask ? (
        <TaskDetailsDialog
          item={currentViewingTask}
          key={`${currentViewingTask.id}-${getTaskDueDate(currentViewingTask)}`}
          onClose={() => setViewingTask(null)}
          onOpenDatePicker={setDatePickerState}
          onSave={onSaveTaskOccurrence}
          onTransferChecklistItem={onTransferChecklistItem}
          openMenuId={openItemMenuId}
          relatedTasks={workTasks}
          setOpenMenuId={setOpenItemMenuId}
          today={today}
        />
      ) : null}

      {datePickerState ? (
        <OperationsDatePickerDialog
          initialDate={datePickerState.defaultDate || today}
          isOpen={Boolean(datePickerState)}
          minDate={today}
          title={
            datePickerState.type === "task"
              ? `Перенести задачу «${datePickerState.task?.title}»`
              : `Перенести пункт «${datePickerState.item?.text}»`
          }
          onClose={() => setDatePickerState(null)}
          onSelectDate={(chosenDate) => {
            if (datePickerState.type === "task") {
              moveTaskWithUndo(datePickerState.task, chosenDate);
            } else if (datePickerState.type === "checklist-item") {
              onTransferChecklistItem?.(datePickerState.task, datePickerState.item, chosenDate);
            } else if (datePickerState.type === "checklist-item-dialog") {
              datePickerState.onTransferSuccess?.(chosenDate);
            }
          }}
        />
      ) : null}
    </section>
  );
}

export default OperationsPage;
