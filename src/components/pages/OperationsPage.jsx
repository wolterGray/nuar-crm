import {
  Check,
  ClipboardCheck,
  GripVertical,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import {formatMoney} from "../../utils/formatters.jsx";

const getTaskStatusLabel = (task) => {
  if (task.status === "completed") return "Готово";
  if (task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)) return "Просрочено";
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
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
  );
  const activeTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const lowStockCount = supplies.filter(
    (item) => Number(item.stock) <= Number(item.minStock),
  ).length;

  return (
    <section className="operations-page">
      <div className="employees-toolbar">
        <div>
          <h2>Задачи и склад</h2>
          <p>Рабочие дела, закупки и остатки расходников</p>
        </div>
        <div className="operations-summary">
          <span><b>{activeTasks.length}</b> задач</span>
          <span><b>{lowStockCount}</b> нужно пополнить</span>
        </div>
      </div>

      <div className="operations-grid">
        <section className="panel operations-panel">
          <div className="operations-panel-header">
            <div>
              <ClipboardCheck size={18} />
              <div>
                <h2>Задачи</h2>
                <p>{completedTasks.length} выполнено</p>
              </div>
            </div>
            <button className="add-visit-button" type="button" onClick={onAddTask}>
              <Plus size={16} />
              Добавить
            </button>
          </div>
          <DndContext
            autoScroll={false}
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragCancel={() => setDraggedTask(null)}
            onDragStart={({active}) => setDraggedTask(active.data.current?.task ?? null)}
            onDragEnd={({active, over}) => {
              const draggedTaskId = active.data.current?.task.id;
              const targetTaskId = over?.data.current?.task.id;

              if (draggedTaskId && targetTaskId && draggedTaskId !== targetTaskId) {
                onReorderTasks(draggedTaskId, targetTaskId);
              }

              setDraggedTask(null);
            }}>
            <div className="operations-list">
              {tasks.map((task) => {
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
                    <b className={`task-priority priority-${task.priority}`}>{task.priority}</b>
                    <small>{task.dueDate || "Без срока"}</small>
                    <em>{status}</em>
                  </div>
                  <div className="employee-actions">
                    <button aria-label="Редактировать задачу" className="compact-icon-button" title="Редактировать" type="button" onClick={() => onEditTask(task)}>
                      <Pencil size={15} />
                    </button>
                    <button aria-label="Удалить задачу" className="compact-icon-button danger" title="Удалить" type="button" onClick={() => onDeleteTask(task)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  </DraggableTaskRow>
                );
              })}
              {tasks.length === 0 && <p className="operations-empty">Задач пока нет.</p>}
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
            <button className="add-visit-button" type="button" onClick={onAddSupply}>
              <Plus size={16} />
              Добавить
            </button>
          </div>
          <div className="operations-list">
            {supplies.map((item) => {
              const lowStock = Number(item.stock) <= Number(item.minStock);
              return (
                <article className={`supply-row ${lowStock ? "supply-low" : ""}`} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.note || "Расходный материал"}</span>
                  </div>
                  <div className="supply-stock">
                    <small>Остаток</small>
                    <strong>{item.stock} {item.unit}</strong>
                    <span>минимум {item.minStock}</span>
                  </div>
                  <div className="supply-cost">
                    <small>Стоимость</small>
                    <strong>{formatMoney(item.cost)}</strong>
                  </div>
                  <div className="supply-actions">
                    <button type="button" onClick={() => onChangeSupplyStock(item, -1)}>−</button>
                    <button type="button" onClick={() => onChangeSupplyStock(item, 1)}>+</button>
                    <button aria-label="Редактировать расходник" className="compact-icon-button" title="Редактировать" type="button" onClick={() => onEditSupply(item)}>
                      <Pencil size={15} />
                    </button>
                    <button aria-label="Удалить расходник" className="compact-icon-button danger" title="Удалить" type="button" onClick={() => onDeleteSupply(item)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
            {supplies.length === 0 && <p className="operations-empty">Добавьте первый расходник.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}

export default OperationsPage;
