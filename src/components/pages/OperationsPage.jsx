import {useEffect, useMemo, useState} from "react";
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
  expandTasksForRange,
  formatDateShort,
  getChecklistProgress,
  getDayStats,
  getOverdueTasks,
  getTaskAssigneeName,
  getTaskDueDate,
  getTaskDueTime,
  getTaskEstimateMinutes,
  getTaskKind,
  getTaskKindLabel,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getWarsawTime,
  getWarsawTodayInput,
  getWeekDays,
  getWeekStart,
  isTaskCompleted,
  isTaskMainOnDate,
  isTaskOverdue,
  isTaskRepeating,
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
const FILTER_STORAGE_KEY = "nuar-crm-operations-filters-v2";

const DEFAULT_FILTERS = {
  assigneeId: "__all__",
  priority: "__all__",
  query: "",
  showCompleted: false,
  status: "__all__",
  taskKind: "__all__",
};

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
          <em>{assigneeName}</em>
          <em>{formatTaskDateTime(task)}</em>
          {getTaskEstimateMinutes(task) ? <em>{formatMinutes(getTaskEstimateMinutes(task))}</em> : null}
          <em>{getTaskPriorityLabel(task)}</em>
          {isTaskRepeating(task) ? <em>Повтор</em> : null}
          {checklist.total ? <em>{checklist.done}/{checklist.total}</em> : null}
          <em>{status}</em>
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

function TaskDetailsDialog({item, nowTime, onClose, onComplete, onDelete, onEdit, today}) {
  if (!item) return null;
  const checklist = getChecklistProgress(item);

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
              {getTaskEstimateMinutes(item) ? <span>{formatMinutes(getTaskEstimateMinutes(item))}</span> : null}
              {checklist.total ? <span>Чек-лист {checklist.done}/{checklist.total}</span> : null}
            </div>
            <section className="operations-detail-text">
              <p>{item.note || item.description || "Без описания"}</p>
            </section>
          </div>
          <footer className="operations-detail-actions">
            <Button leftIcon={isTaskCompleted(item) ? "rotateCcw" : "check"} size="sm" variant="secondary" onClick={() => onComplete(item)}>
              {isTaskCompleted(item) ? "Вернуть" : "Завершить"}
            </Button>
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
  onRemoveWaitlistEntry,
  onSetMainTask,
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
  const workTasks = tasks.filter((task) => task.type !== "note");
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
    () => [
      ...expandTasksForRange(workTasks, addDays(selectedDate, -30), addDays(selectedDate, 60)),
      ...expandTasksForRange(workTasks, selectedDate, selectedDate, {includeNoDate: true}).filter((task) => !getTaskDueDate(task)),
    ],
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
  const dayStats = getDayStats(dayTasks);
  const mainTask = dayTasks.find((task) => isTaskMainOnDate(task, selectedDate));

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

  const dailyTasks = dayTasks.filter((task) => getTaskKind(task) === "daily");
  const developmentTasks = dayTasks.filter((task) => getTaskKind(task) === "development");
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
            <div className="operations-summary">
              <span><b>{dayStats.completed}</b> готово</span>
              <span><b>{dayStats.planned}</b> в плане</span>
              <span><b>{formatMinutes(dayStats.remainingMinutes)}</b></span>
              <span className={lowStockCount > 0 ? "operations-summary-alert" : ""}><b>{lowStockCount}</b> пополнить</span>
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
            <div className="operations-planner-head">
              <div>
                <span>{selectedDate === today ? "Сегодня" : "Выбранный день"}</span>
                <h2>{selectedDate}</h2>
              </div>
              <div className="operations-date-controls">
                <IconButton icon="chevronLeft" label="Предыдущий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, planMode === "week" ? -7 : -1))} />
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                <IconButton icon="chevronRight" label="Следующий день" size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, planMode === "week" ? 7 : 1))} />
                <Button size="sm" variant="secondary" onClick={() => setSelectedDate(today)}>Сегодня</Button>
              </div>
            </div>

            <div className="operations-plan-mode">
              <SegmentButton active={planMode === "today"} onClick={() => setPlanMode("today")}>Сегодня</SegmentButton>
              <SegmentButton active={planMode === "week"} onClick={() => setPlanMode("week")}>Неделя</SegmentButton>
              <SegmentButton active={planMode === "all"} onClick={() => setPlanMode("all")}>Все задачи</SegmentButton>
            </div>

            <div className="operations-day-metrics">
              <div><strong>{dayStats.planned}</strong><span>запланировано</span></div>
              <div><strong>{dayStats.completed}</strong><span>выполнено</span></div>
              <div><strong>{formatMinutes(dayStats.remainingMinutes)}</strong><span>осталось</span></div>
              <div><strong>{dayStats.progress}%</strong><span>прогресс</span></div>
            </div>
            <div className="operations-progress-bar" aria-label={`Прогресс ${dayStats.progress}%`}>
              <span style={{width: `${dayStats.progress}%`}} />
            </div>

            <section className="operations-main-task">
              <div>
                <span>Главная задача дня</span>
                {mainTask ? (
                  <>
                    <strong>{mainTask.title}</strong>
                    <small>{getTaskAssigneeName(mainTask) || "Без исполнителя"} · {getTaskKindLabel(mainTask)}</small>
                  </>
                ) : (
                  <>
                    <strong>Не выбрана</strong>
                    <small>Назначьте из меню задачи или создайте новую.</small>
                  </>
                )}
              </div>
              <Button leftIcon="plus" size="sm" variant="primary" onClick={() => onAddTask?.({dueDate: selectedDate})}>Новая задача</Button>
            </section>

            <section className="operations-filters">
              <label className="settings-checkbox">
                <input
                  checked={filters.showCompleted}
                  type="checkbox"
                  onChange={(event) => updateFilter("showCompleted", event.target.checked)}
                />
                <span>Показывать завершённые</span>
              </label>
              <Input value={filters.query} placeholder="Поиск по задачам" onChange={(event) => updateFilter("query", event.target.value)} />
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
              <Button size="sm" variant="secondary" onClick={resetFilters}>Сбросить</Button>
            </section>

            {planMode === "today" ? (
              <div className="operations-plan-columns">
                {overdueTasks.length ? (
                  <TaskGroup title="Просрочено" tasks={overdueTasks} empty="Просроченных задач нет." {...cardProps} />
                ) : null}
                <TaskGroup title="Регулярные дела" tasks={dailyTasks} empty="На этот день нет регулярных дел." onAddTask={() => onAddTask?.({dueDate: selectedDate, taskKind: "daily"})} {...cardProps} />
                <TaskGroup title="Развитие" tasks={developmentTasks} empty="На этот день нет задач развития." onAddTask={() => onAddTask?.({dueDate: selectedDate, taskKind: "development"})} {...cardProps} />
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

      <TaskDetailsDialog
        item={viewingTask}
        nowTime={nowTime}
        today={today}
        onClose={() => setViewingTask(null)}
        onComplete={onCompleteTask}
        onDelete={onDeleteTask}
        onEdit={onEditTask}
      />
    </section>
  );
}

export default OperationsPage;
