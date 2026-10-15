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
  getTaskResultFields,
  getWarsawTodayInput,
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

const ACQUISITION_TASK_TEMPLATES = [
  {
    aliases: ["Контроль рекламы Meta"],
    key: "acquisition-meta-control",
    title: "Контроль рекламы Meta",
    note: "Проверьте рекламные кампании и сопоставьте обращения с реальными записями.",
    instructions: "Откройте Ads Manager, выберите вчерашний день, проверьте активные кампании и внесите фактические показатели. Сопоставьте обращения с записями в CRM, затем сформулируйте короткий вывод.",
    checklist: ["Проверить активные кампании", "Проверить рекламные расходы", "Посмотреть новые обращения", "Оценить стоимость обращения", "Сопоставить обращения с записями", "Сохранить показатели"],
    resultFields: [
      {id: "statsDate", label: "Дата рекламной статистики", required: true, type: "date"},
      {id: "adSpend", label: "Расходы на рекламу", required: true, type: "number", unit: "zł"},
      {id: "leads", label: "Новые обращения", required: true, type: "number"},
      {id: "bookings", label: "Записи из рекламы", required: true, type: "number"},
    ],
  },
  {
    aliases: ["Контроль каналов привлечения", "Проверка Booksy и Google"],
    key: "acquisition-channel-control",
    title: "Проверка Booksy и Google",
    note: "Проверьте доступность основных каналов записи и свободные окна на три дня вперёд.",
    instructions: "Проверьте, что профили открываются, услуги и цены актуальны, кнопки записи работают, а клиент видит реальные свободные часы. Все обнаруженные проблемы запишите в результат.",
    checklist: ["Проверить Booksy", "Проверить Google Business Profile", "Проверить доступность онлайн-записи", "Проверить свободные окна мастеров на ближайшие три дня", "Зафиксировать обнаруженные проблемы"],
    resultFields: [
      {id: "checkResult", label: "Результат проверки", required: true, type: "textarea"},
      {id: "issues", label: "Обнаруженные проблемы", type: "textarea"},
      {id: "requiredActions", label: "Необходимые действия", type: "textarea"},
    ],
  },
  {
    aliases: ["Поиск новых клиентов и партнёров", "Поиск новых каналов привлечения"],
    key: "acquisition-partners",
    title: "Поиск новых каналов привлечения",
    note: "Системный поиск партнёров, площадок и новых способов привлечения клиентов.",
    instructions: "Пн: изучите предложения конкурентов. Вт: найдите потенциальных партнёров. Ср: отправьте предложения. Чт: изучите новые площадки. Пт: проверьте ответы и назначьте следующие действия.",
    checklist: ["Выполнить действие текущего дня", "Сохранить названия или ссылки", "Зафиксировать отправленные предложения", "Проверить ответы", "Определить следующее действие"],
    resultFields: [
      {id: "contacts", label: "Найдено контактов", type: "number"},
      {id: "offers", label: "Отправлено предложений", type: "number"},
      {id: "replies", label: "Получено ответов", type: "number"},
      {id: "partners", label: "Названия или ссылки на партнёров", required: true, type: "textarea"},
      {id: "nextAction", label: "Следующее действие", type: "text"},
    ],
  },
  {
    aliases: ["Учёт результатов привлечения", "Учет результатов привлечения"],
    key: "acquisition-results-accounting",
    title: "Учёт результатов привлечения",
    note: "Сведите показатели каналов привлечения и зафиксируйте итог дня.",
    instructions: "Соберите фактические обращения и записи из доступных каналов. Не оценивайте приблизительно: если показатель неизвестен, оставьте поле пустым и укажите причину в комментарии.",
    checklist: ["Собрать обращения по каналам", "Сверить обращения с созданными записями", "Проверить источник каждой записи", "Зафиксировать итоговые показатели", "Записать вывод и следующее действие"],
    resultFields: [{id: "summaryNote", label: "Вывод по результатам привлечения", type: "textarea"}],
    resultSource: "acquisitionSummary",
  },
  {
    aliases: ["01. Аналитика и оптимизация таргета Meta"],
    key: "marketing-monday-meta-analytics",
    title: "01. Аналитика и оптимизация таргета Meta",
    note: "Еженедельный контроль рекламного кабинета Ads Manager, отслеживание выгорания креативов и удержание плановой стоимости лида в Варшаве.",
    instructions: "1. Открыть Ads Manager.\n2. Выгрузить метрики за прошлую неделю.\n3. Сравнить цену за лид (CPL) со средним значением.\n4. При росте CPL > 20% отключить неэффективные объявления и подготовить замену.",
    checklist: ["Снять метрики прошлых 7 дней (затраты, количество лидов, цена клика)", "Проверить креативы на выгорание (увеличение стоимости, падение CTR)", "Отключить дорогие объявления, перераспределить бюджет на рабочие связки"],
    resultFields: [
      {id: "weeklySpend", label: "Общие затраты за неделю", type: "number", unit: "PLN"},
      {id: "currentCpl", label: "Текущая стоимость 1 заявки (CPL)", type: "number", unit: "PLN"},
      {id: "targetBookings", label: "Количество новых записей из таргета", type: "number"},
    ],
    dueTime: "09:30",
    estimateMinutes: 45,
    priorityId: "high",
    repeat: {enabled: true, frequency: "weekly", weekdays: [1]},
  },
  {
    aliases: ["02. Работа с микроблогерами Варшавы (Бартер)"],
    key: "marketing-monday-microbloggers",
    title: "02. Работа с микроблогерами Варшавы (Бартер)",
    note: "Поиск локальных лидеров мнений для привлечения русскоязычных экспатов и местных жителей на массаж к Оле.",
    instructions: "1. Зайти в Instagram.\n2. Использовать поиск по тегам #warszawagirl, #polskadziewczyna, #бьютиваршава или геоточкам Wola/Śródmieście.\n3. Отбирать профили от 3k до 15k подписчиков с активными сторис.\n4. Отправить заготовленный скрипт предложения.",
    checklist: ["Найти 5-7 новых потенциальных инфлюенсеров в Варшаве", "Отправить 5 скриптов-предложений на сотрудничество в директ", "Зафиксировать ники и ссылки отправленных контактов в CRM"],
    resultFields: [
      {id: "sentInvites", label: "Количество отправленных инвайтов", type: "number"},
      {id: "acceptedBloggers", label: "Ссылки на согласившихся блогеров", type: "textarea"},
    ],
    dueTime: "10:15",
    estimateMinutes: 75,
    priorityId: "high",
    repeat: {enabled: true, frequency: "weekly", weekdays: [1]},
    metadata: {scripts: {
      ru: "Привет, [Имя]! Очень откликается твой блог. Меня зовут Вова, я основатель студии массажа в Варшаве. Хочу пригласить тебя к нам на массаж по бартеру — отдохнуть и протестировать сервис. С нас — топовый сеанс у главного мастера Оли, с тебя — честный отзыв/отметка в сторис, если понравится. Как тебе идея?",
      pl: "Cześć [Imię]! Twój profil ma super energię. Jestem Vova, założycielem kameralnego studia masażu w Warszawie. Chciałbym zaprosić Cię do nas na darmowy, relaksujący masaż (barter). Chcę, abyś po prostu odpoczęła. Jeśli zabieg Ci się spodoba, będę wdzięczny za szczerą polecajkę w Stories. Daj znać, czy masz ochotę!",
    }},
  },
  {
    aliases: ["03. Монтаж контента без новых съемок (Reels/TikTok)"],
    key: "marketing-monday-content-editing",
    title: "03. Монтаж контента без новых съемок (Reels/TikTok)",
    note: "Сборка еженедельного контента из старых заготовок, архивов студии и отзывов клиентов для поддержания регулярности алгоритмов.",
    instructions: "1. Открыть CapCut / Инструмент монтажа.\n2. Выбрать эстетичный фоновый архивный ролик из студии.\n3. Наложить трендовый звук и текстовый триггер.\n4. Опубликовать или поставить в отложенный постинг.",
    checklist: ["Смонтировать Reels №1: Формат 'Текст на видео' (Атмосфера + Напоминание о записи)", "Смонтировать Reels №2: Формат 'Социальное доказательство' (Скриншот-отзыв из CRM на фоне видео)", "Добавить призыв к действию (CTA) и ссылку на онлайн-запись в описания"],
    resultFields: [{id: "contentLinks", label: "Ссылки на готовые к публикации ролики / Скрины", type: "textarea"}],
    dueTime: "11:30",
    estimateMinutes: 75,
    priorityId: "high",
    repeat: {enabled: true, frequency: "weekly", weekdays: [1]},
  },
  {
    aliases: ["04. Генерация идей и планирование контента"],
    key: "marketing-monday-content-planning",
    title: "04. Генерация идей и планирование контента",
    note: "Поиск трендов у зарубежных и смежных локальных ниш (бьюти/массаж) для формирования съемочного плана на середину недели.",
    instructions: "1. Открыть Reels/TikTok конкурентов по запросам 'massage warszawa' или 'salon urody'.\n2. Найти топ-3 залетающих видео.\n3. Адаптировать смыслы под свою студию.\n4. Прописать 2 сценария для Оли или совместных кадров.",
    checklist: ["Проанализировать топ-публикации 3-х конкурентов", "Прописать и сохранить в CRM Идею №1 (Экспертная/Польза)", "Прописать и сохранить в CRM Идею №2 (Юмор/Жиза для клиентов)"],
    resultFields: [{id: "shootingScripts", label: "Тезисы/Сценарии для съемок в студии", type: "textarea"}],
    dueTime: "12:45",
    estimateMinutes: 45,
    priorityId: "high",
    repeat: {enabled: true, frequency: "weekly", weekdays: [1]},
  },
];

const buildAcquisitionTask = (template, startDate) => ({
  completed: false,
  createdAt: new Date().toISOString(),
  description: template.note,
  dueDate: startDate,
  note: template.note,
  priority: template.priorityId === "high" ? "Высокий" : "Средний",
  status: "active",
  title: template.title,
  type: "task",
  payload: {
    areaId: "acquisition",
    checklist: template.checklist.map((text, index) => ({done: false, id: `${template.key}-${index + 1}`, text})),
    dueDate: startDate,
    dueTime: template.dueTime ?? "",
    estimateMinutes: template.estimateMinutes ?? 0,
    priorityId: template.priorityId ?? "medium",
    instructions: template.instructions,
    metadata: template.metadata,
    repeat: {...(template.repeat ?? {enabled: true, frequency: "weekdays", weekdays: [1, 2, 3, 4, 5]}), startDate},
    resultFields: template.resultFields,
    resultSource: template.resultSource ?? "manual",
    taskKind: "daily",
    templateKey: template.key,
    templateVersion: 3,
  },
});

export function useTaskHandlers({
  employees = [],
  editingTask,
  pushNotification,
  requestEntityDelete,
  setEditingTask,
  setTaskModalOpen,
  setTasks,
  tasks = [],
}) {
  const openCreateTask = useCallback((typeOrDefaults = "task") => {
    const defaults =
      typeOrDefaults &&
      typeof typeOrDefaults === "object" &&
      typeof typeOrDefaults.preventDefault !== "function"
        ? typeOrDefaults
        : {};
    const nextType = typeOrDefaults === "note" || defaults.type === "note" ? "note" : "task";
    const dueDate = defaults.dueDate || getWarsawTodayInput();
    const taskKind = defaults.taskKind === "development" ? "development" : "daily";

    setEditingTask(
      nextType === "note"
        ? {type: "note"}
        : {
            dueDate,
            payload: {
              areaId: defaults.areaId ?? "general",
              dueDate,
              repeat: {
                enabled: taskKind === "daily",
                frequency: "daily",
                startDate: dueDate,
                weekdays: [],
              },
              taskKind,
            },
            type: "task",
          },
    );
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
        const resultFields = parseJsonField(form.get("resultFieldsJson"), getTaskResultFields(editingTask));
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
        if (repeatEnabled && !["daily", "monthly"].includes(repeatFrequency) && repeatWeekdays.length === 0) {
          pushNotification({
            title: "Повторение не сохранено",
            message: "Выберите хотя бы один день недели.",
            tone: "urgent",
          });
          return;
        }

        const payload = {
          ...getTaskPayload(editingTask),
          areaId: String(form.get("areaId") ?? "general"),
          assigneeId,
          assigneeName: getEmployeeName(employees, assigneeId),
          checklist,
          dueDate,
          dueTime,
          estimateMinutes,
          isMain: form.get("isMain") === "on",
          instructions: String(form.get("instructions") ?? getTaskPayload(editingTask).instructions ?? "").trim(),
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
          resultFields,
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
      const missingResult = getTaskResultFields(task).find((field) => {
        if (!field.required) return false;
        const value = task.occurrenceResults?.[field.id];
        return value === undefined || value === null || String(value).trim() === "";
      });
      if (!isCompleted && missingResult) {
        pushNotification({
          title: "Заполните результат",
          message: `Обязательное поле: ${missingResult.label}`,
          persist: false,
        });
        return;
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

  const saveTaskOccurrence = useCallback(
    async (task, patch) => {
      const date = normalizeInputDate(task?.occurrenceDate ?? getTaskDueDate(task));
      if (!date) return false;
      const nextTask = patchOccurrence(task, date, {...patch, updatedAt: new Date().toISOString()});
      const storageTaskId = getTaskStorageId(task);
      try {
        const response = await updateTask(storageTaskId, nextTask);
        const savedTask = response?.data ?? nextTask;
        setTasks((current) => current.map((item) => String(item.id) === String(storageTaskId) ? savedTask : item));
        pushNotification({title: "Результат сохранён", message: task.title});
        return true;
      } catch (error) {
        pushNotification({title: "Результат не сохранён", message: error?.message || "Backend не принял данные", persist: false});
        return false;
      }
    },
    [pushNotification, setTasks],
  );

  const setTaskTemplateArchived = useCallback(
    async (task, archived) => {
      const storageTaskId = getTaskStorageId(task);
      if (!storageTaskId) return false;
      const nextTask = {
        ...task,
        payload: {
          ...getTaskPayload(task),
          templateArchived: archived === true,
        },
        updatedAt: new Date().toISOString(),
      };
      try {
        const response = await updateTask(storageTaskId, nextTask);
        const savedTask = response?.data ?? nextTask;
        setTasks((current) => current.map((item) => String(item.id) === String(storageTaskId) ? savedTask : item));
        pushNotification({
          title: archived ? "Шаблон перенесён в архив" : "Шаблон активирован",
          message: task.title,
        });
        return true;
      } catch (error) {
        pushNotification({
          title: "Шаблон не обновлён",
          message: error?.message || "Backend не принял данные",
          persist: false,
        });
        return false;
      }
    },
    [pushNotification, setTasks],
  );

  const moveTaskTemplateToArea = useCallback(async (task, areaId) => {
    const storageTaskId = getTaskStorageId(task);
    if (!storageTaskId) return false;
    const nextTask = {...task, payload: {...getTaskPayload(task), areaId, areaLabel: ""}, updatedAt: new Date().toISOString()};
    try {
      const response = await updateTask(storageTaskId, nextTask);
      const savedTask = response?.data ?? nextTask;
      setTasks((current) => current.map((item) => String(item.id) === String(storageTaskId) ? savedTask : item));
      pushNotification({title: "Направление изменено", message: task.title});
      return true;
    } catch (error) {
      pushNotification({title: "Шаблон не перемещён", message: error?.message || "Backend не принял данные", persist: false});
      return false;
    }
  }, [pushNotification, setTasks]);

  const renameTaskArea = useCallback(async (areaId, areaLabel) => {
    const affected = tasks.filter((task) => getTaskPayload(task).areaId === areaId);
    if (!affected.length) return false;
    try {
      const saved = await Promise.all(affected.map(async (task) => {
        const nextTask = {...task, payload: {...getTaskPayload(task), areaLabel}, updatedAt: new Date().toISOString()};
        const response = await updateTask(getTaskStorageId(task), nextTask);
        return response?.data ?? nextTask;
      }));
      const byId = new Map(saved.map((task) => [String(task.id), task]));
      setTasks((current) => current.map((task) => byId.get(String(task.id)) ?? task));
      pushNotification({title: "Направление переименовано", message: areaLabel});
      return true;
    } catch (error) {
      pushNotification({title: "Название не сохранено", message: error?.message || "Backend не принял данные", persist: false});
      return false;
    }
  }, [pushNotification, setTasks, tasks]);

  const initializeAcquisitionPlan = useCallback(async () => {
    const startDate = getWarsawTodayInput();
    const normalizeTitle = (value) => String(value ?? "").trim().toLocaleLowerCase("ru");
    const legacyDirection = tasks.find((task) => {
      const payload = getTaskPayload(task);
      return !payload.templateKey && normalizeTitle(task.title) === "01. привлечение новых клиентов";
    });
    const operations = [];

    if (legacyDirection && !getTaskPayload(legacyDirection).hiddenFromPlan) {
      operations.push(updateTask(legacyDirection.id, {
        ...legacyDirection,
        payload: {
          ...getTaskPayload(legacyDirection),
          areaId: "acquisition",
          hiddenFromPlan: true,
          legacyDirectionRecord: true,
          migratedAt: new Date().toISOString(),
        },
      }));
    }

    ACQUISITION_TASK_TEMPLATES.forEach((template) => {
      const existing = tasks.find((task) => {
        const payload = getTaskPayload(task);
        return payload.templateKey === template.key || template.aliases.some((title) => normalizeTitle(title) === normalizeTitle(task.title));
      });
      if (!existing) {
        operations.push(createTask(buildAcquisitionTask(template, startDate)));
        return;
      }

      const payload = getTaskPayload(existing);
      const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
      const existingTexts = new Set(checklist.map((item) => normalizeTitle(item.text)));
      const missingChecklist = template.checklist
        .filter((text) => !existingTexts.has(normalizeTitle(text)))
        .map((text, index) => ({done: false, id: `${template.key}-added-${index + 1}`, text}));
      const resultFields = Array.isArray(payload.resultFields) ? payload.resultFields : [];
      const templateById = new Map(template.resultFields.map((field) => [field.id, field]));
      const mergedResultFields = resultFields
        .filter((field) => templateById.has(field.id) || !String(field.id).startsWith("template-"))
        .map((field) => templateById.has(field.id) ? {...field, ...templateById.get(field.id)} : field);
      const resultIds = new Set(mergedResultFields.map((field) => field.id));
      const missingResultFields = template.resultFields.filter((field) => !resultIds.has(field.id));
      const generatedTitle = template.aliases.some((title) => normalizeTitle(title) === normalizeTitle(existing.title));

      operations.push(updateTask(existing.id, {
        ...existing,
        ...(generatedTitle ? {title: template.title} : {}),
        payload: {
          ...payload,
          areaId: "acquisition",
          checklist: [...checklist, ...missingChecklist],
          instructions: payload.instructions || template.instructions,
          repeat: payload.repeat?.enabled ? payload.repeat : buildAcquisitionTask(template, startDate).payload.repeat,
          resultFields: [...mergedResultFields, ...missingResultFields],
          resultSource: template.resultSource ?? payload.resultSource ?? "manual",
          taskKind: "daily",
          templateKey: template.key,
          templateVersion: 3,
        },
      }));
    });

    const responses = await Promise.allSettled(operations);
    const saved = responses.flatMap((response) => response.status === "fulfilled" && response.value?.data ? [response.value.data] : []);
    if (saved.length) {
      const savedById = new Map(saved.map((task) => [String(task.id), task]));
      setTasks((current) => {
        const updated = current.map((task) => savedById.get(String(task.id)) ?? task);
        const knownIds = new Set(updated.map((task) => String(task.id)));
        return [...saved.filter((task) => !knownIds.has(String(task.id))), ...updated];
      });
      pushNotification({title: "Направление подготовлено", message: "Задачи проверены, недостающие добавлены, история сохранена"});
    } else if (operations.length) {
      const error = responses.find((response) => response.status === "rejected")?.reason;
      pushNotification({title: "План не обновлён", message: error?.message || "Backend не принял задачи", persist: false});
    } else {
      pushNotification({title: "Всё готово", message: "Все четыре задачи уже настроены"});
    }
  }, [pushNotification, setTasks, tasks]);

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

  const deleteTaskTemplates = useCallback(
    async (templates) => {
      const uniqueTemplates = [...new Map((templates ?? []).filter((task) => task?.id).map((task) => [String(task.id), task])).values()];
      if (!uniqueTemplates.length) return {deleted: 0, failed: 0};

      const results = await Promise.allSettled(uniqueTemplates.map((task) => deleteTask(task.id)));
      const deletedIds = new Set(
        uniqueTemplates
          .filter((_, index) => results[index].status === "fulfilled")
          .map((task) => String(task.id)),
      );
      const failed = uniqueTemplates.length - deletedIds.size;

      if (deletedIds.size) {
        setTasks((current) => current.filter((task) => !deletedIds.has(String(task.id))));
      }
      pushNotification({
        title: failed ? "Удалено не всё" : "Шаблоны удалены",
        message: failed
          ? `Удалено: ${deletedIds.size}. Не удалось удалить: ${failed}.`
          : `Удалено шаблонов: ${deletedIds.size}`,
        persist: failed > 0,
      });
      return {deleted: deletedIds.size, failed};
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
    deleteTaskTemplates,
    handleTaskSubmit,
    initializeAcquisitionPlan,
    moveTaskTemplateToArea,
    openCreateTask,
    openEditTask,
    performDeleteTask,
    reorderTasks,
    requestDeleteTask,
    renameTaskArea,
    saveTaskOccurrence,
    setTaskTemplateArchived,
    moveTaskToDate,
    setMainTask,
  };
}
