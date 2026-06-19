import {
  Check,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  GripVertical,
  Lightbulb,
  PackagePlus,
  Plus,
  StickyNote,
} from "lucide-react";
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

const NOTE_CATEGORIES = ["Мысль", "Заказать", "Идея", "Личное"];

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

function TaskDragPreview({task}) {
  const status = getTaskStatusLabel(task);

  return (
    <article
      className={`task-row task-drag-preview task-${task.status} ${getTaskIndicatorClass(task, status)}`}>
      <div className="task-row-content">
        <div aria-hidden="true" className="task-drag-handle task-drag-handle-preview">
          <GripVertical size={15} />
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
        <button
          aria-label={`Переместить задачу: ${task.title}`}
          className="task-drag-handle"
          title="Переместить"
          type="button"
          {...listeners}
          {...attributes}>
          <GripVertical size={15} />
        </button>
        {children}
      </div>
    </article>
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
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const [isNoteCategoryOpen, setIsNoteCategoryOpen] = useState(false);
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
  const submitQuickNote = (event) => {
    event.preventDefault();
    const title = noteText.trim();

    if (!title) return;

    onAddNote({title, category: noteCategory});
    setNoteText("");
    setIsNoteCategoryOpen(false);
  };

  useEffect(() => {
    setOpenItemMenuId(null);
    setIsNoteCategoryOpen(false);
  }, [activeMode, mobileSection]);

  useEffect(() => {
    if (!alertFocus?.entityId) {
      return undefined;
    }

    const setupTimer = window.setTimeout(() => {
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
              <button
                className={mobileSection === "tasks" ? "active" : ""}
                type="button"
                onClick={() => setMobileSection("tasks")}>
                Задачи
              </button>
              <button
                className={mobileSection === "supplies" ? "active" : ""}
                type="button"
                onClick={() => setMobileSection("supplies")}>
                Склад
              </button>
              <button
                className={mobileSection === "waitlist" ? "active" : ""}
                type="button"
                onClick={() => setMobileSection("waitlist")}>
                Лист ожидания
              </button>
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
              <ClipboardCheck size={18} />
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
                <button
                  className={activeMode === "tasks" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveMode("tasks")}>
                  Задачи
                </button>
                <button
                  className={activeMode === "notes" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveMode("notes")}>
                  Заметки
                </button>
              </div>
              {activeMode === "tasks" && (
                <button
                  className="add-visit-button"
                  type="button"
                  onClick={onAddTask}>
                  <Plus size={16} />
                  Добавить
                </button>
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
              <div className="operations-list">
                {sortedWorkTasks.map((task) => {
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
                        <button
                          aria-label="Завершить задачу"
                          className="task-check"
                          disabled={task.status === "completed"}
                          title="Завершить"
                          type="button"
                          onClick={() => onCompleteTask(task)}>
                          {task.status === "completed" && <Check size={14} />}
                        </button>
                        <div className="operations-card-body">
                          <strong>{task.title}</strong>
                          <span>{task.note || "Без комментария"}</span>
                        </div>
                        <RowActionsMenu
                          className="operations-row-actions"
                          itemId={task.id}
                          openMenuId={openItemMenuId}
                          setOpenMenuId={setOpenItemMenuId}
                          onDelete={() => onDeleteTask(task)}
                          onEdit={() => onEditTask(task)}
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
                {workTasks.length === 0 && (
                  <p className="operations-empty">Задач пока нет.</p>
                )}
              </div>
              <DragOverlay dropAnimation={{duration: 180, easing: "ease"}}>
                {draggedTask ? <TaskDragPreview task={draggedTask} /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="operations-notes">
              <form className="quick-note-form" onSubmit={submitQuickNote}>
                <StickyNote size={16} />
                <input
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
                  <button
                    aria-expanded={isNoteCategoryOpen}
                    className="quick-note-category-trigger"
                    type="button"
                    onClick={() => setIsNoteCategoryOpen((isOpen) => !isOpen)}>
                    {noteCategory}
                    <ChevronDown size={14} />
                  </button>
                  {isNoteCategoryOpen && (
                    <div className="quick-note-category-menu" role="listbox">
                      {NOTE_CATEGORIES.map((category) => (
                        <button
                          aria-selected={noteCategory === category}
                          className={
                            noteCategory === category ? "is-selected" : ""
                          }
                          key={category}
                          role="option"
                          type="button"
                          onClick={() => {
                            setNoteCategory(category);
                            setIsNoteCategoryOpen(false);
                          }}>
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="add-visit-button" type="submit">
                  <Plus size={15} />
                  Записать
                </button>
              </form>
              <div className="operations-list notes-list">
                {notes.map((note) => (
                  <article className="note-row" key={note.id}>
                    <div className="operations-card-head">
                      <span
                        className={`operations-card-icon note-card-icon ${getNoteIconClass(note.priority)}`}>
                        {note.priority === "Идея" ? (
                          <Lightbulb size={15} />
                        ) : (
                          <StickyNote size={15} />
                        )}
                      </span>
                      <div className="operations-card-body">
                        <strong>{note.title}</strong>
                      </div>
                      <RowActionsMenu
                        className="operations-row-actions"
                        itemId={note.id}
                        openMenuId={openItemMenuId}
                        setOpenMenuId={setOpenItemMenuId}
                        onDelete={() => onDeleteTask(note)}
                        onEdit={() => onEditTask(note)}
                      />
                    </div>
                    <div className="note-meta">
                      <span className="note-meta-item">
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
              <PackagePlus size={18} />
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
            <button
              className="add-visit-button"
              type="button"
              onClick={onAddSupply}>
              <Plus size={16} />
              Добавить
            </button>
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
                      <PackagePlus size={15} />
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
                    <button
                      className="supply-order-button"
                      disabled={!item.orderUrl}
                      title={
                        item.orderUrl
                          ? "Открыть ссылку на заказ"
                          : "Укажите ссылку в редактировании"
                      }
                      type="button"
                      onClick={() => openSupplyOrderUrl(item.orderUrl)}>
                      <ExternalLink size={13} />
                      Заказать
                    </button>
                    <button
                      aria-label="Уменьшить остаток"
                      type="button"
                      onClick={() => onChangeSupplyStock(item, -1)}>
                      −
                    </button>
                    <button
                      aria-label="Увеличить остаток"
                      type="button"
                      onClick={() => onChangeSupplyStock(item, 1)}>
                      +
                    </button>
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
    </section>
  );
}

export default OperationsPage;
