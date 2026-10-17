import {useMemo, useState} from "react";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import AppIcon from "../ui/AppIcon.jsx";
import {formatMoney} from "../../utils/formatters.jsx";
import {
  formatDuration,
  getInputDate,
  getTimeMinutes,
  getVisitEndMinutes,
} from "../../utils/todayFormat.js";
import "./TodayMobile.css";

const FINISHED_STATUSES = ["completed", "cancelled", "no_show"];
const MAX_VISIBLE_SLOTS = 3;

const capitalize = (value) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const formatDateLine = (value, realToday) => {
  const date = new Date(`${value}T12:00:00`);
  const weekday = capitalize(new Intl.DateTimeFormat("ru-RU", {weekday: "long"}).format(date));
  const withYear = value.slice(0, 4) !== realToday.slice(0, 4);
  const dayMonth = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(withYear ? {year: "numeric"} : {}),
  }).format(date);

  return `${weekday}, ${dayMonth}`;
};

const formatTitle = (value, realToday) => {
  if (value === realToday) return "Сегодня";
  const diffDays = Math.round(
    (new Date(`${value}T12:00:00`) - new Date(`${realToday}T12:00:00`)) / 86400000,
  );
  if (diffDays === 1) return "Завтра";
  if (diffDays === -1) return "Вчера";

  return new Intl.DateTimeFormat("ru-RU", {day: "numeric", month: "long"}).format(
    new Date(`${value}T12:00:00`),
  );
};

const STATUS_LABELS = {
  confirmed: "Подтверждён",
  completed: "Завершён",
  in_progress: "Идет сейчас",
  needs_closing: "Не закрыт",
  scheduled: "Запланирован",
};

const getVisitStatus = (entry, isRealToday, nowMinutes) => {
  const status = String(entry.status ?? "scheduled") || "scheduled";
  if (status === "completed") return "completed";
  if (isRealToday) {
    const start = getTimeMinutes(entry.time ?? entry.startTime);
    const end = getVisitEndMinutes(entry);
    if (nowMinutes >= end) return "needs_closing";
    if (nowMinutes >= start) return "in_progress";
  }

  return status === "confirmed" ? "confirmed" : "scheduled";
};

const getEndTime = (entry) => {
  const end = getVisitEndMinutes(entry);

  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};

const getVisitId = (entry) => entry.id ?? `${entry.time}-${entry.client}`;

const formatVisitDuration = (minutes) => {
  const m = Number(minutes) || 0;
  if (!m) return "";
  if (m === 60) return "1 час";
  if (m === 90) return "1.5 часа";
  if (m === 120) return "2 часа";
  if (m < 60) return `${m} мин`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${hours}ч ${rem}м` : `${hours}ч`;
};

const getClientTag = (entry, clientProfiles = []) => {
  if (entry.clientTag) return entry.clientTag;
  if (!entry.client) return null;
  const nameNorm = String(entry.client).trim().toLowerCase();
  const phoneDigits = String(entry.clientPhone || entry.phone || entry.client || "").replace(/\D/g, "");
  const profile = clientProfiles.find((c) => {
    if (entry.clientId && String(c.id) === String(entry.clientId)) return true;
    if (c.name && String(c.name).trim().toLowerCase() === nameNorm) return true;
    if (phoneDigits && phoneDigits.length >= 7 && c.phone) {
      const cPhone = String(c.phone).replace(/\D/g, "");
      if (cPhone.endsWith(phoneDigits.slice(-9)) || phoneDigits.endsWith(cPhone.slice(-9))) return true;
    }
    return false;
  });

  if (profile) {
    if (profile.isVip) return "VIP клиент";
    if (profile.segment) return profile.segment;
    if (profile.category) return profile.category;
    if (profile.status && !["active", "активный"].includes(String(profile.status).toLowerCase())) {
      return profile.status;
    }
    const count = Number(profile.totalVisits ?? profile.visitsCount ?? 0);
    return count <= 1 ? "Новый клиент" : "Постоянный клиент";
  }

  if (/^\+?\d{8,}$/.test(String(entry.client).replace(/\s/g, ""))) {
    return "Новый клиент";
  }

  return null;
};

const getAttentionSummaryText = (items) => {
  if (!items.length) return "";
  const counts = {clients: 0, finance: 0, tasks: 0, visits: 0};
  items.forEach((item) => {
    if (item.type === "unclosed_visit" || item.action === "calendar") {
      counts.visits += 1;
    } else if (item.type === "birthday" || item.action === "clients") {
      counts.clients += 1;
    } else if (item.type === "finance" || item.action === "payments") {
      counts.finance += 1;
    } else {
      counts.tasks += 1;
    }
  });

  const parts = [];
  if (counts.visits > 0) {
    const v = counts.visits;
    parts.push(`${v} ${v === 1 ? "визит" : v < 5 ? "визита" : "визитов"}`);
  }
  if (counts.clients > 0) {
    const c = counts.clients;
    parts.push(`${c} ${c === 1 ? "новый клиент" : c < 5 ? "новых клиента" : "новых клиентов"}`);
  }
  if (counts.finance > 0) {
    const f = counts.finance;
    parts.push(`${f} ${f === 1 ? "оплата" : f < 5 ? "оплаты" : "оплат"}`);
  }
  if (counts.tasks > 0) {
    const t = counts.tasks;
    parts.push(`${t} ${t === 1 ? "задача" : t < 5 ? "задачи" : "задач"}`);
  }

  return parts.length ? parts.join(" • ") : `${items.length} вопросов`;
};

function SlotRow({ onClick, slot }) {
  return (
    <button className="tm-slot-card" type="button" onClick={onClick}>
      <AppIcon className="tm-slot-icon" name="clock" size="sm" />
      <strong className="tm-slot-range">
        {slot.startTime} – {slot.endTime}
      </strong>
      <span className="tm-slot-master" title={slot.master}>
        {slot.master}
      </span>
      <span className="tm-slot-duration">{formatDuration(slot.durationMinutes)}</span>
      <AppIcon className="tm-slot-chevron" name="chevronRight" size="xs" />
    </button>
  );
}

function TodayMobile({
  clientProfiles = [],
  dashboard,
  formatIncome,
  freeMinutes,
  freeSlots,
  onAddVisit,
  onChangeDate,
  onEditVisit,
  onOpenCalendar,
  onOpenClients,
  onOpenOperations,
  onOpenPayments,
  onRemindVisit,
  openVisitMenuId,
  openVisitMenuRef,
  selectedDate,
  selectedEmployees,
  setOpenVisitMenuId,
  setSelectedEmployees,
}) {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const realToday = getInputDate();
  const isRealToday = selectedDate === realToday;
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const employeeOptions = useMemo(() => {
    const names = [
      ...dashboard.todayVisits.map((entry) => entry.master),
      ...dashboard.allFreeSlots.map((slot) => slot.master),
    ]
      .map((name) => String(name ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set(names));
  }, [dashboard.allFreeSlots, dashboard.todayVisits]);

  const visits = selectedEmployees.length
    ? dashboard.todayVisits.filter((entry) => selectedEmployees.includes(entry.master))
    : dashboard.todayVisits;

  const nextVisitId = useMemo(() => {
    const now = new Date();
    const currentMinutes = isRealToday ? now.getHours() * 60 + now.getMinutes() : -1;
    const candidate = visits
      .filter((entry) => !FINISHED_STATUSES.includes(String(entry.status ?? "")))
      .filter((entry) => getVisitEndMinutes(entry) > currentMinutes)
      .sort(
        (first, second) =>
          getTimeMinutes(first.time ?? first.startTime) -
          getTimeMinutes(second.time ?? second.startTime),
      )[0];

    return candidate ? getVisitId(candidate) : null;
  }, [isRealToday, visits]);

  const attentionItems = dashboard.actionItems;
  const attentionSummary = useMemo(
    () => getAttentionSummaryText(attentionItems),
    [attentionItems],
  );

  const openActionItem = (item) => {
    if (item.type === "unclosed_visit" && item.entityId) {
      const entry = dashboard.unclosedPastVisits.find((visit) => visit.id === item.entityId);
      if (entry) {
        onEditVisit?.(entry);
        return;
      }
    }
    if (item.action === "payments") return onOpenPayments?.();
    if (item.action === "clients") return onOpenClients?.();
    if (item.action === "operations") return onOpenOperations?.();

    return onOpenCalendar?.();
  };

  const toggleEmployee = (employee) => {
    setSelectedEmployees((current) =>
      current.length === 1 && current[0] === employee ? [] : [employee],
    );
  };

  const bookSlot = (slot) =>
    onAddVisit?.({
      date: selectedDate,
      duration: Math.min(60, Number(slot.durationMinutes) || 60),
      master: slot.master,
      time: slot.startTime,
    });

  const upcomingSlots = useMemo(
    () =>
      freeSlots
        .filter((slot) => !isRealToday || getTimeMinutes(slot.endTime) > nowMinutes)
        .sort(
          (first, second) =>
            getTimeMinutes(first.startTime) - getTimeMinutes(second.startTime) ||
            String(first.master).localeCompare(String(second.master), "ru"),
        ),
    [freeSlots, isRealToday, nowMinutes],
  );
  const visibleSlots = upcomingSlots.slice(0, MAX_VISIBLE_SLOTS);
  const mastersWithSlots = new Set(freeSlots.map((slot) => slot.master)).size;

  const completedVisits = dashboard.snapshot.completedVisits || 0;
  const scheduledVisits = dashboard.snapshot.scheduledVisits || 0;
  const visitsProgress = scheduledVisits > 0 ? Math.min(100, Math.round((completedVisits / scheduledVisits) * 100)) : 0;

  return (
    <section className="tm-page">
      <header className="tm-header">
        <div className="tm-heading">
          <h1>{formatTitle(selectedDate, realToday)}</h1>
          <p>
            <span>{formatDateLine(selectedDate, realToday)}</span>
            {!isRealToday ? (
              <button className="tm-today-reset" type="button" onClick={() => onChangeDate(0, realToday)}>
                К сегодня
              </button>
            ) : null}
          </p>
        </div>
        <div className="tm-header-actions">
          <label className="tm-icon-btn tm-date-picker" title="Выбрать дату">
            <AppIcon name="calendarDays" size="md" />
            <input
              aria-label="Выбранная дата"
              type="date"
              value={selectedDate}
              onChange={(event) => onChangeDate(0, event.target.value)}
            />
          </label>
          <div className="tm-bell">
            <PageNotificationsSlot />
          </div>
        </div>
      </header>

      <button className="tm-cta" type="button" onClick={() => onAddVisit?.({date: selectedDate})}>
        <AppIcon name="plus" size="md" />
        <span>Новый визит</span>
      </button>

      <section className="tm-metrics-grid" aria-label="Показатели дня">
        {/* Карточка 1: Проведено визитов с прогресс-баром */}
        <button className="tm-metric-card" type="button" onClick={onOpenCalendar}>
          <div className="tm-metric-val">
            <strong>{completedVisits}</strong>
            <span className="tm-metric-slash">/ {scheduledVisits}</span>
          </div>
          <div className="tm-metric-body">
            <div className="tm-metric-labels">
              <span className="tm-metric-label-main">Проведено</span>
              <span className="tm-metric-label-sub">из запланированных</span>
            </div>
            <div className="tm-metric-progress">
              <div
                className="tm-metric-progress-fill"
                style={{width: `${visitsProgress}%`}}
              />
            </div>
          </div>
        </button>

        {/* Карточка 2: Получено сегодня с иконкой колонок */}
        <button className="tm-metric-card" type="button" onClick={onOpenPayments}>
          <div className="tm-metric-val">
            <strong>{formatIncome(dashboard.snapshot.received)}</strong>
          </div>
          <div className="tm-metric-body">
            <div className="tm-metric-bottom-row">
              <div className="tm-metric-labels">
                <span className="tm-metric-label-main">Получено</span>
                <span className="tm-metric-label-sub">сегодня</span>
              </div>
              <span className="tm-metric-icon" aria-hidden="true">
                <svg fill="none" height="12" viewBox="0 0 14 12" width="14">
                  <rect fill="currentColor" height="5" rx="1" width="2.5" x="1" y="7" />
                  <rect fill="currentColor" height="8.5" rx="1" width="2.5" x="5.75" y="3.5" />
                  <rect fill="currentColor" height="12" rx="1" width="2.5" x="10.5" y="0" />
                </svg>
              </span>
            </div>
          </div>
        </button>

        {/* Карточка 3: Свободное время с иконкой часов */}
        <div className="tm-metric-card is-static">
          <div className="tm-metric-val">
            <strong>{formatDuration(freeMinutes)}</strong>
          </div>
          <div className="tm-metric-body">
            <div className="tm-metric-bottom-row">
              <div className="tm-metric-labels">
                <span className="tm-metric-label-main">Свободно</span>
                <span className="tm-metric-label-sub">{mastersWithSlots > 1 ? "в среднем" : "сегодня"}</span>
              </div>
              <span className="tm-metric-icon" aria-hidden="true">
                <AppIcon name="clock" size="xs" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {attentionItems.length ? (
        <section className={`tm-attention ${attentionOpen ? "is-open" : ""}`}>
          <button
            aria-expanded={attentionOpen}
            className="tm-attention-head"
            type="button"
            onClick={() => setAttentionOpen((open) => !open)}
          >
            <span className="tm-attention-badge" aria-hidden="true">
              <span className="tm-attention-dot" />
            </span>
            <span className="tm-attention-copy">
              <strong>Требует внимания</strong>
              <small>{attentionSummary}</small>
            </span>
            <AppIcon className="tm-chevron" name={attentionOpen ? "chevronUp" : "chevronRight"} size="xs" />
          </button>
          {attentionOpen ? (
            <ul className="tm-attention-list">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => openActionItem(item)}>
                    <span className={`tm-attention-mark is-${item.priority}`} aria-hidden="true" />
                    <span className="tm-attention-item-copy">
                      <strong>{item.title}</strong>
                      {item.message ? <small>{item.message}</small> : null}
                    </span>
                    <AppIcon className="tm-chevron" name="chevronRight" size="xs" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="tm-all-clear">Всё под контролем — срочных дел нет</p>
      )}

      <section className="tm-section" aria-label="Расписание">
        <header className="tm-section-head">
          <div className="tm-section-title-wrap">
            <h2>Расписание</h2>
            {dashboard.todayVisits.length ? (
              <span className="tm-count">{dashboard.todayVisits.length}</span>
            ) : null}
          </div>
          <button className="tm-link" type="button" onClick={onOpenCalendar}>
            Календарь
            <AppIcon name="chevronRight" size="xs" />
          </button>
        </header>

        {employeeOptions.length > 1 ? (
          <div className="tm-chips" role="group" aria-label="Фильтр по мастерам">
            <button
              className={`tm-chip ${selectedEmployees.length ? "" : "is-active"}`}
              type="button"
              onClick={() => setSelectedEmployees([])}
            >
              Все
            </button>
            {employeeOptions.map((employee) => (
              <button
                className={`tm-chip ${selectedEmployees.includes(employee) ? "is-active" : ""}`}
                key={employee}
                type="button"
                onClick={() => toggleEmployee(employee)}
              >
                {employee}
              </button>
            ))}
          </div>
        ) : null}

        {visits.length ? (
          <div className="tm-schedule-list">
            {visits.map((entry) => {
              const id = getVisitId(entry);
              const menuOpen = openVisitMenuId === id;
              const status = getVisitStatus(entry, isRealToday, nowMinutes);
              const isNextOrCurrent = status === "in_progress" || id === nextVisitId;

              const clientName = entry.client || "Без клиента";
              const serviceName = entry.service || "Визит";

              const clientTag = getClientTag(entry, clientProfiles);
              const durationMinutes = Number(entry.duration) || (getVisitEndMinutes(entry) - getTimeMinutes(entry.time ?? entry.startTime));
              const durationLabel = formatVisitDuration(durationMinutes);

              const detailParts = [];
              if (clientTag) detailParts.push(clientTag);
              if (durationLabel) detailParts.push(durationLabel);
              if (!clientTag && entry.master && selectedEmployees.length === 0) {
                detailParts.push(entry.master);
              }
              const detailsLine = detailParts.join(" • ") || entry.master || "";

              return (
                <article
                  className={`tm-visit-card is-${status} ${isNextOrCurrent ? "is-next" : ""}`}
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEditVisit?.(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEditVisit?.(entry);
                    }
                  }}
                >
                  <div className="tm-visit-time">
                    <strong>{entry.time}</strong>
                    <small>{getEndTime(entry)}</small>
                  </div>
                  <div className="tm-visit-main">
                    <strong title={clientName}>{clientName}</strong>
                    <span className="tm-visit-service" title={serviceName}>
                      {serviceName}
                    </span>
                    {detailsLine ? (
                      <small className="tm-visit-details" title={detailsLine}>
                        {detailsLine}
                      </small>
                    ) : null}
                  </div>
                  <div className="tm-visit-side">
                    <div className="tm-visit-side-top">
                      <span className={`tm-status-pill is-${status}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <div
                        className="tm-visit-menu"
                        ref={menuOpen ? openVisitMenuRef : null}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          aria-label="Действия с визитом"
                          className="tm-menu-trigger"
                          type="button"
                          onClick={() => setOpenVisitMenuId(menuOpen ? null : id)}
                        >
                          <AppIcon name="moreVertical" size="sm" />
                        </button>
                        {menuOpen ? (
                          <div className="tm-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenVisitMenuId(null);
                                onRemindVisit?.(entry);
                              }}
                            >
                              <AppIcon name="message" size="sm" />
                              Написать
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenVisitMenuId(null);
                                onEditVisit?.(entry);
                              }}
                            >
                              <AppIcon name="edit" size="sm" />
                              Редактировать
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {entry.amount ? (
                      <strong className="tm-visit-price">{formatMoney(entry.amount)}</strong>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="tm-empty">
            {selectedEmployees.length ? "У выбранного мастера визитов нет" : "Визитов нет"}
            <button type="button" onClick={() => onAddVisit?.({date: selectedDate})}>
              Добавить
            </button>
          </p>
        )}
      </section>

      <section className="tm-section" aria-label="Свободные окна">
        <header className="tm-section-head">
          <h2>Свободные окна</h2>
          {upcomingSlots.length > 0 ? (
            <button className="tm-link" type="button" onClick={() => setSlotsOpen(true)}>
              Все {upcomingSlots.length}
              <AppIcon name="chevronRight" size="xs" />
            </button>
          ) : null}
        </header>
        {visibleSlots.length ? (
          <div className="tm-slots-list">
            {visibleSlots.map((slot) => (
              <SlotRow key={`${slot.master}-${slot.startTime}`} slot={slot} onClick={() => bookSlot(slot)} />
            ))}
          </div>
        ) : (
          <p className="tm-empty">{isRealToday ? "Свободных окон на сегодня нет" : "Свободных окон нет"}</p>
        )}
      </section>

      {slotsOpen ? (
        <div className="tm-sheet-backdrop" onClick={() => setSlotsOpen(false)}>
          <div
            aria-label="Свободные окна"
            aria-modal="true"
            className="tm-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="tm-sheet-head">
              <h2>Свободные окна · {upcomingSlots.length}</h2>
              <button aria-label="Закрыть" className="tm-sheet-close" type="button" onClick={() => setSlotsOpen(false)}>
                <AppIcon name="x" size="md" />
              </button>
            </header>
            <div className="tm-sheet-body tm-slots-list">
              {upcomingSlots.map((slot) => (
                <SlotRow
                  key={`${slot.master}-${slot.startTime}`}
                  slot={slot}
                  onClick={() => {
                    setSlotsOpen(false);
                    bookSlot(slot);
                  }}
                />
              ))}
            </div>
            <button
              className="tm-sheet-calendar"
              type="button"
              onClick={() => {
                setSlotsOpen(false);
                onOpenCalendar?.();
              }}
            >
              Открыть календарь
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TodayMobile;
