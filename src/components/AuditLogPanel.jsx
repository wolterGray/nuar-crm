import {useCallback, useEffect, useMemo, useState} from "react";
import {fetchAuditLogs} from "../api/auditLogs.js";
import {AppIcon, Button, Input, Select} from "./ui/index.js";

const ENTITY_LABELS = {
  calendarEntry: "Запись календаря",
  certificate: "Сертификат",
  client: "Клиент",
  employee: "Сотрудник",
  package: "Пакет",
  service: "Услуга",
  settings: "Настройки",
  visit: "Визит",
};

const ACTION_LABELS = {
  create: "Создано",
  delete: "Удалено",
  update: "Изменено",
};

const getActionLabel = (action = "") => {
  const tail = String(action).split(".").at(-1)?.toLowerCase();
  return ACTION_LABELS[tail] || String(action).replaceAll("_", " ");
};

const getEntityLabel = (entity = "") => ENTITY_LABELS[entity] || entity || "Объект";

const getChangedKeys = (before, after) => {
  const left = before && typeof before === "object" ? before : {};
  const right = after && typeof after === "object" ? after : {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .slice(0, 8);
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function AuditLogPanel() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({append = false, nextCursor = null} = {}) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAuditLogs({cursor: nextCursor, entity, search});
      setItems((current) => append ? [...current, ...(result.items || [])] : (result.items || []));
      setCursor(result.nextCursor || null);
    } catch (loadError) {
      setError(loadError.message || "Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [entity, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const entityOptions = useMemo(() => [
    ["", "Все разделы"],
    ...Object.entries(ENTITY_LABELS).map(([value, label]) => [value, label]),
  ], []);

  return (
    <div className="audit-log-panel flex flex-col gap-3.5">
      <div className="audit-log-toolbar flex flex-col sm:flex-row gap-2">
        <div
          className="flex flex-1 gap-2"
        >
          <Input
            aria-label="Поиск по истории"
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setSearch(searchDraft.trim());
              }
            }}
            placeholder="Действие, объект или сотрудник"
            value={searchDraft}
          />
          <Button onClick={() => setSearch(searchDraft.trim())} size="sm" type="button" variant="secondary">Найти</Button>
        </div>
        <Select aria-label="Раздел истории" onChange={(event) => setEntity(event.target.value)} value={entity}>
          {entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Button disabled={loading} onClick={() => load()} size="sm" type="button" variant="ghost">
          <AppIcon name="refresh" size="sm" />
          Обновить
        </Button>
      </div>

      {error ? <div className="audit-log-error">{error}</div> : null}
      {!loading && !items.length && !error ? (
        <div className="audit-log-empty">Изменений по выбранным условиям нет.</div>
      ) : null}

      <div className="audit-log-list">
        {items.map((item) => {
          const changedKeys = getChangedKeys(item.before, item.after);
          const expanded = expandedId === item.id;
          return (
            <article className="audit-log-row" key={item.id}>
              <button className="audit-log-row-main" onClick={() => setExpandedId(expanded ? null : item.id)} type="button">
                <span className="audit-log-icon"><AppIcon name="history" size="sm" /></span>
                <span className="audit-log-copy">
                  <strong>{getActionLabel(item.action)} · {getEntityLabel(item.entity)}</strong>
                  <small>{item.actor?.name || item.actor?.email || item.actorId || "Система"}{item.entityId ? ` · #${item.entityId}` : ""}</small>
                </span>
                <time>{new Date(item.createdAt).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"})}</time>
                <AppIcon className={expanded ? "audit-log-chevron is-open" : "audit-log-chevron"} name="chevronDown" size="sm" />
              </button>
              {expanded ? (
                <div className="audit-log-details">
                  {changedKeys.length ? changedKeys.map((key) => (
                    <div className="audit-log-change" key={key}>
                      <b>{key}</b>
                      <span>{formatValue(item.before?.[key])}</span>
                      <AppIcon name="arrowRight" size="xs" />
                      <span>{formatValue(item.after?.[key])}</span>
                    </div>
                  )) : <span>Технические детали изменения отсутствуют.</span>}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {cursor ? (
        <Button disabled={loading} onClick={() => load({append: true, nextCursor: cursor})} type="button" variant="secondary">
          {loading ? "Загрузка..." : "Показать более ранние"}
        </Button>
      ) : null}
    </div>
  );
}
