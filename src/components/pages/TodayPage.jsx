import { useEffect, useMemo, useRef, useState } from "react";
import { PageNotificationsSlot } from "../PageNotifications.jsx";
import { buildTodayDashboard } from "../../utils/todayDashboard.js";
import AppIcon from "../ui/AppIcon.jsx";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import IconButton from "../ui/IconButton.jsx";
import { formatCompactMoney, formatMoney } from "../../utils/formatters.jsx";
import "./TodayPage.css";

const visitStatusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
};

const toneStyles = {
  visits: "visits",
  income: "income",
  upcoming: "upcoming",
  debt: "debt",
};

const visitToneClasses = [
  "is-rose",
  "is-amber",
  "is-violet",
  "is-gold",
  "is-green",
];

function TodayKpiCard({ helper, icon, label, onClick, tone, value }) {
  const styles = toneStyles[tone] || toneStyles.upcoming;

  return (
    <button className={`today-kpi-card ${onClick ? "is-actionable" : ""}`} data-tone={styles} disabled={!onClick} type="button" onClick={onClick}>
      <div className="today-kpi-icon">
        <AppIcon name={icon} size="md" />
      </div>
      <div className="today-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
      {onClick ? <AppIcon className="today-kpi-chevron" name="chevronRight" size="sm" /> : null}
    </button>
  );
}

function TodayReferenceBoard({
  dashboard,
  formatIncome,
  freeMinutes,
  onAddVisit,
  onEditVisit,
  onOpenCalendar,
  onOpenClients,
  onOpenOperations,
  onOpenPayments,
  onRemindVisit,
  openVisitMenuId,
  openVisitMenuRef,
  selectedEmployees,
  selectedDate,
  selectedVisitId,
  setSelectedEmployees,
  setSelectedVisitId,
  setOpenVisitMenuId,
  onChangeDate,
}) {
  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          dashboard.todayVisits
            .map((entry) => String(entry.master ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [dashboard.todayVisits],
  );
  const filteredVisits = selectedEmployees.length
    ? dashboard.todayVisits.filter((entry) => selectedEmployees.includes(entry.master))
    : dashboard.todayVisits;
  const getVisitId = (entry) => entry.id ?? `${entry.time}-${entry.client}`;
  const visitToneById = useMemo(
    () =>
      new Map(
        dashboard.todayVisits.map((entry, index) => [
          getVisitId(entry),
          visitToneClasses[index % visitToneClasses.length],
        ]),
      ),
    [dashboard.todayVisits],
  );
  const toggleEmployee = (employee) => {
    setSelectedEmployees((current) =>
      current.length === 1 && current[0] === employee ? [] : [employee],
    );
  };
  const selectedVisit =
    dashboard.todayVisits.find(
      (entry) => getVisitId(entry) === selectedVisitId,
    ) ?? null;
  const nearestScheduleVisit = useMemo(() => {
    if (!filteredVisits.length) return null;

    const now = new Date();
    const actualToday = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const currentMinutes = dashboard.today === actualToday ? now.getHours() * 60 + now.getMinutes() : -1;

    return (
      filteredVisits
        .filter((entry) => !["completed", "cancelled", "no_show"].includes(String(entry.status ?? "")))
        .filter((entry) => getVisitEndMinutes(entry) > currentMinutes)
        .sort((first, second) => getTimeMinutes(first.time ?? first.startTime) - getTimeMinutes(second.time ?? second.startTime))[0] ??
      null
    );
  }, [dashboard.today, filteredVisits]);
  const nextVisit = selectedVisit ?? nearestScheduleVisit;
  const activeVisitId = selectedVisit
    ? getVisitId(selectedVisit)
    : nearestScheduleVisit
      ? getVisitId(nearestScheduleVisit)
      : null;
  const nextVisitTone = nextVisit
    ? visitToneById.get(getVisitId(nextVisit)) ?? "is-gold"
    : "is-gold";
  const openActionItem = (item) => {
    if (item.action === "payments") {
      onOpenPayments?.();
      return;
    }
    if (item.action === "clients") {
      onOpenClients?.();
      return;
    }
    if (item.action === "operations") {
      onOpenOperations?.();
      return;
    }
    onOpenCalendar?.();
  };

  return (
    <section className="today-board">
      <header className="today-board-header">
        <div className="today-board-title">
          <div className="today-board-title-main">
            <h1>Сегодня</h1>
            <span>{formatTodayHeading(dashboard.today)}</span>
          </div>
          <div className="today-date-controls">
            <IconButton icon="chevronLeft" label="Предыдущий день" size="sm" variant="ghost" onClick={() => onChangeDate(-1)} />
            <label className="today-date-picker-trigger" title="Выбрать дату">
              <AppIcon className="today-date-picker-icon" name="calendarDays" size="sm" />
              <input aria-label="Выбранная дата" type="date" value={selectedDate} onChange={(event) => onChangeDate(0, event.target.value)} />
            </label>
            <IconButton icon="chevronRight" label="Следующий день" size="sm" variant="ghost" onClick={() => onChangeDate(1)} />
          </div>
        </div>
        <div className="today-board-actions">
          <Button className="today-control-button is-secondary" leftIcon="calendarDays" variant="secondary" onClick={onOpenCalendar}>
            Календарь
          </Button>
          <Button className="today-control-button is-primary" leftIcon="plus" variant="primary" onClick={onAddVisit}>
            Визит
          </Button>
        </div>
        <div className="today-board-notifications">
          <PageNotificationsSlot />
        </div>
      </header>

      <section className="today-kpi-grid" aria-label="Ключевые показатели">
        <TodayKpiCard
          helper={`из ${dashboard.snapshot.scheduledVisits} запланировано`}
          icon="calendarDays"
          label="Визиты сегодня"
          tone="visits"
          value={dashboard.snapshot.completedVisits}
        />
        <TodayKpiCard
          helper={`прогноз: ${formatIncome(dashboard.forecastRevenue)}`}
          icon="banknote"
          label="Выручка сегодня"
          tone="income"
          value={formatIncome(dashboard.snapshot.received)}
        />
        <TodayKpiCard
          helper={dashboard.freeSlots.length ? `окно в графике: ${dashboard.freeSlots.length}` : "свободных окон нет"}
          icon="clock"
          label="Свободное время"
          tone="upcoming"
          value={formatDuration(freeMinutes)}
        />
        <TodayKpiCard
          helper={dashboard.actionItems.length ? "требуют внимания" : "всё под контролем"}
          icon="walletCards"
          label="Требует внимания"
          tone="debt"
          value={dashboard.actionItems.length}
          onClick={dashboard.actionItems.length ? () => openActionItem(dashboard.actionItems[0]) : undefined}
        />
      </section>

      <div className="today-layout">
          <section className="today-panel today-schedule-panel today-grid-schedule">
            <header className="today-panel-header">
              <h2>
                Расписание на сегодня{" "}
                <span className="today-count-pill">
                  {dashboard.todayVisits.length} визитов
                </span>
              </h2>
            </header>
            <div className="today-visit-timeline">
              {filteredVisits.length ? (
                filteredVisits.map((entry, index) => {
                  const visitMenuId = getVisitId(entry);
                  const menuOpen = openVisitMenuId === visitMenuId;
                  const dotBg = visitToneById.get(visitMenuId) ?? visitToneClasses[index % visitToneClasses.length];

                  return (
                    <article
                      className={`today-visit-line ${dotBg} ${
                        activeVisitId === visitMenuId ? "is-current" : ""
                      } ${selectedVisitId === visitMenuId ? "is-selected" : ""}`}
                      key={visitMenuId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVisitId(visitMenuId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedVisitId(visitMenuId);
                        }
                      }}
                    >
                      <div className="today-visit-time">
                        <strong>{entry.time}</strong>
                        <small>{formatDuration(entry.duration || 60)}</small>
                      </div>
                      <span className={`today-visit-dot ${dotBg}`} />
                      <div className="today-visit-client">
                        <strong>
                          {entry.client || "Без клиента"}
                        </strong>
                        <span>
                          {entry.service || "Визит"}{entry.master ? ` · ${entry.master}` : ` · ${formatDuration(entry.duration || 60)}`}
                        </span>
                      </div>
                      <div className="today-visit-status">
                        <span
                          className={`today-status-pill ${
                            entry.status === "confirmed"
                              ? "is-confirmed"
                              : entry.status === "completed"
                              ? "is-completed"
                              : "is-scheduled"
                          }`}
                        >
                          {visitStatusLabels[entry.status] || entry.status || "Запланирован"}
                        </span>
                      </div>
                      <strong className="today-visit-price">
                        {entry.amount ? formatMoney(entry.amount) : "—"}
                      </strong>
                      <div className="today-visit-menu" ref={menuOpen ? openVisitMenuRef : null}>
                        <IconButton
                          aria-label="Действия с визитом"
                          className="today-icon-button"
                          icon="more"
                          label="Действия с визитом"
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenVisitMenuId(menuOpen ? null : visitMenuId);
                          }}
                        />
                        {menuOpen ? (
                          <div className="today-menu-popover">
                            <Button
                              className="today-menu-item"
                              leftIcon="message"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenVisitMenuId(null);
                                onRemindVisit?.(entry);
                              }}
                            >
                              Написать
                            </Button>
                            <Button
                              className="today-menu-item"
                              leftIcon="edit"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenVisitMenuId(null);
                                onEditVisit?.(entry);
                              }}
                            >
                              Редактировать
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="today-empty-state"><AppIcon name="calendar" size="lg" /><span>{selectedEmployees.length ? "У выбранных сотрудников нет визитов" : "На этот день визитов нет"}</span></div>
              )}
            </div>
            {filteredVisits.length > 7 ? (
              <span className="today-scroll-cue" aria-hidden="true">
                <AppIcon name="arrowDown" size="xs" />
              </span>
            ) : null}
          </section>
          <section className="today-panel today-side-panel today-next-panel today-grid-next">
            <header className="today-panel-header">
              <h2>{selectedVisit ? "Выбранный визит" : "Следующий визит"}</h2>
              <AppIcon name="chevronRight" size="sm" />
            </header>
            {nextVisit ? (
              <div className={`today-next-visit ${nextVisitTone}`}>
                <div className="today-next-client-row">
                  <span className="today-next-marker" aria-hidden="true" />
                  <b className="today-next-client">{nextVisit.client || "Без клиента"}</b>
                </div>
                <div className="today-next-meta">
                  <span className="today-next-time">{nextVisit.time}</span>
                  <span>{selectedVisit ? "в расписании" : "ближайший"}</span>
                </div>
                <small>
                  {nextVisit.service || "Визит"} · {formatDuration(nextVisit.duration || 60)}
                </small>
                <small>{nextVisit.master || "—"}</small>
                <Button className="today-control-button is-primary is-compact" variant="primary" onClick={() => onEditVisit?.(nextVisit)}>
                  Открыть карточку
                </Button>
              </div>
            ) : (
              <div className="today-empty-state"><AppIcon name="calendar" size="lg" /><span>Ближайших визитов нет</span></div>
            )}
          </section>

          <section className="today-panel today-side-panel today-grid-slots">
            <header className="today-panel-header">
              <h2>Свободные окна сегодня</h2>
              <Button className="today-link-button" rightIcon="chevronRight" size="sm" variant="link" onClick={onOpenCalendar}>Все окна</Button>
            </header>
            <div className="today-side-list today-scroll-list">
              {dashboard.freeSlots.map((slot) => (
                <button key={`${slot.master}-${slot.startTime}`} className="today-side-row today-slot-row" type="button" onClick={onOpenCalendar}>
                  <AppIcon name="clock" size="sm" />
                  <strong>{slot.startTime} – {slot.endTime}</strong>
                  <span>{slot.durationMinutes} мин</span>
                </button>
              ))}
              {!dashboard.freeSlots.length ? <div className="today-empty-state is-compact"><span>Свободных окон нет</span></div> : null}
            </div>
          </section>

            <section className="today-panel today-side-panel today-unclosed-panel today-grid-unclosed">
              <header className="today-panel-header">
                <h2>
                  Нужно закрыть <span className="today-count-pill">{dashboard.unclosedPastVisits.length}</span>
                </h2>
                <Button className="today-control-button is-secondary is-compact" variant="secondary" onClick={onOpenCalendar}>
                  Календарь
                </Button>
              </header>
              <div className="today-side-list">
                {dashboard.unclosedPastVisits.map((entry) => (
                  <button
                    key={entry.id}
                    className="today-side-row today-unclosed-row"
                    type="button"
                    onClick={() => onEditVisit?.(entry)}
                  >
                    <strong>{entry.date} · {entry.time || "—"}</strong>
                    <span title={`${entry.client || "Без клиента"} · ${entry.service || "Визит"}`}>{entry.client || "Без клиента"} · {entry.service || "Визит"}</span>
                  </button>
                ))}
                {!dashboard.unclosedPastVisits.length ? <div className="today-empty-state is-compact"><span>Все прошедшие визиты закрыты</span></div> : null}
              </div>
            </section>

          <section className="today-panel today-side-panel today-employees-panel today-grid-employees">
            <header className="today-panel-header">
              <h2><AppIcon name="users" size="sm" /> Сотрудники</h2>
              {selectedEmployees.length ? (
                <Button
                  className="today-link-button"
                  size="sm"
                  variant="link"
                  onClick={() => setSelectedEmployees([])}
                >
                  Все
                </Button>
              ) : null}
            </header>
            <div className="today-employee-list">
              {employeeOptions.length ? (
                employeeOptions.map((employee, index) => {
                  const marker = visitToneClasses[index % visitToneClasses.length];
                  const checked = selectedEmployees.includes(employee);

                  return (
                    <label
                      className={`today-employee-option ${checked ? "is-checked" : ""}`}
                      key={employee}
                    >
                      <Checkbox
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmployee(employee)}
                      />
                      <span className="today-employee-check" aria-hidden="true">
                        <span className={`today-employee-marker ${marker}`} />
                      </span>
                      <span>{employee}</span>
                    </label>
                  );
                })
              ) : (
                <div className="today-empty-state is-inline"><span>Нет сотрудников в расписании</span></div>
              )}
            </div>
          </section>
      </div>
    </section>
  );
}

const formatDuration = (value) => {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}ч ${remainder}м` : `${hours}ч`;
};

const getTimeMinutes = (value) => {
  const [hours = 0, minutes = 0] = String(value ?? "")
    .split(":")
    .map((part) => Number(part));

  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const getVisitEndMinutes = (entry) =>
  getTimeMinutes(entry?.time ?? entry?.startTime) + Math.max(1, Number(entry?.duration) || 60);

const formatTodayHeading = (value) => {
  const date = new Date(`${value}T12:00:00`);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(date);

  return `${day}, ${weekday}`;
};

function TodayPage({
  alertSummary,
  alerts,
  appSettings,
  calendarEntries,
  certificates,
  clientPackages,
  clientProfiles,
  completedVisits = [],
  employees,
  onAddVisit,
  onEditVisit,
  onOpenCalendar,
  onOpenClients,
  onOpenOperations,
  onOpenPayments,
  onRemindVisit,
  supplies,
  tasks,
  visits,
}) {
  const [openVisitMenuId, setOpenVisitMenuId] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  });
  const openVisitMenuRef = useRef(null);

  const dashboard = useMemo(
    () =>
      buildTodayDashboard({
        alertSummary,
        alerts,
        appSettings,
        calendarEntries,
        certificates,
        clientPackages,
        clientProfiles,
        completedVisits,
        employees,
        now: new Date(`${selectedDate}T12:00:00`),
        supplies,
        tasks,
        visits,
      }),
    [
      alertSummary,
      alerts,
      appSettings,
      calendarEntries,
      certificates,
      clientPackages,
      clientProfiles,
      completedVisits,
      employees,
      selectedDate,
      supplies,
      tasks,
      visits,
    ],
  );

  const formatIncome = (value) =>
    Math.abs(Number(value) || 0) >= 1000 ? formatCompactMoney(value) : formatMoney(value);

  const freeMinutes = useMemo(() => {
    const slots = selectedEmployees.length
      ? dashboard.freeSlots.filter((slot) => selectedEmployees.includes(slot.master))
      : dashboard.freeSlots;
    if (!slots.length) return 0;
    const totalMinutes = slots.reduce(
      (total, slot) => total + (Number(slot.durationMinutes) || 0),
      0,
    );
    const uniqueMastersCount =
      new Set(slots.map((slot) => slot.master).filter(Boolean)).size || 1;
    return Math.min(14 * 60, Math.round(totalMinutes / uniqueMastersCount));
  }, [dashboard.freeSlots, selectedEmployees]);

  const changeDate = (offset, exactDate) => {
    if (exactDate) {
      setSelectedDate(exactDate);
      setSelectedVisitId(null);
      return;
    }
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setSelectedDate([next.getFullYear(), String(next.getMonth() + 1).padStart(2, "0"), String(next.getDate()).padStart(2, "0")].join("-"));
    setSelectedVisitId(null);
  };

  useEffect(() => {
    if (openVisitMenuId === null) {
      return undefined;
    }

    const closeMenu = (event) => {
      if (openVisitMenuRef.current?.contains(event.target)) {
        return;
      }

      setOpenVisitMenuId(null);
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openVisitMenuId]);

  return (
    <TodayReferenceBoard
      dashboard={dashboard}
      formatIncome={formatIncome}
      freeMinutes={freeMinutes}
      onAddVisit={onAddVisit}
      onEditVisit={onEditVisit}
      onOpenCalendar={onOpenCalendar}
      onOpenClients={onOpenClients}
      onOpenOperations={onOpenOperations}
      onOpenPayments={onOpenPayments}
      onRemindVisit={onRemindVisit}
      openVisitMenuId={openVisitMenuId}
      openVisitMenuRef={openVisitMenuRef}
      selectedEmployees={selectedEmployees}
      selectedDate={selectedDate}
      selectedVisitId={selectedVisitId}
      setSelectedEmployees={setSelectedEmployees}
      setSelectedVisitId={setSelectedVisitId}
      setOpenVisitMenuId={setOpenVisitMenuId}
      onChangeDate={changeDate}
    />
  );
}

export default TodayPage;
