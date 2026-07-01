import {useCallback} from "react";
import {
  createTask,
  deleteTask,
  updateTask,
} from "../api/tasks.js";
import {reorderWorkTasksByDrop} from "../utils/taskSort.js";

export function useTaskHandlers({
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
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const type = editingTask?.type === "note" ? "note" : "task";

      if (!title) {
        return;
      }

      const task = {
        ...(editingTask?.id ? {id: editingTask.id} : {}),
        type,
        title,
        dueDate: form.get("dueDate") || "",
        priority: form.get("priority") || "Средний",
        note: String(form.get("note") ?? "").trim(),
        status: editingTask?.status ?? "active",
        createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      };
      let savedTask;

      try {
        const response = editingTask
          ? await updateTask(editingTask.id, task)
          : await createTask(task);
        savedTask = response?.data ?? task;
      } catch (error) {
        pushNotification({
          title: type === "note" ? "Заметка не сохранена" : "Задача не сохранена",
          message: error?.message || "Backend не принял изменения",
          persist: false,
        });
        return;
      }

      setTasks((current) =>
        editingTask
          ? current.map((item) => (item.id === savedTask.id ? savedTask : item))
          : [savedTask, ...current],
      );
      setTaskModalOpen(false);
      setEditingTask(null);
      pushNotification({
        title: type === "note" ? "Заметка сохранена" : "Задача сохранена",
        message: savedTask.title,
      });
    },
    [
      editingTask,
      pushNotification,
      setEditingTask,
      setTaskModalOpen,
      setTasks,
    ],
  );

  const addQuickNote = useCallback(
    async ({title, category}) => {
      const note = {
        type: "note",
        title,
        dueDate: "",
        priority: category || "Мысль",
        note: "",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      let savedNote;

      try {
        const response = await createTask(note);
        savedNote = response?.data ?? note;
      } catch (error) {
        pushNotification({
          title: "Заметка не добавлена",
          message: error?.message || "Backend не принял заметку",
          persist: false,
        });
        return;
      }

      setTasks((current) => [savedNote, ...current]);
      pushNotification({title: "Заметка добавлена", message: savedNote.title});
    },
    [pushNotification, setTasks],
  );

  const completeTask = useCallback(
    async (task) => {
      const nextTask = {...task, status: "completed"};
      try {
        await updateTask(task.id, nextTask);
      } catch (error) {
        pushNotification({
          title: "Задача не обновлена",
          message: error?.message || "Backend не принял статус",
          persist: false,
        });
        return;
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? nextTask : item,
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

        const nextTasks = [
          ...reordered.map((task, index) => ({...task, sortOrder: index})),
          ...notes,
        ];
        Promise.all(
          nextTasks
            .filter((task) => task.type !== "note")
            .map((task) => updateTask(task.id, task)),
        ).catch((error) => {
          pushNotification({
            title: "Порядок задач не сохранён",
            message: error?.message || "Backend не принял порядок",
            persist: false,
          });
        });

        return nextTasks;
      });
    },
    [pushNotification, setTasks],
  );

  const requestDeleteTask = useCallback(
    (task) => {
      requestEntityDelete("task", task);
    },
    [requestEntityDelete],
  );

  const performDeleteTask = useCallback(
    async (task) => {
      try {
        await deleteTask(task.id);
      } catch (error) {
        pushNotification({
          title: task.type === "note" ? "Заметка не удалена" : "Задача не удалена",
          message: error?.message || "Backend не удалил запись",
          persist: false,
        });
        return;
      }

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
