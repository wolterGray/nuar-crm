import {useMemo, useState} from "react";
import {
  getTaskAreaId,
  getTaskAreaLabel,
  getTaskAssigneeName,
  getTaskPayload,
  getTaskResultFields,
  getWarsawTodayInput,
} from "../utils/operationsPlanner.js";
import {AppIcon, Button, IconButton, Input, Select} from "./ui/index.js";
import "./OperationsHistory.css";

const STATUS_LABELS = {
  active: "В работе",
  cancelled: "Пропущена",
  completed: "Выполнена",
};

const pad = (value) => String(value).padStart(2, "0");

const shiftDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
};

const formatDate = (date) => new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(`${date}T12:00:00Z`));

const getRecordStatus = (record) => {
  if (record?.status === "completed") return "completed";
  if (record?.status === "cancelled") return "cancelled";
  return "active";
};

const getChecklistProgress = (record) => {
  const checklist = Array.isArray(record?.checklist) ? record.checklist : [];
  return {done: checklist.filter((item) => item.done === true).length, total: checklist.length};
};

const hasMeaningfulRecord = (record) => {
  const checklist = Array.isArray(record?.checklist) ? record.checklist : [];
  return Boolean(
    record?.status ||
    record?.completedAt ||
    String(record?.comment ?? "").trim() ||
    checklist.some((item) => item.done === true) ||
    Object.values(record?.results ?? {}).some((value) => String(value ?? "").trim() !== ""),
  );
};

const formatResultValue = (value, unit) => {
  if (value === "" || value === null || value === undefined) return "Не заполнено";
  return `${value}${unit ? ` ${unit}` : ""}`;
};

const getResultPreview = (entry) => {
  const fields = getTaskResultFields(entry.task);
  const values = entry.record.results ?? {};
  const parts = fields
    .filter((field) => String(values[field.id] ?? "").trim() !== "")
    .slice(0, 2)
    .map((field) => `${field.label || "Результат"}: ${formatResultValue(values[field.id], field.unit)}`);
  if (parts.length) return parts.join(" · ");
  return entry.record.comment || "Результаты не заполнены";
};

function HistoryDetails({entry, onClose}) {
  if (!entry) return null;
  const {date, record, task} = entry;
  const checklist = Array.isArray(record.checklist) ? record.checklist : [];
  const resultFields = getTaskResultFields(task);
  const knownIds = new Set(resultFields.map((field) => field.id));
  const extraResults = Object.entries(record.results ?? {}).filter(([id]) => !knownIds.has(id));
  const progress = getChecklistProgress(record);

  return <div className="operations-history-drawer-layer">
    <button aria-label="Закрыть историю" className="operations-history-backdrop" type="button" onClick={onClose} />
    <aside className="operations-history-drawer" aria-label="История выполнения задачи">
      <header>
        <div><span>{getTaskAreaLabel(task)}</span><h2>{task.title}</h2></div>
        <IconButton icon="x" label="Закрыть" variant="ghost" onClick={onClose} />
      </header>
      <div className="operations-history-drawer-body">
        <div className="operations-history-detail-meta">
          <span><AppIcon name="calendar" size="xs" />{formatDate(date)}</span>
          <span className={`is-${getRecordStatus(record)}`}>{STATUS_LABELS[getRecordStatus(record)]}</span>
          <span>{getTaskAssigneeName(task) || "Без исполнителя"}</span>
        </div>

        <section>
          <div className="operations-history-section-title"><h3>Выполненные действия</h3><span>{progress.done} из {progress.total}</span></div>
          {checklist.length ? <div className="operations-history-checklist">
            {checklist.map((item, index) => <div className={item.done ? "is-done" : ""} key={item.id ?? index}>
              <span className="operations-history-checkmark"><AppIcon name={item.done ? "check" : "minus"} size="xs" /></span>
              <span>{item.text || "Без названия"}</span>
            </div>)}
          </div> : <p className="operations-history-muted">В этой задаче не было чек-листа.</p>}
        </section>

        <section>
          <div className="operations-history-section-title"><h3>Результаты</h3></div>
          {resultFields.length || extraResults.length ? <div className="operations-history-results">
            {resultFields.map((field) => <div key={field.id}><span>{field.label || "Результат"}</span><strong>{formatResultValue(record.results?.[field.id], field.unit)}</strong></div>)}
            {extraResults.map(([id, value]) => <div key={id}><span>{id}</span><strong>{formatResultValue(value)}</strong></div>)}
          </div> : <p className="operations-history-muted">Показатели не были настроены.</p>}
        </section>

        <section>
          <div className="operations-history-section-title"><h3>Вывод за день</h3></div>
          <p className="operations-history-comment">{record.comment || "Комментарий не оставлен."}</p>
        </section>
      </div>
    </aside>
  </div>;
}

export default function OperationsHistory({tasks}) {
  const today = getWarsawTodayInput();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("all");
  const [dateFrom, setDateFrom] = useState(shiftDate(today, -29));
  const [dateTo, setDateTo] = useState(today);
  const [selected, setSelected] = useState(null);

  const entries = useMemo(() => tasks.flatMap((task) => {
    const occurrences = getTaskPayload(task).occurrences ?? {};
    return Object.entries(occurrences)
      .filter(([, record]) => hasMeaningfulRecord(record))
      .map(([date, record]) => ({date, record, task}));
  }).sort((left, right) => right.date.localeCompare(left.date)), [tasks]);

  const areas = useMemo(() => {
    const values = new Map();
    tasks.forEach((task) => values.set(getTaskAreaId(task), getTaskAreaLabel(task)));
    return [...values].sort((left, right) => left[1].localeCompare(right[1], "ru"));
  }, [tasks]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return entries.filter((entry) => {
      const entryStatus = getRecordStatus(entry.record);
      const haystack = `${entry.task.title} ${getTaskAreaLabel(entry.task)} ${entry.record.comment ?? ""}`.toLocaleLowerCase("ru");
      return entry.date >= dateFrom && entry.date <= dateTo &&
        (status === "all" || entryStatus === status) &&
        (area === "all" || getTaskAreaId(entry.task) === area) &&
        (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [area, dateFrom, dateTo, entries, query, status]);

  const stats = useMemo(() => {
    const completed = filtered.filter(({record}) => getRecordStatus(record) === "completed").length;
    const skipped = filtered.filter(({record}) => getRecordStatus(record) === "cancelled").length;
    const actions = filtered.reduce((total, {record}) => {
      const progress = getChecklistProgress(record);
      return {done: total.done + progress.done, total: total.total + progress.total};
    }, {done: 0, total: 0});
    return {actions, completed, progress: filtered.length ? Math.round((completed / filtered.length) * 100) : 0, skipped};
  }, [filtered]);

  const applyPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === "7") setDateFrom(shiftDate(today, -6));
    if (nextPeriod === "30") setDateFrom(shiftDate(today, -29));
    if (nextPeriod === "month") setDateFrom(`${today.slice(0, 7)}-01`);
    if (nextPeriod !== "all") setDateTo(today);
    if (nextPeriod === "all") {
      setDateFrom(entries.at(-1)?.date ?? today);
      setDateTo(entries[0]?.date ?? today);
    }
  };

  return <>
    <section className="operations-history-page">
      <div className="operations-history-summary">
        <div><span>Выполнено</span><strong>{stats.completed}</strong><small>из {filtered.length} записей</small></div>
        <div><span>Прогресс</span><strong>{stats.progress}%</strong><small>за выбранный период</small></div>
        <div><span>Действия</span><strong>{stats.actions.done}/{stats.actions.total}</strong><small>пунктов чек-листа</small></div>
        <div><span>Пропущено</span><strong>{stats.skipped}</strong><small>требуют внимания</small></div>
      </div>

      <div className="operations-history-toolbar">
        <div className="operations-history-presets">
          {[['7', '7 дней'], ['30', '30 дней'], ['month', 'Месяц'], ['all', 'Всё время']].map(([id, label]) => <button className={period === id ? "is-active" : ""} key={id} type="button" onClick={() => applyPeriod(id)}>{label}</button>)}
        </div>
        <div className="operations-history-dates">
          <Input aria-label="Начало периода" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPeriod("custom"); }} />
          <span>—</span>
          <Input aria-label="Конец периода" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPeriod("custom"); }} />
        </div>
      </div>

      <div className="operations-history-filters">
        <div className="operations-history-search"><AppIcon name="search" size="sm" /><Input placeholder="Поиск по задаче или выводу" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select value={area} onChange={(event) => setArea(event.target.value)}><option value="all">Все направления</option>{areas.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option><option value="completed">Выполненные</option><option value="active">В работе</option><option value="cancelled">Пропущенные</option></Select>
      </div>

      <div className="operations-history-list">
        <div className="operations-history-list-head"><span>Дата</span><span>Задача</span><span>Направление</span><span>Действия</span><span>Статус</span></div>
        {filtered.map((entry) => {
          const progress = getChecklistProgress(entry.record);
          const entryStatus = getRecordStatus(entry.record);
          return <button className="operations-history-row" key={`${entry.task.id}-${entry.date}`} type="button" onClick={() => setSelected(entry)}>
            <span className="operations-history-date">{formatDate(entry.date)}</span>
            <span className="operations-history-task"><strong>{entry.task.title}</strong><small>{getResultPreview(entry)}</small></span>
            <span>{getTaskAreaLabel(entry.task)}</span>
            <span>{progress.done}/{progress.total}</span>
            <span className={`operations-history-status is-${entryStatus}`}>{STATUS_LABELS[entryStatus]}</span>
          </button>;
        })}
        {!filtered.length ? <div className="operations-history-empty"><AppIcon name="clipboardCheck" size="lg" /><strong>Записей не найдено</strong><span>Измените период или фильтры.</span><Button size="sm" variant="secondary" onClick={() => { setQuery(""); setArea("all"); setStatus("all"); applyPeriod("all"); }}>Показать всю историю</Button></div> : null}
      </div>
    </section>
    <HistoryDetails entry={selected} onClose={() => setSelected(null)} />
  </>;
}
