import {useEffect, useMemo, useState} from "react";
import {AppIcon, Button, Field, IconButton, Input, Select, Switch, TabButton, Tabs, Textarea} from "./ui/index.js";
import {
  TASK_KIND_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS, WORK_AREA_OPTIONS,
  getTaskAssigneeId, getTaskDueDate, getTaskDueTime, getTaskEstimateMinutes,
  getTaskKind, getTaskPayload, getTaskPriorityId, getWarsawTodayInput,
  isTaskMainOnDate, isTaskRepeating,
} from "../utils/operationsPlanner.js";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label, index) => ({id: index + 1, label}));
const EDITOR_TABS = [
  {id: "main", label: "Основное"}, {id: "checklist", label: "Чек-лист"},
  {id: "results", label: "Результаты"}, {id: "schedule", label: "Расписание"},
];
const makeChecklistItem = () => ({done: false, id: `check-${Date.now()}-${Math.random().toString(16).slice(2)}`, text: ""});
const makeResultField = () => ({id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: "", required: false, type: "text", unit: ""});

function TaskForm({employees = [], onCancel, onDirtyChange, onSubmit, task}) {
  const payload = getTaskPayload(task);
  const isNote = task?.type === "note";
  const isEditing = Boolean(task?.id);
  const dueDate = getTaskDueDate(task);
  const [activeTab, setActiveTab] = useState("main");
  const [saving, setSaving] = useState(false);
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
  const repeatEnabled = taskKind === "daily";
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
  const handleSubmit = async (event) => { setSaving(true); await onSubmit(event); setSaving(false); };

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
    <form className="task-editor" onChange={markDirty} onSubmit={handleSubmit}>
      <input name="type" type="hidden" value="task" />
      <input name="checklistJson" type="hidden" value={JSON.stringify(checklist)} />
      <input name="repeatJson" type="hidden" value={JSON.stringify(repeatPayload)} />
      <input name="resultFieldsJson" type="hidden" value={JSON.stringify(resultFields)} />
      <input name="taskKind" type="hidden" value={taskKind} />
      <input name="repeatEnabled" type="hidden" value={repeatEnabled ? "on" : ""} />
      <input name="baseId" type="hidden" value={task?.baseId ?? ""} />
      <input name="occurrenceDate" type="hidden" value={task?.occurrenceDate ?? ""} />

      <Tabs className="task-editor-tabs">
        {EDITOR_TABS.map((tab) => <TabButton active={activeTab === tab.id} badge={tab.id === "checklist" ? checklist.length : tab.id === "results" ? resultFields.length : undefined} key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</TabButton>)}
      </Tabs>

      <div className="task-editor-scroll">
        <section className="task-editor-panel" hidden={activeTab !== "main"}>
          <SectionHead description="Содержание и ответственность за задачу." title="Основное" />
          <Field label="Название" required><Input name="title" defaultValue={task?.title ?? ""} placeholder="Название задачи" required /></Field>
          <Field label="Описание"><Textarea name="note" defaultValue={task?.note ?? task?.description ?? ""} rows="3" /></Field>
          <Field label="Пошаговая инструкция"><Textarea name="instructions" defaultValue={payload.instructions ?? ""} rows="5" /></Field>
          <div className="task-editor-grid">
            <Field label="Направление работы"><Select name="areaId" defaultValue={payload.areaId ?? "general"}><option value="general">Другие задачи</option>{WORK_AREA_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
            <Field label="Ответственный"><Select name="assigneeId" defaultValue={getTaskAssigneeId(task)}><option value="">Без исполнителя</option>{employees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name}</option>)}</Select></Field>
            <Field label="Приоритет"><Select name="priorityId" defaultValue={getTaskPriorityId(task)}>{TASK_PRIORITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
            <Field label="Статус"><Select name="status" defaultValue={task?.status ?? "active"}>{TASK_STATUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select></Field>
          </div>
          <SwitchRow description="Выделить задачу в рабочем плане" label="Главная задача дня"><Switch defaultChecked={isTaskMainOnDate(task, dueDateValue)} name="isMain" value="on" /></SwitchRow>
        </section>

        <section className="task-editor-panel" hidden={activeTab !== "checklist"}>
          <SectionHead count={checklist.length} description="Идентификаторы действий сохраняются в истории." title="Чек-лист" />
          <div className="task-checklist-editor">
            {checklist.map((item, index) => <article className="task-checklist-item" key={item.id}>
              <span className="task-drag-icon" title="Изменить порядок"><AppIcon name="grip" size="sm" /></span>
              {editingChecklistId === item.id ? <Input autoFocus value={item.text} onChange={(event) => updateChecklist(item.id, {text: event.target.value})} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setEditingChecklistId(null); } if (event.key === "Escape") setEditingChecklistId(null); }} /> : <button className="task-checklist-title" type="button" onClick={() => setEditingChecklistId(item.id)}>{item.text || "Без названия"}</button>}
              <div className="task-row-tools"><IconButton disabled={index === 0} icon="arrowUp" label="Поднять" size="sm" onClick={() => moveChecklist(item.id, -1)} /><IconButton disabled={index === checklist.length - 1} icon="arrowDown" label="Опустить" size="sm" onClick={() => moveChecklist(item.id, 1)} /><IconButton icon={editingChecklistId === item.id ? "check" : "edit"} label="Изменить" size="sm" onClick={() => setEditingChecklistId(editingChecklistId === item.id ? null : item.id)} /><IconButton icon="trash" label="Удалить" size="sm" onClick={() => { markDirty(); setChecklist((current) => current.filter((entry) => entry.id !== item.id)); }} /></div>
            </article>)}
            {!checklist.length ? <div className="task-editor-empty">Добавьте первое действие задачи.</div> : null}
          </div>
          <Button leftIcon="plus" type="button" variant="secondary" onClick={() => { const item = makeChecklistItem(); markDirty(); setChecklist((current) => [...current, item]); setEditingChecklistId(item.id); }}>Добавить действие</Button>
        </section>

        <section className="task-editor-panel" hidden={activeTab !== "results"}>
          <SectionHead count={resultFields.length} description="Данные, которые фиксируются при выполнении." title="Поля результатов" />
          <Field label="Ожидаемый результат"><Textarea name="outcome" defaultValue={payload.outcome ?? ""} rows="2" /></Field>
          <div className="task-result-builder">
            {resultFields.map((field) => <ResultFieldCard field={field} isOpen={editingResultId === field.id} key={field.id} onDelete={() => { markDirty(); setResultFields((current) => current.filter((entry) => entry.id !== field.id)); }} onToggle={() => setEditingResultId(editingResultId === field.id ? null : field.id)} onUpdate={(patch) => updateResult(field.id, patch)} />)}
            {!resultFields.length ? <div className="task-editor-empty">Поля результата пока не настроены.</div> : null}
          </div>
          <Button leftIcon="plus" type="button" variant="secondary" onClick={() => { const field = makeResultField(); markDirty(); setResultFields((current) => [...current, field]); setEditingResultId(field.id); }}>Добавить поле</Button>
        </section>

        <section className="task-editor-panel" hidden={activeTab !== "schedule"}>
          <SectionHead description="Когда задача появляется в рабочем плане." title="Расписание" />
          <div className="task-kind-picker" role="group">{TASK_KIND_OPTIONS.map((option) => <button aria-pressed={taskKind === option.id} className={taskKind === option.id ? "is-active" : ""} key={option.id} type="button" onClick={() => { markDirty(); setTaskKind(option.id); }}><strong>{option.label}</strong><span>{option.id === "daily" ? "Повторяется по выбранному графику" : "Выполняется один раз"}</span></button>)}</div>
          <div className="task-editor-grid"><Field label={repeatEnabled ? "Дата начала" : "Сделать до"}><Input name="dueDate" type="date" value={dueDateValue} onChange={(event) => setDueDateValue(event.target.value)} /></Field>{repeatEnabled ? <Field label="Дата окончания"><Input name="repeatEndDate" type="date" defaultValue={payload.repeat?.endDate ?? ""} /></Field> : null}</div>
          <input name="repeatStartDate" type="hidden" value={dueDateValue} />
          {repeatEnabled ? <><Field label="Повторение"><Select value={repeatFrequency} onChange={(event) => { markDirty(); setRepeatFrequency(event.target.value); }}><option value="daily">Каждый день</option><option value="weekdays">Рабочие / выбранные дни</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option><option value="intervalWeeks">Каждые N недель</option></Select></Field>{repeatFrequency === "intervalWeeks" ? <Field label="Интервал недель"><Input min="1" name="repeatIntervalWeeks" type="number" defaultValue={payload.repeat?.intervalWeeks ?? 2} /></Field> : null}{!["daily", "monthly"].includes(repeatFrequency) ? <div className="task-form-weekdays">{WEEKDAYS.map((day) => <button className={repeatWeekdays.includes(day.id) ? "is-active" : ""} key={day.id} type="button" onClick={() => { markDirty(); setRepeatWeekdays((current) => current.includes(day.id) ? current.filter((id) => id !== day.id) : [...current, day.id].sort()); }}>{day.label}</button>)}</div> : null}</> : null}
          <SwitchRow description="Показывать задачу в определённое время" label="Указать время"><Switch checked={hasTime} name="hasTime" value="on" onChange={(event) => { markDirty(); setHasTime(event.target.checked); }} /></SwitchRow>
          <div className="task-editor-grid">{hasTime ? <Field label="Время выполнения"><Input name="dueTime" type="time" defaultValue={getTaskDueTime(task)} /></Field> : <div />}<Field label="Плановое время, мин"><Input min="0" name="estimateMinutes" type="number" defaultValue={getTaskEstimateMinutes(task) || ""} /></Field></div>
          {task?.isVirtualOccurrence || isTaskRepeating(task) ? <Field label="Применить изменения"><Select name="applyScope" defaultValue="future"><option value="single">Только выбранный день</option><option value="future">К шаблону и последующим</option></Select></Field> : null}
        </section>
      </div>
      <EditorFooter isEditing={isEditing} saving={saving} onCancel={onCancel} />
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
