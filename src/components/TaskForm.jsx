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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasTime, setHasTime] = useState(Boolean(getTaskDueTime(task)));
  const [repeatEnabled, setRepeatEnabled] = useState(isTaskRepeating(task));
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
  const repeatStartDate = payload.repeat?.startDate ?? dueDate ?? getWarsawTodayInput();

  const repeatPayload = useMemo(
    () => ({
      enabled: repeatEnabled,
      endDate: payload.repeat?.endDate ?? "",
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

          <div className="form-split">
            <Field label="Тип">
              <Select name="taskKind" defaultValue={getTaskKind(task)}>
                {TASK_KIND_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Исполнитель">
              <Select name="assigneeId" defaultValue={getTaskAssigneeId(task)}>
                <option value="">Без исполнителя</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={String(employee.id)}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="form-split">
            <Field label="Дата">
              <Input
                name="dueDate"
                type="date"
                defaultValue={dueDate}
              />
            </Field>
            <Field label="Оценка, мин">
              <Input
                min="0"
                name="estimateMinutes"
                type="number"
                defaultValue={getTaskEstimateMinutes(task) || ""}
              />
            </Field>
          </div>

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

          <label className="settings-checkbox task-form-toggle">
            <input
              defaultChecked={isTaskMainOnDate(task, dueDate)}
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

          {showAdvanced ? (
            <div className="task-form-extra">
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

              <label className="settings-checkbox task-form-toggle">
                <input
                  checked={repeatEnabled}
                  name="repeatEnabled"
                  type="checkbox"
                  value="on"
                  onChange={(event) => setRepeatEnabled(event.target.checked)}
                />
                <span>Повторять задачу</span>
              </label>

              {repeatEnabled ? (
                <section className="task-form-repeat">
                  <div className="form-split">
                    <Field label="Повтор">
                      <Select
                        value={repeatFrequency}
                        onChange={(event) => setRepeatFrequency(event.target.value)}>
                        <option value="daily">Каждый день</option>
                        <option value="weekdays">По дням недели</option>
                        <option value="weekly">Каждую неделю</option>
                        <option value="intervalWeeks">Каждые N недель</option>
                      </Select>
                    </Field>
                    <Field label="Начало серии">
                      <Input name="repeatStartDate" type="date" defaultValue={repeatStartDate} required={repeatEnabled} />
                    </Field>
                  </div>

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

                  <Field label="Окончание серии">
                    <Input name="repeatEndDate" type="date" defaultValue={payload.repeat?.endDate ?? ""} />
                  </Field>
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
          ) : null}
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
