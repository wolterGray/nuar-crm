import {useMemo, useState} from "react";
import {Button, Field, Input, Select, Textarea} from "./ui/index.js";
import {
  TASK_KIND_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  getChecklistProgress,
  getTaskAssigneeId,
  getTaskDueDate,
  getTaskDueTime,
  getTaskEstimateMinutes,
  getTaskKind,
  getTaskPayload,
  getTaskPriorityId,
  getWarsawTodayInput,
  isTaskMainOnDate,
  isTaskRepeating,
} from "../utils/operationsPlanner.js";

const WEEKDAYS = [
  {id: 1, label: "Пн"},
  {id: 2, label: "Вт"},
  {id: 3, label: "Ср"},
  {id: 4, label: "Чт"},
  {id: 5, label: "Пт"},
  {id: 6, label: "Сб"},
  {id: 7, label: "Вс"},
];

const makeChecklistItem = (text = "") => ({
  done: false,
  id: `check-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  text,
});

function TaskForm({employees = [], task, onSubmit}) {
  const payload = getTaskPayload(task);
  const isNote = task?.type === "note";
  const isEditing = Boolean(task?.id);
  const dueDate = getTaskDueDate(task);
  const [taskKind, setTaskKind] = useState(getTaskKind(task));
  const [dueDateValue, setDueDateValue] = useState(dueDate || getWarsawTodayInput());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasTime, setHasTime] = useState(Boolean(getTaskDueTime(task)));
  const [repeatFrequency, setRepeatFrequency] = useState(payload.repeat?.frequency ?? "daily");
  const [repeatWeekdays, setRepeatWeekdays] = useState(
    Array.isArray(payload.repeat?.weekdays) ? payload.repeat.weekdays.map(Number) : [],
  );
  const [checklist, setChecklist] = useState(() => {
    const items = task?.occurrenceChecklist ?? payload.checklist;
    return Array.isArray(items) && items.length
      ? items.map((item, index) => ({
          done: item?.done === true,
          id: String(item?.id ?? `check-${index}`),
          text: String(item?.text ?? ""),
        }))
      : [];
  });
  const progress = getChecklistProgress({...task, occurrenceChecklist: checklist});
  const repeatEnabled = taskKind === "daily";
  const repeatStartDate = dueDateValue;

  const repeatPayload = useMemo(
    () => ({
      enabled: repeatEnabled,
      endDate: repeatEnabled ? payload.repeat?.endDate ?? "" : "",
      frequency: repeatFrequency,
      intervalWeeks: Math.max(1, Number(payload.repeat?.intervalWeeks) || 2),
      startDate: repeatStartDate,
      weekdays: repeatWeekdays,
    }),
    [payload.repeat?.endDate, payload.repeat?.intervalWeeks, repeatEnabled, repeatFrequency, repeatStartDate, repeatWeekdays],
  );

  const toggleWeekday = (weekday) => {
    setRepeatWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday].sort((left, right) => left - right),
    );
  };

  const updateChecklistItem = (id, patch) => {
    setChecklist((current) =>
      current.map((item) => (item.id === id ? {...item, ...patch} : item)),
    );
  };

  const removeChecklistItem = (id) => {
    setChecklist((current) => current.filter((item) => item.id !== id));
  };

  return (
    <form className="catalog-form task-form-advanced" onSubmit={onSubmit}>
      <input name="type" type="hidden" value={isNote ? "note" : "task"} />
      <input name="checklistJson" type="hidden" value={JSON.stringify(checklist)} />
      <input name="repeatJson" type="hidden" value={JSON.stringify(repeatPayload)} />
      <input name="isVirtualOccurrence" type="hidden" value={task?.isVirtualOccurrence ? "true" : ""} />
      <input name="baseId" type="hidden" value={task?.baseId ?? ""} />
      <input name="occurrenceDate" type="hidden" value={task?.occurrenceDate ?? ""} />

      <Field label={isNote ? "Заметка" : "Название"} required>
        <Input
          name="title"
          defaultValue={task?.title ?? ""}
          placeholder={isNote ? "Например: идея для салона" : "Например: подготовить контент-план"}
          required
        />
      </Field>

      {isNote ? (
        <>
          <Field label="Категория">
            <Select name="priority" defaultValue={task?.priority ?? "Мысль"}>
              <option>Мысль</option>
              <option>Заказать</option>
              <option>Идея</option>
              <option>Личное</option>
            </Select>
          </Field>
          <Field label="Детали">
            <Textarea name="note" defaultValue={task?.note ?? ""} rows="3" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Описание">
            <Textarea name="note" defaultValue={task?.note ?? task?.description ?? ""} rows="3" />
          </Field>

          <input name="taskKind" type="hidden" value={taskKind} />
          <input name="repeatEnabled" type="hidden" value={repeatEnabled ? "on" : ""} />
          <div className="task-kind-picker" role="group" aria-label="Вид задачи">
            {TASK_KIND_OPTIONS.map((option) => (
              <button
                aria-pressed={taskKind === option.id}
                className={taskKind === option.id ? "is-active" : ""}
                key={option.id}
                type="button"
                onClick={() => setTaskKind(option.id)}>
                <strong>{option.label}</strong>
                <span>
                  {option.id === "daily"
                    ? "Можно выполнить сегодня — завтра появится снова"
                    : "Разовая задача с конкретным результатом"}
                </span>
              </button>
            ))}
          </div>

          <div className="task-form-date-row">
            <Field label={taskKind === "daily" ? "Начать с" : "Сделать до"}>
              <Input
                name="dueDate"
                type="date"
                value={dueDateValue}
                onChange={(event) => setDueDateValue(event.target.value)}
              />
            </Field>
          </div>

          {taskKind === "daily" ? (
            <p className="task-repeat-explainer">
              Выполнение отмечается только за выбранный день. Следующее дело останется активным.
            </p>
          ) : null}

          <label className="settings-checkbox task-form-toggle">
            <input
              checked={hasTime}
              name="hasTime"
              type="checkbox"
              value="on"
              onChange={(event) => setHasTime(event.target.checked)}
            />
            <span>Указать время</span>
          </label>
          {hasTime ? (
            <Field label="Время выполнения">
              <Input name="dueTime" type="time" defaultValue={getTaskDueTime(task)} />
            </Field>
          ) : null}

          <label className="settings-checkbox task-form-toggle">
            <input
              defaultChecked={isTaskMainOnDate(task, dueDateValue)}
              name="isMain"
              type="checkbox"
              value="on"
            />
            <span>Главная задача дня</span>
          </label>

          <Button
            rightIcon={showAdvanced ? "chevronUp" : "chevronDown"}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => setShowAdvanced((current) => !current)}>
            Дополнительно
          </Button>

          <div className="task-form-extra" hidden={!showAdvanced}>
              <div className="form-split">
                <Field label="Исполнитель (необязательно)">
                  <Select name="assigneeId" defaultValue={getTaskAssigneeId(task)}>
                    <option value="">Без исполнителя</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Оценка времени, мин (необязательно)">
                  <Input
                    min="0"
                    name="estimateMinutes"
                    type="number"
                    defaultValue={getTaskEstimateMinutes(task) || ""}
                  />
                </Field>
              </div>

              <div className="form-split">
                <Field label="Приоритет">
                  <Select name="priorityId" defaultValue={getTaskPriorityId(task)}>
                    {TASK_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Статус">
                  <Select name="status" defaultValue={task?.status ?? "active"}>
                    {TASK_STATUS_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Ожидаемый результат">
                <Textarea name="outcome" defaultValue={payload.outcome ?? ""} rows="2" />
              </Field>

              <section className="task-form-checklist">
                <div className="task-form-section-head">
                  <strong>Чек-лист</strong>
                  <small>{progress.done}/{progress.total}</small>
                </div>
                <div className="task-form-checklist-items">
                  {checklist.map((item) => (
                    <div className="task-form-checklist-row" key={item.id}>
                      <input
                        checked={item.done}
                        type="checkbox"
                        onChange={(event) => updateChecklistItem(item.id, {done: event.target.checked})}
                      />
                      <Input
                        value={item.text}
                        onChange={(event) => updateChecklistItem(item.id, {text: event.target.value})}
                      />
                      <Button
                        leftIcon="trash"
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => removeChecklistItem(item.id)}>
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  leftIcon="plus"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setChecklist((current) => [...current, makeChecklistItem()])}>
                  Добавить пункт
                </Button>
              </section>

              {repeatEnabled ? (
                <section className="task-form-repeat">
                  <div className="task-form-section-head">
                    <strong>График регулярного дела</strong>
                    <small>Необязательно</small>
                  </div>
                  <div className="form-split">
                    <Field label="Появляется">
                      <Select
                        value={repeatFrequency}
                        onChange={(event) => setRepeatFrequency(event.target.value)}>
                        <option value="daily">Каждый день</option>
                        <option value="weekdays">По дням недели</option>
                        <option value="weekly">Каждую неделю</option>
                        <option value="intervalWeeks">Каждые N недель</option>
                      </Select>
                    </Field>
                    <Field label="Показывать до (необязательно)">
                      <Input name="repeatEndDate" type="date" defaultValue={payload.repeat?.endDate ?? ""} />
                    </Field>
                  </div>
                  <input name="repeatStartDate" type="hidden" value={repeatStartDate} />

                  {repeatFrequency === "intervalWeeks" ? (
                    <Field label="Интервал недель">
                      <Input
                        min="1"
                        name="repeatIntervalWeeks"
                        type="number"
                        defaultValue={payload.repeat?.intervalWeeks ?? 2}
                      />
                    </Field>
                  ) : null}

                  {repeatFrequency !== "daily" ? (
                    <div className="task-form-weekdays" aria-label="Дни недели">
                      {WEEKDAYS.map((weekday) => (
                        <button
                          className={repeatWeekdays.includes(weekday.id) ? "is-active" : ""}
                          key={weekday.id}
                          type="button"
                          onClick={() => toggleWeekday(weekday.id)}>
                          {weekday.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {task?.isVirtualOccurrence || isTaskRepeating(task) ? (
                <Field label="Применить изменения">
                  <Select name="applyScope" defaultValue="single">
                    <option value="single">Только эту задачу</option>
                    <option value="future">Эту и последующие</option>
                  </Select>
                </Field>
              ) : null}
            </div>
        </>
      )}

      <Button
        className="crm-primary-action task-submit-button"
        size="lg"
        type="submit"
        variant="primary">
        {isEditing
          ? "Сохранить"
          : isNote
            ? "Добавить заметку"
            : "Добавить задачу"}
      </Button>
    </form>
  );
}

export default TaskForm;
