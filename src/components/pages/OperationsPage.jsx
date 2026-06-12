import {
  Check,
  ClipboardCheck,
  ExternalLink,
  GripVertical,
  Lightbulb,
  PackagePlus,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import PageHeader from "../PageHeader.jsx";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {useMemo, useState, useEffect} from "react";
import {getTodayInput} from "../../utils/dateHelpers.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {
  getSupplyStockStatus,
  getSupplyStockStatusLabel,
  isSupplyLowStock,
} from "../../utils/supplyStock.js";
import {openSupplyOrderUrl} from "../../utils/supplyOrder.js";

const getTaskStatusLabel = (task) => {
  if (task.status === "completed") return "Готово";
  if (task.dueDate && task.dueDate < getTodayInput())
    return "Просрочено";
  return "В работе";
};

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
    </article>
  );
}

function OperationsPage({
  alertFocus,
  tasks,
  supplies,
  onAddTask,
  onAddNote,
  onAlertFocusHandled,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
  onReorderTasks,
  onAddSupply,
  onEditSupply,
  onDeleteSupply,
  onChangeSupplyStock,
}) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [activeMode, setActiveMode] = useState("tasks");
  const [mobileSection, setMobileSection] = useState("tasks");
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
  );
  const notes = tasks.filter((task) => task.type === "note");
  const workTasks = tasks.filter((task) => task.type !== "note");
  const activeTasks = workTasks.filter((task) => task.status !== "completed");
  const completedTasks = workTasks.filter((task) => task.status === "completed");
  const lowStockCount = supplies.filter(isSupplyLowStock).length;
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
  };

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

  return (
    <section className="operations-page">
      <PageHeader
        description="Рабочие дела, закупки и остатки расходников"
        title="Операции">
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
        </div>
        <div className="operations-summary">
          <span>
            <b>{activeTasks.length}</b> задач
          </span>
          <span>
            <b>{notes.length}</b> заметок
          </span>
          <span className={lowStockCount > 0 ? "operations-summary-alert" : ""}>
            <b>{lowStockCount}</b> нужно пополнить
          </span>
        </div>
      </PageHeader>

      <div className="operations-grid">
        <section
          className={`panel operations-panel operations-panel-tasks ${
            mobileSection === "supplies" ? "operations-panel-hidden-mobile" : ""
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
              autoScroll={false}
              collisionDetection={closestCenter}
              sensors={sensors}
              onDragCancel={() => setDraggedTask(null)}
              onDragStart={({active}) =>
                setDraggedTask(active.data.current?.task ?? null)
              }
              onDragEnd={({active, over}) => {
                const draggedTaskId = active.data.current?.task.id;
                const targetTaskId = over?.data.current?.task.id;

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
                {workTasks.map((task) => {
                  const status = getTaskStatusLabel(task);
                  return (
                    <DraggableTaskRow
                      className={`task-row task-${task.status} ${status === "Просрочено" ? "task-overdue" : ""} ${isFocused(task.id) ? "alert-focus-pulse" : ""}`}
                      id={`alert-focus-${task.id}`}
                      key={task.id}
                      task={task}>
                      <button
                        aria-label="Завершить задачу"
                        className="task-check"
                        disabled={task.status === "completed"}
                        title="Завершить"
                        type="button"
                        onClick={() => onCompleteTask(task)}>
                        {task.status === "completed" && <Check size={14} />}
                      </button>
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.note || "Без комментария"}</span>
                      </div>
                      <div className="task-meta">
                        <b className={`task-priority priority-${task.priority}`}>
                          {task.priority}
                        </b>
                        <small>{task.dueDate || "Без срока"}</small>
                        <em>{status}</em>
                      </div>
                      <div className="employee-actions">
                        <button
                          aria-label="Редактировать задачу"
                          className="compact-icon-button"
                          title="Редактировать"
                          type="button"
                          onClick={() => onEditTask(task)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label="Удалить задачу"
                          className="compact-icon-button danger"
                          title="Удалить"
                          type="button"
                          onClick={() => onDeleteTask(task)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </DraggableTaskRow>
                  );
                })}
                {workTasks.length === 0 && (
                  <p className="operations-empty">Задач пока нет.</p>
                )}
              </div>
              <DragOverlay>
                {draggedTask && (
                  <div className="task-drag-overlay">
                    <GripVertical size={15} />
                    <strong>{draggedTask.title}</strong>
                  </div>
                )}
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
                <select
                  value={noteCategory}
                  onChange={(event) => setNoteCategory(event.target.value)}>
                  <option>Мысль</option>
                  <option>Заказать</option>
                  <option>Идея</option>
                  <option>Личное</option>
                </select>
                <button className="add-visit-button" type="submit">
                  <Plus size={15} />
                  Записать
                </button>
              </form>
              <div className="operations-list notes-list">
                {notes.map((note) => (
                  <article className="note-row" key={note.id}>
                    <span>
                      {note.priority === "Идея" ? (
                        <Lightbulb size={15} />
                      ) : (
                        <StickyNote size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{note.title}</strong>
                      <small>{note.note || note.priority || "Заметка"}</small>
                    </div>
                    <div className="employee-actions">
                      <button
                        aria-label="Редактировать заметку"
                        className="compact-icon-button"
                        title="Редактировать"
                        type="button"
                        onClick={() => onEditTask(note)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="Удалить заметку"
                        className="compact-icon-button danger"
                        title="Удалить"
                        type="button"
                        onClick={() => onDeleteTask(note)}>
                        <Trash2 size={15} />
                      </button>
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
            mobileSection === "tasks" ? "operations-panel-hidden-mobile" : ""
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
                  className={`supply-row ${rowClassName} ${isFocused(item.id) ? "alert-focus-pulse" : ""}`}
                  id={`alert-focus-${item.id}`}
                  key={item.id}>
                  <div>
                    <div className="supply-row-title">
                      <strong>{item.name}</strong>
                      {stockBadge ? (
                        <span className="supply-stock-badge">{stockBadge}</span>
                      ) : null}
                    </div>
                    <span>{item.note || "Расходный материал"}</span>
                  </div>
                  <div className="supply-stock">
                    <small>Остаток</small>
                    <strong>
                      {item.stock} {item.unit}
                    </strong>
                    <span>минимум {item.minStock}</span>
                  </div>
                  <div className="supply-cost">
                    <small>Стоимость</small>
                    <strong>{formatMoney(item.cost)}</strong>
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
                      type="button"
                      onClick={() => onChangeSupplyStock(item, -1)}>
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeSupplyStock(item, 1)}>
                      +
                    </button>
                    <button
                      aria-label="Редактировать расходник"
                      className="compact-icon-button"
                      title="Редактировать"
                      type="button"
                      onClick={() => onEditSupply(item)}>
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Удалить расходник"
                      className="compact-icon-button danger"
                      title="Удалить"
                      type="button"
                      onClick={() => onDeleteSupply(item)}>
                      <Trash2 size={15} />
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
      </div>
    </section>
  );
}

export default OperationsPage;
