import {
  Check,
  ClipboardCheck,
  GripVertical,
  Lightbulb,
  PackagePlus,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
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
import {useState} from "react";
import {getTodayInput} from "../../utils/dateHelpers.js";
import {formatMoney} from "../../utils/formatters.jsx";

const getTaskStatusLabel = (task) => {
  if (task.status === "completed") return "Готово";
  if (task.dueDate && task.dueDate < getTodayInput())
    return "Просрочено";
  return "В работе";
};

function DraggableTaskRow({children, className, task}) {
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
  tasks,
  supplies,
  onAddTask,
  onAddNote,
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
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("Мысль");
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
  );
  const notes = tasks.filter((task) => task.type === "note");
  const workTasks = tasks.filter((task) => task.type !== "note");
  const activeTasks = workTasks.filter((task) => task.status !== "completed");
  const completedTasks = workTasks.filter((task) => task.status === "completed");
  const lowStockCount = supplies.filter(
    (item) => Number(item.stock) <= Number(item.minStock),
  ).length;
  const submitQuickNote = (event) => {
    event.preventDefault();
    const title = noteText.trim();

    if (!title) return;

    onAddNote({title, category: noteCategory});
    setNoteText("");
  };

  return (
    <section className="operations-page">
      <div className="employees-toolbar">
        <div className="title-notifications-flex">
          <div>
            <h2>Задачи и склад</h2>
            <p>Рабочие дела, закупки и остатки расходников</p>
          </div>
          <PageNotificationsSlot />
        </div>
        <div className="operations-summary">
          <span>
            <b>{activeTasks.length}</b> задач
          </span>
          <span>
            <b>{notes.length}</b> заметок
          </span>
          <span>
            <b>{lowStockCount}</b> нужно пополнить
          </span>
        </div>
      </div>

      <div className="operations-grid">
        <section className="panel operations-panel">
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
                      className={`task-row task-${task.status} ${status === "Просрочено" ? "task-overdue" : ""}`}
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

        <section className="panel operations-panel">
          <div className="operations-panel-header">
            <div>
              <PackagePlus size={18} />
              <div>
                <h2>Расходники</h2>
                <p>{supplies.length} позиций на складе</p>
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
            {supplies.map((item) => {
              const lowStock = Number(item.stock) <= Number(item.minStock);
              return (
                <article
                  className={`supply-row ${lowStock ? "supply-low" : ""}`}
                  key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
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
