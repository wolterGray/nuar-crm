import {useCallback} from "react";
import {
  createTask,
  deleteTask,
  updateTask,
} from "../api/tasks.js";
import {
  buildMovedTask,
  getChecklistProgress,
  getTaskAssigneeId,
  getTaskDueDate,
  getTaskPayload,
  getTaskPriorityLabel,
  isTaskCompleted,
  normalizeInputDate,
  patchOccurrence,
} from "../utils/operationsPlanner.js";
import {reorderWorkTasksByDrop} from "../utils/taskSort.js";

const parseJsonField = (value, fallback) => {
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeChecklist = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      done: item?.done === true,
      id: String(item?.id ?? `item-${index}`),
      text: String(item?.text ?? "").trim(),
    }))
    .filter((item) => item.text);

const getEmployeeName = (employees, id) =>
  employees.find((employee) => String(employee.id) === String(id))?.name ?? "";

const getTaskStorageId = (task) => task?.baseId ?? task?.id;

export function useTaskHandlers({
  employees = [],
  editingTask,
  pushNotification,
  requestEntityDelete,
  setEditingTask,
  setTaskModalOpen,
  setTasks,
}) {
  const openCreateTask = useCallback((type = "task") => {
    const nextType = type === "note" ? "note" : "task";

    setEditingTask(nextType === "note" ? {type: "note"} : null);
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
      const type =
        form.get("type") === "note" || editingTask?.type === "note"
          ? "note"
          : "task";
      const storageTaskId = getTaskStorageId(editingTask);
      const isEditingExisting = Boolean(storageTaskId);

      if (!title) {
        return;
      }

      let savedTask;
      const task = {
        ...(storageTaskId ? {id: storageTaskId} : {}),
        type,
        title,
        dueDate: "",
        priority: form.get("priority") || "Средний",
        note: String(form.get("note") ?? "").trim(),
        status: editingTask?.status ?? "active",
        createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      };
      if (type !== "note") {
        const dueDate = String(form.get("dueDate") ?? "").trim();
        const hasTime = form.get("hasTime") === "on";
        const dueTime = hasTime ? String(form.get("dueTime") ?? "").trim() : "";
        const estimateMinutes = Math.max(0, Number(form.get("estimateMinutes")) || 0);
        const priorityId = String(form.get("priorityId") ?? "medium");
        const assigneeId = String(form.get("assigneeId") ?? "").trim();
        const checklist = normalizeChecklist(parseJsonField(form.get("checklistJson"), []));
        const repeat = parseJsonField(form.get("repeatJson"), {enabled: false});
        const repeatEnabled = form.get("repeatEnabled") === "on";
        const repeatFrequency = String(repeat.frequency ?? "daily");
        const repeatStartDate = String(form.get("repeatStartDate") ?? repeat.startDate ?? dueDate).trim();
        const repeatWeekdays = Array.isArray(repeat.weekdays) ? repeat.weekdays.map(Number) : [];

        if (repeatEnabled && !repeatStartDate) {
          pushNotification({
            title: "Повторение не сохранено",
            message: "Укажите дату начала серии.",
            tone: "urgent",
          });
          return;
        }
        if (repeatEnabled && repeatFrequency !== "daily" && repeatWeekdays.length === 0) {
          pushNotification({
            title: "Повторение не сохранено",
            message: "Выберите хотя бы один день недели.",
            tone: "urgent",
          });
          return;
        }

        const payload = {
          ...getTaskPayload(editingTask),
          assigneeId,
          assigneeName: getEmployeeName(employees, assigneeId),
          checklist,
          dueDate,
          dueTime,
          estimateMinutes,
          isMain: form.get("isMain") === "on",
          mainDate: dueDate,
          outcome: String(form.get("outcome") ?? "").trim(),
          priorityId,
          repeat: {
            ...repeat,
            enabled: repeatEnabled,
            endDate: String(form.get("repeatEndDate") ?? repeat.endDate ?? "").trim(),
            frequency: repeatFrequency,
            intervalWeeks: Math.max(1, Number(form.get("repeatIntervalWeeks") ?? repeat.intervalWeeks) || 1),
            startDate: repeatStartDate,
            weekdays: repeatWeekdays,
          },
          taskKind: String(form.get("taskKind") ?? "daily"),
        };

        task.description = task.note;
        task.dueDate = dueDate;
        task.priority = getTaskPriorityLabel({priority: priorityId, payload});
        task.status = String(form.get("status") ?? editingTask?.status ?? "active");
        task.completed = task.status === "completed";
        task.payload = payload;

        if (editingTask?.isVirtualOccurrence && form.get("applyScope") !== "future") {
          const date = String(form.get("occurrenceDate") ?? editingTask.occurrenceDate ?? "").trim();
          const baseId = Number(form.get("baseId") || editingTask.baseId);
          let nextTask = patchOccurrence(editingTask, date, {
            checklist,
            dueTime,
            estimateMinutes,
            isMain: payload.isMain,
            note: task.note,
            status: task.status,
            title,
          });
          const nextPayload = getTaskPayload(nextTask);
          nextTask = {
            ...nextTask,
            payload: {
              ...nextPayload,
              isMain: payload.isMain,
              mainDate: payload.isMain ? date : nextPayload.mainDate === date ? "" : nextPayload.mainDate,
            },
          };
          try {
            const response = await updateTask(baseId, {...nextTask, id: baseId});
            savedTask = response?.data ?? {...nextTask, id: baseId};
          } catch (error) {
            pushNotification({
              title: "Задача не сохранена",
              message: error?.message || "Backend не принял изменения",
              persist: false,
            });
            return;
          }

          setTasks((current) =>
            current.map((item) => (String(item.id) === String(baseId) ? savedTask : item)),
          );
          setTaskModalOpen(false);
          setEditingTask(null);
          pushNotification({title: "Задача сохранена", message: savedTask.title});
          return;
        }
      }
      try {
        const response = isEditingExisting
          ? await updateTask(storageTaskId, task)
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
        isEditingExisting
          ? current.map((item) => (String(item.id) === String(savedTask.id) ? savedTask : item))
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
      employees,
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
      const isCompleted = isTaskCompleted(task);
      const checklist = getChecklistProgress(task);
      if (!isCompleted && checklist.total > 0 && checklist.done < checklist.total) {
        const confirmed = window.confirm("В чек-листе есть незакрытые пункты. Завершить задачу?");
        if (!confirmed) return;
      }

      const nextStatus = isCompleted ? "active" : "completed";
      const nextTask = task.isVirtualOccurrence
        ? patchOccurrence(task, task.occurrenceDate, {
            completedAt: nextStatus === "completed" ? new Date().toISOString() : "",
            status: nextStatus,
          })
        : {...task, completed: nextStatus === "completed", status: nextStatus};
      const storageTaskId = getTaskStorageId(task);
      let savedTask;
      try {
        const response = await updateTask(storageTaskId, nextTask);
        savedTask = response?.data ?? nextTask;
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
          String(item.id) === String(storageTaskId) ? savedTask : item,
        ),
      );
      pushNotification({
        title: isCompleted ? "Задача возвращена" : "Задача выполнена",
        message: task.title,
      });
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
      if (task?.isVirtualOccurrence) {
        const nextTask = patchOccurrence(task, task.occurrenceDate, {status: "cancelled"});
        let savedTask;
        try {
          const response = await updateTask(task.baseId, nextTask);
          savedTask = response?.data ?? nextTask;
        } catch (error) {
          pushNotification({
            title: "Задача не удалена",
            message: error?.message || "Backend не удалил повторение",
            persist: false,
          });
          return;
        }

        setTasks((current) =>
          current.map((item) =>
            String(item.id) === String(task.baseId) ? savedTask : item,
          ),
        );
        pushNotification({title: "Повторение удалено", message: task.title});
        return;
      }

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

  const setMainTask = useCallback(
    async (task, date = getTaskDueDate(task)) => {
      if (!date) {
        pushNotification({
          title: "Главная задача не назначена",
          message: "У задачи должна быть дата.",
          persist: false,
        });
        return;
      }

      const assigneeId = getTaskAssigneeId(task);
      const patchedTask = task.isVirtualOccurrence
        ? patchOccurrence(task, date, {isMain: true})
        : {
            ...task,
            payload: {
              ...getTaskPayload(task),
              isMain: true,
              mainDate: date,
            },
          };
      const nextTask = task.isVirtualOccurrence
        ? {
            ...patchedTask,
            payload: {
              ...getTaskPayload(patchedTask),
              isMain: true,
              mainDate: date,
            },
          }
        : patchedTask;
      const storageTaskId = getTaskStorageId(task);
      let savedTask;

      try {
        const response = await updateTask(storageTaskId, nextTask);
        savedTask = response?.data ?? nextTask;
      } catch (error) {
        pushNotification({
          title: "Главная задача не сохранена",
          message: error?.message || "Backend не принял изменение",
          persist: false,
        });
        return;
      }

      setTasks((current) =>
        current.map((item) => {
          const payload = getTaskPayload(item);
          const sameDate = payload.mainDate === date;
          const sameAssignee = String(payload.assigneeId ?? "") === String(assigneeId ?? "");
          if (sameDate && sameAssignee && String(item.id) !== String(task.baseId ?? task.id)) {
            return {...item, payload: {...payload, isMain: false}};
          }
          if (String(item.id) === String(storageTaskId)) {
            return savedTask;
          }
          return item;
        }),
      );
      pushNotification({title: "Главная задача дня назначена", message: task.title});
    },
    [pushNotification, setTasks],
  );

  const moveTaskToDate = useCallback(
    async (task, nextDate) => {
      const date = normalizeInputDate(nextDate);
      if (!date) {
        pushNotification({
          title: "Задача не перенесена",
          message: "Укажите дату в формате YYYY-MM-DD.",
          persist: false,
        });
        return;
      }

      const nextTask = buildMovedTask(task, date);
      const storageTaskId = getTaskStorageId(task);
      let savedTask;
      try {
        const response = await updateTask(storageTaskId, nextTask);
        savedTask = response?.data ?? nextTask;
      } catch (error) {
        pushNotification({
          title: "Задача не перенесена",
          message: error?.message || "Backend не принял новую дату",
          persist: false,
        });
        return;
      }

      setTasks((current) =>
        current.map((item) =>
          String(item.id) === String(storageTaskId) ? savedTask : item,
        ),
      );
      pushNotification({title: "Задача перенесена", message: `${task.title} → ${date}`});
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
    moveTaskToDate,
    setMainTask,
  };
}
