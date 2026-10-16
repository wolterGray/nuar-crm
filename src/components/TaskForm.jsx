import {useEffect, useMemo, useState} from "react";
import {AppIcon, Button, Checkbox, Field, IconButton, Input, Select, Switch, Textarea} from "./ui/index.js";
import {
  TASK_COLOR_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS, WORK_AREA_OPTIONS, addDays,
  getTaskAssigneeId, getTaskDueDate, getTaskDueTime, getTaskEstimateMinutes,
  getTaskKind, getTaskPayload, getTaskPriorityId, getWarsawTodayInput,
  getWeekStart, isTaskMainOnDate, isTaskRepeating,
} from "../utils/operationsPlanner.js";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label, index) => ({id: index + 1, label}));
const makeChecklistItem = () => ({done: false, id: `check-${Date.now()}-${Math.random().toString(16).slice(2)}`, text: ""});
const makeResultField = () => ({id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: "", required: false, type: "text", unit: ""});

function TaskForm({employees = [], formId, layout = "modal", onCancel, onDirtyChange, onSubmit, saving: externalSaving, task}) {
  const payload = getTaskPayload(task);
  const currentAreaId = payload.areaId ?? "general";
  const hasCustomArea = currentAreaId !== "general" && !WORK_AREA_OPTIONS.some((option) => option.id === currentAreaId);
  const isNote = task?.type === "note";
  const isEditing = Boolean(task?.id);
  const dueDate = getTaskDueDate(task);
  const [localSaving, setLocalSaving] = useState(false);
  const [taskKind, setTaskKind] = useState(getTaskKind(task));
  const [dueDateValue, setDueDateValue] = useState(dueDate || getWarsawTodayInput());
  const [hasTime, setHasTime] = useState(Boolean(getTaskDueTime(task)));
  const [repeatFrequency, setRepeatFrequency] = useState(payload.repeat?.frequency ?? "daily");
  const [repeatWeekdays, setRepeatWeekdays] = useState(Array.isArray(payload.repeat?.weekdays) ? payload.repeat.weekdays.map(Number) : []);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingResultId, setEditingResultId] = useState(null);
  const [checklist, setChecklist] = useState(() => {
    const items = task?.occurrenceChecklist ?? payload.checklist;
    return Array.isArray(items) ? items.map((item, index) => ({done: item?.done === true, id: String(item?.id ?? `check-${index}`), text: String(item?.text ?? "")})) : [];
  });
  const [resultFields, setResultFields] = useState(() => Array.isArray(payload.resultFields) ? payload.resultFields.map((field) => ({...field})) : []);
  const [resultValues, setResultValues] = useState(() => ({...(task?.occurrenceResults ?? {})}));
  const [occurrenceComment, setOccurrenceComment] = useState(task?.occurrenceComment ?? "");
  const repeatEnabled = taskKind === "daily";
  const quickDays = useMemo(() => {
    const weekStart = getWeekStart(dueDateValue);
    return [
      ...WEEKDAYS.slice(0, 5).map((day, index) => ({...day, dates: [addDays(weekStart, index)]})),
      {id: 6, label: "Сб/Вс", dates: [addDays(weekStart, 5), addDays(weekStart, 6)]},
    ];
  }, [dueDateValue]);
  const selectedWeekday = new Date(`${dueDateValue}T12:00:00`).getDay() || 7;
  const selectQuickDay = (day) => {
    markDirty();
    setDueDateValue(day.dates[0]);
    if (repeatEnabled && repeatFrequency !== "monthly") {
      setRepeatWeekdays(day.id === 6 ? [6, 7] : [day.id]);
    }
  };
  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);
  const repeatPayload = useMemo(() => ({
    enabled: repeatEnabled,
    endDate: repeatEnabled ? payload.repeat?.endDate ?? "" : "",
    frequency: repeatFrequency,
    intervalWeeks: Math.max(1, Number(payload.repeat?.intervalWeeks) || 2),
    startDate: dueDateValue,
    weekdays: repeatWeekdays,
  }), [dueDateValue, payload.repeat?.endDate, payload.repeat?.intervalWeeks, repeatEnabled, repeatFrequency, repeatWeekdays]);

  const markDirty = () => onDirtyChange?.(true);
  const updateChecklist = (id, patch) => { markDirty(); setChecklist((current) => current.map((item) => item.id === id ? {...item, ...patch} : item)); };
  const updateResult = (id, patch) => { markDirty(); setResultFields((current) => current.map((item) => item.id === id ? {...item, ...patch} : item)); };
  const moveChecklist = (id, offset) => {
    markDirty();
    setChecklist((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + offset));
      if (index < 0 || index === nextIndex) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };
  const saving = externalSaving ?? localSaving;
  const handleSubmit = async (event) => {
    if (externalSaving === undefined) setLocalSaving(true);
    await onSubmit(event);
    if (externalSaving === undefined) setLocalSaving(false);
  };
  if (isNote) {
    return (
      <form className="catalog-form task-form-note" onChange={markDirty} onSubmit={handleSubmit}>
        <input name="type" type="hidden" value="note" />
        <Field label="Заметка" required><Input name="title" defaultValue={task?.title ?? ""} required /></Field>
        <Field label="Категория"><Select name="priority" defaultValue={task?.priority ?? "Мысль"}><option>Мысль</option><option>Заказать</option><option>Идея</option><option>Личное</option></Select></Field>
        <Field label="Детали"><Textarea name="note" defaultValue={task?.note ?? ""} rows="5" /></Field>
        <EditorFooter isEditing={isEditing} saving={saving} onCancel={onCancel} />
      </form>
    );
  }

  return (
    <form className={`task-editor ${layout === "page" ? "task-editor-page-layout" : ""} ${layout === "drawer" ? "task-editor-drawer-layout" : ""}`} id={formId} onChange={markDirty} onSubmit={handleSubmit}>
      <input name="type" type="hidden" value="task" />
      <input name="checklistJson" type="hidden" value={JSON.stringify(checklist)} />
      <input name="repeatJson" type="hidden" value={JSON.stringify(repeatPayload)} />
      <input name="resultFieldsJson" type="hidden" value={JSON.stringify(resultFields)} />
      <input name="occurrenceResultsJson" type="hidden" value={JSON.stringify(resultValues)} />
      <input name="occurrenceComment" type="hidden" value={occurrenceComment} />
      <input name="taskKind" type="hidden" value={taskKind} />
      <input name="repeatEnabled" type="hidden" value={repeatEnabled ? "on" : ""} />
      <input name="baseId" type="hidden" value={task?.baseId ?? ""} />
      <input name="occurrenceDate" type="hidden" value={task?.occurrenceDate ?? ""} />

      {layout === "drawer" ? <div className="task-drawer-context">
        <span>День недели</span>
        <div className="task-drawer-days" role="group" aria-label="День недели">
          {quickDays.map((day) => <button aria-pressed={day.id === (selectedWeekday >= 6 ? 6 : selectedWeekday)} className={day.id === (selectedWeekday >= 6 ? 6 : selectedWeekday) ? "is-active" : ""} key={day.id} type="button" onClick={() => selectQuickDay(day)}>{day.label}</button>)}
        </div>
        <Field label="Название задачи" required><Input className="task-drawer-title-input" name="title" defaultValue={task?.title ?? ""} placeholder="Что нужно сделать?" required /></Field>
      </div> : null}

      <div className="task-editor-scroll">
        <section className="task-editor-panel">
          <SectionHead description="Содержание и ответственность за задачу." title="Основное" />
          {layout !== "drawer" ? <Field label="Название" required><Input name="title" defaultValue={task?.title ?? ""} placeholder="Название задачи" required /></Field> : null}
          <Field label="Описание"><Textarea name="note" defaultValue={task?.note ?? task?.description ?? ""} rows="3" /></Field>
          <Field label="Пошаговая инструкция"><Textarea name="instructions" defaultValue={payload.instructions ?? ""} rows="5" /></Field>
          <div className="task-editor-grid task-editor-meta-grid">
            <Field label="Направление работы"><Select name="areaId" defaultValue={currentAreaId}><option value="general">Другие задачи</option>{hasCustomArea ? <option value={currentAreaId}>{payload.areaLabel || currentAreaId}</option> : null}{WORK_AREA_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
            <Field label="Ответственный"><Select name="assigneeId" defaultValue={getTaskAssigneeId(task)}><option value="">Без исполнителя</option>{employees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name}</option>)}</Select></Field>
            <Field label="Приоритет"><Select name="priorityId" defaultValue={getTaskPriorityId(task)}>{TASK_PRIORITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
            <Field label="Статус"><Select name="status" defaultValue={task?.status ?? "active"}>{TASK_STATUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
          </div>
          <fieldset className="task-color-picker">
            <legend>Цвет карточки</legend>
            <div>
              {TASK_COLOR_OPTIONS.map((option) => <label className={`task-color-option task-color-${option.id}`} key={option.id} title={option.label}><input defaultChecked={(payload.colorId ?? "auto") === option.id} name="colorId" type="radio" value={option.id} /><span aria-hidden="true" /><em>{option.label}</em></label>)}
            </div>
          </fieldset>
          <SwitchRow description="Выделить задачу в рабочем плане" label="Главная задача дня"><Switch defaultChecked={isTaskMainOnDate(task, dueDateValue)} name="isMain" value="on" /></SwitchRow>
        </section>

        <section className="task-editor-panel">
          <SectionHead count={checklist.length} description="Идентификаторы действий сохраняются в истории." title="Чек-лист" />
          <div className="task-checklist-editor">
            {checklist.map((item, index) => <article className={`task-checklist-item ${item.done ? "is-done" : ""}`} key={item.id}>
              <span className="task-drag-icon" title="Изменить порядок"><AppIcon name="grip" size="sm" /></span>
              <Checkbox aria-label={`Выполнить «${item.text || "пункт"}»`} checked={item.done} onChange={(event) => updateChecklist(item.id, {done: event.target.checked})} />
              {editingChecklistId === item.id ? <Input autoFocus value={item.text} onChange={(event) => updateChecklist(item.id, {text: event.target.value})} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setEditingChecklistId(null); } if (event.key === "Escape") setEditingChecklistId(null); }} /> : <button className="task-checklist-title" type="button" onClick={() => setEditingChecklistId(item.id)}>{item.text || "Без названия"}</button>}
              <div className="task-row-tools"><IconButton disabled={index === 0} icon="arrowUp" label="Поднять" size="sm" onClick={() => moveChecklist(item.id, -1)} /><IconButton disabled={index === checklist.length - 1} icon="arrowDown" label="Опустить" size="sm" onClick={() => moveChecklist(item.id, 1)} /><IconButton icon={editingChecklistId === item.id ? "check" : "edit"} label="Изменить" size="sm" onClick={() => setEditingChecklistId(editingChecklistId === item.id ? null : item.id)} /><IconButton icon="trash" label="Удалить" size="sm" onClick={() => { markDirty(); setChecklist((current) => current.filter((entry) => entry.id !== item.id)); }} /></div>
            </article>)}
            {!checklist.length ? <div className="task-editor-empty">Чек-лист пока пуст.</div> : null}
          </div>
          <button className="task-editor-add-link" type="button" onClick={() => { const item = makeChecklistItem(); markDirty(); setChecklist((current) => [...current, item]); setEditingChecklistId(item.id); }}>+ Добавить пункт чек-листа</button>
        </section>

        <section className="task-editor-panel">
          <SectionHead count={resultFields.length} description="Данные, которые фиксируются при выполнении." title="Поля результатов" />
          <Field label="Ожидаемый результат"><Textarea name="outcome" defaultValue={payload.outcome ?? ""} rows="2" /></Field>
          <div className="task-result-builder">
            {resultFields.map((field) => <ResultFieldCard field={field} isOpen={editingResultId === field.id} key={field.id} onDelete={() => { markDirty(); setResultFields((current) => current.filter((entry) => entry.id !== field.id)); }} onToggle={() => setEditingResultId(editingResultId === field.id ? null : field.id)} onUpdate={(patch) => updateResult(field.id, patch)} />)}
            {!resultFields.length ? <div className="task-editor-empty">Поля результата пока не настроены.</div> : null}
          </div>
          {task?.isVirtualOccurrence && resultFields.length ? <div className="task-occurrence-results">
            <strong>Фактические значения за {task.occurrenceDate}</strong>
            {resultFields.map((field) => <Field key={field.id} label={`${field.label || "Результат"}${field.unit ? `, ${field.unit}` : ""}`} required={field.required === true}>{field.type === "textarea" ? <Textarea rows="3" value={resultValues[field.id] ?? ""} onChange={(event) => { markDirty(); setResultValues((current) => ({...current, [field.id]: event.target.value})); }} /> : <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={resultValues[field.id] ?? ""} onChange={(event) => { markDirty(); setResultValues((current) => ({...current, [field.id]: event.target.value})); }} />}</Field>)}
            <Field label="Комментарий за день"><Textarea rows="3" value={occurrenceComment} onChange={(event) => { markDirty(); setOccurrenceComment(event.target.value); }} /></Field>
          </div> : null}
          <button className="task-editor-add-link" type="button" onClick={() => { const field = makeResultField(); markDirty(); setResultFields((current) => [...current, field]); setEditingResultId(field.id); }}>+ Добавить поле результата</button>
        </section>

        <section className="task-editor-panel">
          <SectionHead description="Когда задача появляется в рабочем плане." title="Расписание" />
          <SwitchRow description="Задача автоматически появляется по расписанию" label="Регулярное дело"><Switch checked={repeatEnabled} onChange={(event) => { markDirty(); setTaskKind(event.target.checked ? "daily" : "oneTime"); if (event.target.checked && !["daily", "weekly", "monthly"].includes(repeatFrequency)) setRepeatFrequency("weekly"); }} /></SwitchRow>
          {repeatEnabled ? <input name="dueDate" type="hidden" value={dueDateValue} /> : <Field label="Дата выполнения"><Input name="dueDate" type="date" value={dueDateValue} onChange={(event) => setDueDateValue(event.target.value)} /></Field>}
          <input name="repeatStartDate" type="hidden" value={dueDateValue} />
          {repeatEnabled ? <Field label="Повторение"><Select value={repeatFrequency} onChange={(event) => { markDirty(); setRepeatFrequency(event.target.value); }}><option value="daily">Каждый день</option><option value="weekly">Каждую неделю</option><option value="monthly">Каждый месяц</option></Select></Field> : null}
          <div className="task-schedule-compact-row"><SwitchRow description="Показывать время" label="Указать время"><Switch checked={hasTime} name="hasTime" value="on" onChange={(event) => { markDirty(); setHasTime(event.target.checked); }} /></SwitchRow>{hasTime ? <Field label="Время"><Input name="dueTime" type="time" defaultValue={getTaskDueTime(task)} /></Field> : null}<Field label="Планируемое время, мин"><Input min="0" name="estimateMinutes" type="number" defaultValue={getTaskEstimateMinutes(task) || ""} /></Field></div>
          {task?.isVirtualOccurrence || isTaskRepeating(task) ? <Field label="Применить изменения"><Select name="applyScope" defaultValue={task?.isVirtualOccurrence ? "single" : "future"}><option value="single">Только выбранный день</option><option value="future">К шаблону и последующим</option></Select></Field> : null}
        </section>
      </div>
      {layout === "modal" ? <EditorFooter isEditing={isEditing} saving={saving} onCancel={onCancel} /> : null}
    </form>
  );
}

function SectionHead({count, description, title}) {
  return <div className="task-editor-section-head"><div><h3>{title}</h3><p>{description}</p></div>{count !== undefined ? <span>{count}</span> : null}</div>;
}

function SwitchRow({children, description, label}) {
  return <label className="task-editor-switch-row">{children}<span><strong>{label}</strong><small>{description}</small></span></label>;
}

function ResultFieldCard({field, isOpen, onDelete, onToggle, onUpdate}) {
  const typeLabel = field.type === "number" ? "Число" : field.type === "date" ? "Дата" : field.type === "textarea" ? "Большой текст" : "Текст";
  return <article className={`task-result-card ${isOpen ? "is-editing" : ""}`}><button className="task-result-summary" type="button" onClick={onToggle}><span><strong>{field.label || "Новое поле"}</strong><small>{typeLabel}{field.unit ? ` · ${field.unit}` : ""} · Обязательное: {field.required ? "Да" : "Нет"}</small></span><AppIcon name={isOpen ? "chevronUp" : "chevronDown"} size="sm" /></button>{isOpen ? <div className="task-result-settings"><Field label="Название поля"><Input value={field.label} onChange={(event) => onUpdate({label: event.target.value})} /></Field><div className="task-editor-grid"><Field label="Тип данных"><Select value={field.type} onChange={(event) => onUpdate({type: event.target.value})}><option value="text">Текст</option><option value="number">Число</option><option value="date">Дата</option><option value="textarea">Большой текст</option></Select></Field><Field label="Единица измерения"><Input placeholder="Например, zł" value={field.unit ?? ""} onChange={(event) => onUpdate({unit: event.target.value})} /></Field></div><SwitchRow description="Без значения задачу нельзя завершить" label="Обязательное"><Switch checked={field.required === true} onChange={(event) => onUpdate({required: event.target.checked})} /></SwitchRow><Button leftIcon="trash" size="sm" type="button" variant="ghost" onClick={onDelete}>Удалить поле</Button></div> : null}</article>;
}

function EditorFooter({saving, onCancel}) {
  return <footer className="task-editor-footer"><Button disabled={saving} type="button" variant="secondary" onClick={onCancel}>Отмена</Button><Button leftIcon="save" loading={saving} type="submit" variant="primary">Сохранить</Button></footer>;
}

export default TaskForm;
