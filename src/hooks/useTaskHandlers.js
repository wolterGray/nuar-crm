import {useCallback} from "react";
import {reorderWorkTasksByDrop} from "../utils/taskSort.js";

export function useTaskHandlers({
  createLocalId,
  editingTask,
  pushNotification,
  requestEntityDelete,
  setEditingTask,
  setTaskModalOpen,
  setTasks,
}) {
  const openCreateTask = useCallback(() => {
    setEditingTask(null);
    setTaskModalOpen(true);
  }, [setEditingTask, setTaskModalOpen]);

  const openEditTask = useCallback(
    (task) => {
      setEditingTask(task);
      setTaskModalOpen(true);
    },
    [setEditingTask, setTaskModalOpen],
  );

  const handleTaskSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const type = editingTask?.type === "note" ? "note" : "task";

      if (!title) {
        return;
      }

      const task = {
        id: editingTask?.id ?? createLocalId(),
        type,
        title,
        dueDate: form.get("dueDate") || "",
        priority: form.get("priority") || "Средний",
        note: String(form.get("note") ?? "").trim(),
        status: editingTask?.status ?? "active",
        createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      };

      setTasks((current) =>
        editingTask
          ? current.map((item) => (item.id === task.id ? task : item))
          : [task, ...current],
      );
      setTaskModalOpen(false);
      setEditingTask(null);
      pushNotification({
        title: type === "note" ? "Заметка сохранена" : "Задача сохранена",
        message: task.title,
      });
    },
    [
      createLocalId,
      editingTask,
      pushNotification,
      setEditingTask,
      setTaskModalOpen,
      setTasks,
    ],
  );

  const addQuickNote = useCallback(
    ({title, category}) => {
      const note = {
        id: createLocalId(),
        type: "note",
        title,
        dueDate: "",
        priority: category || "Мысль",
        note: "",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      setTasks((current) => [note, ...current]);
      pushNotification({title: "Заметка добавлена", message: note.title});
    },
    [createLocalId, pushNotification, setTasks],
  );

  const completeTask = useCallback(
    (task) => {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? {...item, status: "completed"} : item,
        ),
      );
      pushNotification({title: "Задача выполнена", message: task.title});
    },
    [pushNotification, setTasks],
  );

  const reorderTasks = useCallback(
    (draggedTaskId, targetTaskId) => {
      setTasks((current) => {
        const notes = current.filter((item) => item.type === "note");
        const work = current.filter((item) => item.type !== "note");
        const reordered = reorderWorkTasksByDrop(
          work,
          draggedTaskId,
          targetTaskId,
        );

        if (reordered === work) {
          return current;
        }

        return [...reordered, ...notes];
      });
    },
    [setTasks],
  );

  const requestDeleteTask = useCallback(
    (task) => {
      requestEntityDelete("task", task);
    },
    [requestEntityDelete],
  );

  const performDeleteTask = useCallback(
    (task) => {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      pushNotification({
        title: task.type === "note" ? "Заметка удалена" : "Задача удалена",
        message: task.title,
      });
    },
    [pushNotification, setTasks],
  );

  return {
    addQuickNote,
    completeTask,
    handleTaskSubmit,
    openCreateTask,
    openEditTask,
    performDeleteTask,
    reorderTasks,
    requestDeleteTask,
  };
}
