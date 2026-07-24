import WaitlistPanel from "../WaitlistPanel.jsx";
import PageHeader from "../PageHeader.jsx";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {useEffect, useMemo, useState} from "react";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {getTodayInput} from "../../utils/dateHelpers.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {sortWorkTasks} from "../../utils/taskSort.js";
import {
  getSupplyStockStatus,
  getSupplyStockStatusLabel,
  isSupplyLowStock,
} from "../../utils/supplyStock.js";
import {openSupplyOrderUrl} from "../../utils/supplyOrder.js";
import {
  AppIcon,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  IconButton,
  Input,
} from "../ui/index.js";

const NOTE_CATEGORIES = ["Мысль", "Заказать", "Идея", "Личное"];
const TASK_FILTERS = [
  {id: "active", label: "Активные"},
  {id: "overdue", label: "Просрочено"},
  {id: "high", label: "Высокий"},
  {id: "completed", label: "Готово"},
  {id: "all", label: "Все"},
];

const getTaskStatusLabel = (task) => {
  if (task.status === "completed") return "Готово";
  if (task.dueDate && task.dueDate < getTodayInput())
    return "Просрочено";
  return "В работе";
};

const getTaskIndicatorClass = (task, status) => {
  if (task.status === "completed") return "task-indicator-completed";
  if (task.priority === "Высокий" || status === "Просрочено") {
    return "task-indicator-urgent";
  }
  if (task.priority === "Средний") return "task-indicator-medium";
  return "task-indicator-low";
};

const getNoteIconClass = (category) => {
  if (category === "Идея") return "note-icon-idea";
  if (category === "Заказать") return "note-icon-order";
  if (category === "Личное") return "note-icon-personal";
  return "note-icon-thought";
};

const getSupplyIndicatorClass = (stockStatus) => {
  if (stockStatus === "out") return "supply-indicator-critical";
  if (stockStatus === "low") return "supply-indicator-low";
  return "supply-indicator-ok";
};

const getSupplyIconClass = (stockStatus) => {
  if (stockStatus === "out") return "supply-icon-critical";
  if (stockStatus === "low") return "supply-icon-low";
  return "supply-icon-ok";
};

const taskCollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return closestCenter(args);
};

const snapTaskOverlayToCursor = ({activatorEvent, draggingNodeRect, transform}) => {
  if (!activatorEvent || !draggingNodeRect) {
    return transform;
  }

  const point =
    "clientX" in activatorEvent
      ? activatorEvent
      : activatorEvent.touches?.[0] ?? activatorEvent.changedTouches?.[0];

  if (!point) {
    return transform;
  }

  return {
    ...transform,
    x:
      transform.x +
      (point.clientX - draggingNodeRect.left) -
      18,
    y:
      transform.y +
      (point.clientY - draggingNodeRect.top) -
      18,
  };
};

function TaskDragPreview({task}) {
  const status = getTaskStatusLabel(task);

  return (
    <article
      className={`task-row task-drag-preview task-${task.status} ${getTaskIndicatorClass(task, status)}`}>
      <div className="task-row-content">
        <div aria-hidden="true" className="task-drag-handle task-drag-handle-preview">
          <AppIcon name="grip" size="sm" />
        </div>
        <div className="operations-card-head">
          <span aria-hidden="true" className="task-check task-check-preview" />
          <div className="operations-card-body">
            <strong>{task.title}</strong>
            <span>{task.note || "Без комментария"}</span>
          </div>
        </div>
        <div className="task-meta">
          <b className={`task-priority priority-${task.priority}`}>
            {task.priority}
          </b>
          <small>{task.dueDate || "Без срока"}</small>
          <em>{status}</em>
        </div>
      </div>
    </article>
  );
}

function DraggableTaskRow({children, className, id, task}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef: setDraggableRef,
  } = useDraggable({
    id: `task-${task.id}`,
    data: {task},
  });
  const {isOver, setNodeRef: setDroppableRef} = useDroppable({
    id: `task-drop-${task.id}`,
    data: {task},
  });

  const setNodeRef = (node) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  return (
    <article
      className={`${className} ${isDragging ? "task-row-dragging" : ""} ${
        isOver && !isDragging ? "task-row-over" : ""
      }`}
      id={id}
      ref={setNodeRef}>
      <div className="task-row-content">
        <IconButton
          aria-label={`Переместить задачу: ${task.title}`}
          className="task-drag-handle"
          icon="grip"
          size="sm"
          title="Переместить"
          variant="ghost"
          {...listeners}
          {...attributes}
        />
        {children}
      </div>
    </article>
  );
}

function OperationItemDetails({item, onClose, onComplete, onDelete, onEdit}) {
  if (!item) {
    return null;
  }

  const isNote = item.type === "note";
  const status = isNote ? "" : getTaskStatusLabel(item);
  const description = String(item.note ?? "").trim();

  return (
    <Dialog open={Boolean(item)}>
      <DialogBackdrop
        className="operations-detail-backdrop"
        onClick={onClose}>
        <DialogContent
          aria-labelledby="operation-detail-title"
          className="operations-detail-dialog"
          role="dialog"
          onClick={(event) => event.stopPropagation()}>
          <header className="operations-detail-header">
            <div>
              <span>{isNote ? "Заметка" : "Задача"}</span>
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
              <span>{isNote ? item.priority || "Мысль" : item.priority}</span>
              {!isNote ? <span>{item.dueDate || "Без срока"}</span> : null}
              {!isNote ? <span>{status}</span> : null}
            </div>
            <section className="operations-detail-text">
              <p>{description || "Без комментария"}</p>
            </section>
          </div>
          <footer className="operations-detail-actions">
            {!isNote && item.status !== "completed" ? (
              <Button
                leftIcon="check"
                size="sm"
                variant="secondary"
                onClick={() => {
                  onComplete?.(item);
                  onClose();
                }}>
                Выполнить
              </Button>
            ) : null}
            <Button
              leftIcon="edit"
              size="sm"
              variant="secondary"
              onClick={() => {
                onEdit?.(item);
                onClose();
              }}>
              Изменить
            </Button>
            <Button
              leftIcon="trash"
              size="sm"
              variant="secondary"
              onClick={() => {
                onDelete?.(item);
                onClose();
              }}>
              Удалить
            </Button>
          </footer>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}

function OperationsPage({
  alertFocus,
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
  onRemoveWaitlistEntry,
  onReorderTasks,
  onAddSupply,
  onEditSupply,
  onDeleteSupply,
  onChangeSupplyStock,
}) {
  const {isMobile} = useBreakpoint();
  const [draggedTask, setDraggedTask] = useState(null);
  const [openItemMenuId, setOpenItemMenuId] = useState(null);
  const [activeMode, setActiveMode] = useState("tasks");
  const [mobileSection, setMobileSection] = useState("tasks");
  const [taskFilter, setTaskFilter] = useState("active");
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const [isNoteCategoryOpen, setIsNoteCategoryOpen] = useState(false);
  const [viewingOperationItem, setViewingOperationItem] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(TouchSensor, {
      activationConstraint: {delay: 120, tolerance: 8},
    }),
  );
  const notes = tasks.filter((task) => task.type === "note");
  const workTasks = tasks.filter((task) => task.type !== "note");
  const sortedWorkTasks = useMemo(
    () => sortWorkTasks(workTasks),
    [workTasks],
  );
  const activeTasks = workTasks.filter((task) => task.status !== "completed");
  const completedTasks = workTasks.filter((task) => task.status === "completed");
  const overdueTasks = workTasks.filter(
    (task) => task.status !== "completed" && getTaskStatusLabel(task) === "Просрочено",
  );
  const highPriorityTasks = workTasks.filter(
    (task) => task.status !== "completed" && task.priority === "Высокий",
  );
  const taskFilterCounts = {
    active: activeTasks.length,
    all: workTasks.length,
    completed: completedTasks.length,
    high: highPriorityTasks.length,
    overdue: overdueTasks.length,
  };
  const visibleWorkTasks = useMemo(
    () =>
      sortedWorkTasks.filter((task) => {
        if (taskFilter === "all") return true;
        if (taskFilter === "completed") return task.status === "completed";
        if (taskFilter === "high") {
          return task.status !== "completed" && task.priority === "Высокий";
        }
        if (taskFilter === "overdue") {
          return task.status !== "completed" && getTaskStatusLabel(task) === "Просрочено";
        }
        return task.status !== "completed";
      }),
    [sortedWorkTasks, taskFilter],
  );
  const lowStockCount = supplies.filter(isSupplyLowStock).length;
  const activeWaitlistCount = waitlistEntries.filter(
    (entry) => entry.status === "active",
  ).length;
  const sortedSupplies = useMemo(
    () =>
      [...supplies].sort((left, right) => {
        const leftLow = isSupplyLowStock(left) ? 0 : 1;
        const rightLow = isSupplyLowStock(right) ? 0 : 1;

        if (leftLow !== rightLow) {
          return leftLow - rightLow;
        }

        return String(left.name).localeCompare(String(right.name), "ru");
      }),
    [supplies],
  );
  const resetTransientOperationState = () => {
    setOpenItemMenuId(null);
    setIsNoteCategoryOpen(false);
    setViewingOperationItem(null);
  };

  const openOperationEditor = (item) => {
    setOpenItemMenuId(null);
    setViewingOperationItem(null);
    window.setTimeout(() => onEditTask(item), 0);
  };

  const requestOperationDelete = (item) => {
    setOpenItemMenuId(null);
    setViewingOperationItem(null);
    window.setTimeout(() => onDeleteTask(item), 0);
  };

  const submitQuickNote = (event) => {
    event.preventDefault();
    const title = noteText.trim();

    if (!title) return;

    onAddNote({title, category: noteCategory});
    setNoteText("");
    setIsNoteCategoryOpen(false);
  };

  useEffect(() => {
    if (!alertFocus?.entityId) {
      return undefined;
    }

    const setupTimer = window.setTimeout(() => {
      setOpenItemMenuId(null);
      setIsNoteCategoryOpen(false);

      if (alertFocus.section === "supplies") {
        setMobileSection("supplies");
      } else if (alertFocus.section === "tasks" || alertFocus.type === "task") {
        setActiveMode("tasks");
        setMobileSection("tasks");
      }

      document
        .getElementById(`alert-focus-${alertFocus.entityId}`)
        ?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 0);
    const clearTimer = window.setTimeout(() => {
      onAlertFocusHandled?.();
    }, 4500);

    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(clearTimer);
    };
  }, [alertFocus, onAlertFocusHandled]);

  const isFocused = (entityId) =>
    String(alertFocus?.entityId) === String(entityId);

  const mobileSectionLabels = {
    tasks: "Задачи",
    supplies: "Склад",
    waitlist: "Лист ожидания",
  };

  const operationsCollapsedMeta = isMobile
    ? `${mobileSectionLabels[mobileSection]} · ${activeTasks.length} задач`
    : `${activeTasks.length} задач · ${lowStockCount} пополнить`;

  return (
    <section
      className={`operations-page ${isMobile ? "operations-page-mobile" : ""}`}>
      <PageHeader
        collapsedMeta={operationsCollapsedMeta}
        collapsible={false}
        description={isMobile ? undefined : "Рабочие дела, закупки и остатки расходников"}
        title="Операции"
        actions={
          <>
            <div className="operations-page-tabs">
              <Button
                className={mobileSection === "tasks" ? "active" : ""}
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetTransientOperationState();
                  setMobileSection("tasks");
                }}>
                Задачи
              </Button>
              <Button
                className={mobileSection === "supplies" ? "active" : ""}
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetTransientOperationState();
                  setMobileSection("supplies");
                }}>
                Склад
              </Button>
              <Button
                className={mobileSection === "waitlist" ? "active" : ""}
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetTransientOperationState();
                  setMobileSection("waitlist");
                }}>
                Лист ожидания
              </Button>
            </div>
            <div className="operations-summary">
              <span>
                <b>{activeTasks.length}</b> задач
              </span>
              <span>
                <b>{notes.length}</b> заметок
              </span>
              <span>
                <b>{activeWaitlistCount}</b> в листе
              </span>
              <span
                className={
                  lowStockCount > 0 ? "operations-summary-alert" : ""
                }>
                <b>{lowStockCount}</b> нужно пополнить
              </span>
            </div>
          </>
        }
      />

      <div className="operations-grid">
        <section
          className={`panel operations-panel operations-panel-tasks operations-panel-mode-${activeMode} ${
            mobileSection !== "tasks" ? "operations-panel-hidden-mobile" : ""
          }`}>
          <div className="operations-panel-header">
            <div>
              <AppIcon name="clipboardCheck" size="md" />
              <div>
                <h2>Задачи</h2>
                <p>
                  {activeMode === "tasks"
                    ? `${completedTasks.length} выполнено`
                    : "Мысли, идеи и личные покупки"}
                </p>
              </div>
            </div>
            <div className="operations-header-actions">
              <div className="operations-tabs">
                <Button
                  className={activeMode === "tasks" ? "active" : ""}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetTransientOperationState();
                    setActiveMode("tasks");
                  }}>
                  Задачи
                </Button>
                <Button
                  className={activeMode === "notes" ? "active" : ""}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetTransientOperationState();
                    setActiveMode("notes");
                  }}>
                  Заметки
                </Button>
              </div>
              {activeMode === "tasks" && (
                <Button
                  className="add-visit-button"
                  leftIcon="plus"
                  size="sm"
                  variant="primary"
                  onClick={onAddTask}>
                  Добавить
                </Button>
              )}
            </div>
          </div>
          {activeMode === "tasks" ? (
            <DndContext
              collisionDetection={taskCollisionDetection}
              sensors={sensors}
              onDragCancel={() => setDraggedTask(null)}
              onDragStart={({active}) =>
                setDraggedTask(active.data.current?.task ?? null)
              }
              onDragEnd={({active, over}) => {
                const draggedTaskId = active.data.current?.task?.id;
                const targetTaskId = over?.data.current?.task?.id;

                if (
                  draggedTaskId &&
                  targetTaskId &&
                  draggedTaskId !== targetTaskId
                ) {
                  onReorderTasks(draggedTaskId, targetTaskId);
                }

                setDraggedTask(null);
              }}>
              <div className="operations-task-center">
                <div className="operations-task-filters" aria-label="Фильтры задач">
                  {TASK_FILTERS.map((filter) => (
                    <Button
                      className={taskFilter === filter.id ? "active" : ""}
                      key={filter.id}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        resetTransientOperationState();
                        setTaskFilter(filter.id);
                      }}>
                      {filter.label}
                      <span>{taskFilterCounts[filter.id] ?? 0}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="operations-list">
                {visibleWorkTasks.map((task) => {
                  const status = getTaskStatusLabel(task);
                  const isHighPriorityActive =
                    task.priority === "Высокий" && task.status !== "completed";
                  return (
                    <DraggableTaskRow
                      className={`task-row task-${task.status} ${getTaskIndicatorClass(task, status)} ${isHighPriorityActive ? "task-priority-high-blink" : ""} ${status === "Просрочено" ? "task-overdue" : ""} ${isFocused(task.id) ? "alert-focus-pulse" : ""}`}
                      id={`alert-focus-${task.id}`}
                      key={task.id}
                      task={task}>
                      <div className="operations-card-head">
                        <IconButton
                          aria-label="Завершить задачу"
                          className="task-check"
                          disabled={task.status === "completed"}
                          icon="check"
                          label="Завершить"
                          size="sm"
                          variant="ghost"
                          onClick={() => onCompleteTask(task)}
                        />
                        <button
                          className="operations-card-body operations-card-view"
                          type="button"
                          onClick={() => setViewingOperationItem(task)}>
                          <strong>{task.title}</strong>
                          <span>{task.note || "Без комментария"}</span>
                        </button>
                        <RowActionsMenu
                          className="operations-row-actions"
                          itemId={task.id}
                          openMenuId={openItemMenuId}
                          setOpenMenuId={setOpenItemMenuId}
                          onDelete={() => requestOperationDelete(task)}
                          onEdit={() => openOperationEditor(task)}
                          onView={() => setViewingOperationItem(task)}
                        />
                      </div>
                      <div className="task-meta">
                        <b className={`task-priority priority-${task.priority}`}>
                          {task.priority}
                        </b>
                        <small>{task.dueDate || "Без срока"}</small>
                        <em>{status}</em>
                      </div>
                    </DraggableTaskRow>
                  );
                })}
                {workTasks.length === 0 ? (
                  <p className="operations-empty">Задач пока нет.</p>
                ) : visibleWorkTasks.length === 0 ? (
                  <p className="operations-empty">В этом фильтре задач нет.</p>
                ) : null}
              </div>
              <DragOverlay
                dropAnimation={{duration: 180, easing: "ease"}}
                modifiers={[snapTaskOverlayToCursor]}>
                {draggedTask ? <TaskDragPreview task={draggedTask} /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="operations-notes">
              <form className="quick-note-form" onSubmit={submitQuickNote}>
                <AppIcon name="stickyNote" size="sm" />
                <Input
                  className="quick-note-input"
                  value={noteText}
                  placeholder="Мысль, идея или что заказать"
                  onChange={(event) => setNoteText(event.target.value)}
                />
                <div
                  className="quick-note-category"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setIsNoteCategoryOpen(false);
                    }
                  }}>
                  <Button
                    aria-expanded={isNoteCategoryOpen}
                    className="quick-note-category-trigger"
                    rightIcon="chevronDown"
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsNoteCategoryOpen((isOpen) => !isOpen)}>
                    {noteCategory}
                  </Button>
                  {isNoteCategoryOpen && (
                    <div className="quick-note-category-menu" role="listbox">
                      {NOTE_CATEGORIES.map((category) => (
                        <Button
                          aria-selected={noteCategory === category}
                          className={
                            noteCategory === category ? "is-selected" : ""
                          }
                          key={category}
                          role="option"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNoteCategory(category);
                            setIsNoteCategoryOpen(false);
                          }}>
                          {category}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  className="add-visit-button"
                  leftIcon="plus"
                  size="sm"
                  type="submit"
                  variant="primary">
                  Записать
                </Button>
              </form>
              <div className="operations-list notes-list">
                {notes.map((note) => (
                  <article className="note-row" key={note.id}>
                    <div className="operations-card-head">
                      <span
                        className={`operations-card-icon note-card-icon ${getNoteIconClass(note.priority)}`}>
                        {note.priority === "Идея" ? (
                          <AppIcon name="lightbulb" size="sm" />
                        ) : (
                          <AppIcon name="stickyNote" size="sm" />
                        )}
                      </span>
                      <button
                        className="operations-card-body operations-card-view"
                        type="button"
                        onClick={() => setViewingOperationItem(note)}>
                        <strong>{note.title}</strong>
                        <span>{note.note || note.priority || "Мысль"}</span>
                      </button>
                      <RowActionsMenu
                        className="operations-row-actions"
                        itemId={note.id}
                        openMenuId={openItemMenuId}
                        setOpenMenuId={setOpenItemMenuId}
                        onDelete={() => requestOperationDelete(note)}
                        onEdit={() => openOperationEditor(note)}
                        onView={() => setViewingOperationItem(note)}
                      />
                    </div>
                    <div className="note-meta">
                      <span className="note-meta-item note-category-pill">
                        {note.priority || "Мысль"}
                      </span>
                      {note.note && note.note !== note.title ? (
                        <span className="note-meta-item note-meta-detail">
                          {note.note}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
                {notes.length === 0 && (
                  <p className="operations-empty">
                    Здесь можно хранить личные мысли, идеи и покупки.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section
          className={`panel operations-panel operations-panel-supplies ${
            mobileSection !== "supplies" ? "operations-panel-hidden-mobile" : ""
          }`}>
          <div className="operations-panel-header">
            <div>
              <AppIcon name="packagePlus" size="md" />
              <div>
                <h2>Расходники</h2>
                <p>
                  {supplies.length} позиций
                  {lowStockCount > 0
                    ? ` · ${lowStockCount} нужно пополнить`
                    : " на складе"}
                </p>
              </div>
            </div>
            <Button
              className="add-visit-button"
              leftIcon="plus"
              size="sm"
              type="button"
              variant="primary"
              onClick={onAddSupply}>
              Добавить
            </Button>
          </div>
          <div className="operations-list">
            {sortedSupplies.map((item) => {
              const stockStatus = getSupplyStockStatus(item);
              const stockBadge = getSupplyStockStatusLabel(stockStatus);
              const rowClassName =
                stockStatus === "out"
                  ? "supply-critical"
                  : stockStatus === "low"
                    ? "supply-low"
                    : "";

              return (
                <article
                  className={`supply-row ${rowClassName} ${getSupplyIndicatorClass(stockStatus)} ${isFocused(item.id) ? "alert-focus-pulse" : ""}`}
                  id={`alert-focus-${item.id}`}
                  key={item.id}>
                  <div className="operations-card-head">
                    <span
                      className={`operations-card-icon supply-card-icon ${getSupplyIconClass(stockStatus)}`}>
                      <AppIcon name="packagePlus" size="sm" />
                    </span>
                    <div className="operations-card-body">
                      <div className="supply-row-title">
                        <strong>{item.name}</strong>
                        {stockBadge ? (
                          <span className="supply-stock-badge">{stockBadge}</span>
                        ) : null}
                      </div>
                      {item.note && item.note !== "Расходный материал" ? (
                        <span className="supply-row-note">{item.note}</span>
                      ) : null}
                    </div>
                    <RowActionsMenu
                      className="operations-row-actions"
                      itemId={item.id}
                      openMenuId={openItemMenuId}
                      setOpenMenuId={setOpenItemMenuId}
                      onDelete={() => onDeleteSupply(item)}
                      onEdit={() => onEditSupply(item)}
                    />
                  </div>
                  <div className="supply-meta">
                    <span className="supply-meta-item">
                      <strong>
                        {item.stock} {item.unit}
                      </strong>
                      <small>мин {item.minStock}</small>
                    </span>
                    <span className="supply-meta-item supply-meta-cost">
                      <strong>{formatMoney(item.cost)}</strong>
                    </span>
                  </div>
                  <div className="supply-actions">
                    <Button
                      className="supply-order-button"
                      disabled={!item.orderUrl}
                      leftIcon="external"
                      size="sm"
                      title={
                        item.orderUrl
                          ? "Открыть ссылку на заказ"
                          : "Укажите ссылку в редактировании"
                      }
                      variant="secondary"
                      onClick={() => openSupplyOrderUrl(item.orderUrl)}>
                      Заказать
                    </Button>
                    <IconButton
                      icon="minus"
                      label="Уменьшить остаток"
                      size="sm"
                      variant="secondary"
                      onClick={() => onChangeSupplyStock(item, -1)}>
                    </IconButton>
                    <IconButton
                      icon="plus"
                      label="Увеличить остаток"
                      size="sm"
                      variant="secondary"
                      onClick={() => onChangeSupplyStock(item, 1)}>
                    </IconButton>
                  </div>
                </article>
              );
            })}
            {supplies.length === 0 && (
              <p className="operations-empty">Добавьте первый расходник.</p>
            )}
          </div>
        </section>

        <section
          className={`panel operations-panel operations-panel-waitlist ${
            mobileSection !== "waitlist" ? "operations-panel-hidden-mobile" : ""
          }`}>
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
        </section>
      </div>
      <OperationItemDetails
        item={viewingOperationItem}
        onClose={() => setViewingOperationItem(null)}
        onComplete={onCompleteTask}
        onDelete={requestOperationDelete}
        onEdit={openOperationEditor}
      />
    </section>
  );
}

export default OperationsPage;
