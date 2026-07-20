import { useEffect, useMemo, useRef, useState } from "react";
import { PageNotificationsSlot } from "../PageNotifications.jsx";
import { buildTodayDashboard } from "../../utils/todayDashboard.js";
import AppIcon from "../ui/AppIcon.jsx";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import IconButton from "../ui/IconButton.jsx";
import { formatCompactMoney, formatMoney } from "../../utils/formatters.jsx";

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

function TodayKpiCard({ helper, icon, label, tone, value }) {
  const styles = toneStyles[tone] || toneStyles.upcoming;

  return (
    <Card className="today-kpi-card" data-tone={styles}>
      <div className="today-kpi-icon">
        <AppIcon name={icon} size="md" />
      </div>
      <div className="today-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </Card>
  );
}

function TodayReferenceBoard({
  appSettings,
  copiedReviewClientId,
  dashboard,
  formatIncome,
  freeMinutes,
  firstTimersToday,
  onAddTask,
  onAddVisit,
  onCompleteTask,
  onEditVisit,
  onOpenCalendar,
  onRemindVisit,
  openVisitMenuId,
  openVisitMenuRef,
  selectedEmployees,
  selectedVisitId,
  setCopiedReviewClientId,
  setSelectedEmployees,
  setSelectedVisitId,
  setOpenVisitMenuId,
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
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return (
      filteredVisits.find(
        (entry) => getTimeMinutes(entry.time ?? entry.startTime) >= currentMinutes,
      ) ?? filteredVisits[0]
    );
  }, [filteredVisits]);
  const nextVisit = selectedVisit ?? nearestScheduleVisit;
  const activeVisitId = selectedVisit
    ? getVisitId(selectedVisit)
    : nearestScheduleVisit
      ? getVisitId(nearestScheduleVisit)
      : null;
  const nextVisitTone = nextVisit
    ? visitToneById.get(getVisitId(nextVisit)) ?? "is-gold"
    : "is-gold";

  return (
    <section className="today-board">
      <header className="today-board-header">
        <div className="today-board-title">
          <h1>Сегодня</h1>
          <span>{formatTodayHeading(dashboard.today)}</span>
          <AppIcon name="calendarDays" size="md" />
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
          helper="сегодня"
          icon="clock"
          label="Свободного времени"
          tone="upcoming"
          value={formatDuration(freeMinutes)}
        />
        <TodayKpiCard
          helper="требуют внимания"
          icon="walletCards"
          label="Проблемы"
          tone="debt"
          value={dashboard.actionItems.length}
        />
      </section>

      <div className="today-layout">
        <div className="today-main-column">
          <section className="today-panel today-schedule-panel">
            <header className="today-panel-header">
              <h2>
                Расписание на сегодня{" "}
                <span className="today-count-pill">
                  {dashboard.todayVisits.length} визитов
                </span>
              </h2>
              <div className="today-schedule-controls">
                <div className="today-segmented-control" aria-label="Период расписания">
                  <Button className="is-active" size="sm" variant="ghost">День</Button>
                  <Button size="sm" variant="ghost">Неделя</Button>
                  <Button size="sm" variant="ghost">Месяц</Button>
                </div>
                <IconButton className="today-icon-button" icon="more" label="Ещё" size="sm" variant="ghost" />
              </div>
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
                          {entry.service || "Визит"} · {formatDuration(entry.duration || 60)}
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
                <p className="today-empty-state">
                  {selectedEmployees.length ? "У выбранных сотрудников нет визитов" : "На сегодня визитов нет"}
                </p>
              )}
            </div>
            {filteredVisits.length > 7 ? (
              <span className="today-scroll-cue" aria-hidden="true">
                <AppIcon name="arrowDown" size="xs" />
              </span>
            ) : null}
          </section>

        </div>

        <aside className="today-side-column">
          <section className="today-panel today-side-panel today-next-panel">
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
              <p className="today-empty-state">Ближайших визитов нет</p>
            )}
          </section>

          <section className="today-panel today-side-panel today-employees-panel">
            <header className="today-panel-header">
              <h2>Сотрудники</h2>
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
                <p className="today-empty-state">Нет сотрудников в расписании</p>
              )}
            </div>
          </section>

          <section className="today-panel today-side-panel">
            <header className="today-panel-header">
              <h2>Свободные окна сегодня</h2>
              <Button className="today-control-button is-secondary is-compact" variant="secondary" onClick={onOpenCalendar}>
                В календарь
              </Button>
            </header>
            <div className="today-side-list">
              {dashboard.freeSlots.slice(0, 3).map((slot) => (
                <div
                  key={`${slot.master}-${slot.startTime}`}
                  className="today-side-row"
                >
                  <strong>{slot.startTime} – {slot.endTime}</strong>
                  <span>{slot.durationMinutes} мин</span>
                </div>
              ))}
              {!dashboard.freeSlots.length ? (
                <p className="today-empty-state">Свободных окон нет</p>
              ) : null}
            </div>
          </section>

          <section className="today-panel today-side-panel today-tasks-panel">
            <header className="today-panel-header">
              <h2>
                Задачи <span className="today-count-pill">{dashboard.dueTasks.length}</span>
              </h2>
              <Button className="today-control-button is-secondary is-compact" leftIcon="plus" variant="secondary" onClick={onAddTask}>
                Задача
              </Button>
            </header>
            <div className="today-side-list">
              {dashboard.dueTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="today-task-line"
                >
                  <IconButton
                    aria-label={`Завершить ${task.title}`}
                    className="today-check-button"
                    icon="check"
                    label={`Завершить ${task.title}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => onCompleteTask?.(task)}
                  />
                  <strong>{task.title}</strong>
                  <span>
                    {task.dueDate < dashboard.today ? "Просрочено" : "Сегодня"}
                  </span>
                </div>
              ))}
              {!dashboard.dueTasks.length ? (
                <p className="today-empty-state">Задач нет</p>
              ) : null}
            </div>
          </section>

          <section className="today-panel today-side-panel today-alerts-panel">
            <header className="today-panel-header">
              <h2>
                Уведомления <span className="today-count-pill">{dashboard.actionItems.length}</span>
              </h2>
            </header>
            <div className="today-side-list">
              {dashboard.actionItems.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className={`today-alert-line today-action-${item.priority}`}
                >
                  <span aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                  </div>
                </div>
              ))}
              {!dashboard.actionItems.length ? (
                <p className="today-empty-state">Нет новых уведомлений</p>
              ) : null}
            </div>
          </section>

          <section className="today-panel today-side-panel today-reviews-panel">
            <header className="today-panel-header">
              <h2>
                Сбор отзывов <span className="today-count-pill">{firstTimersToday.length}</span>
              </h2>
            </header>
            <div className="today-side-list">
              {firstTimersToday.map((client) => (
                <div
                  key={client.id}
                  className="today-review-row flex flex-col gap-2 p-2.5 rounded-lg border border-border bg-card/40"
                >
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex flex-col min-w-0 flex-1">
                      <strong className="text-foreground text-xs font-semibold truncate">{client.name}</strong>
                      <small className="text-[10px] text-muted-foreground truncate">{client.service} · {client.master}</small>
                    </div>
                    <Button
                      className="today-review-message-button"
                      leftIcon="message"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const reviewText = `Cześć ${client.name || "kliencie"}! Dziękujemy za wizytę w NUAR. Będziemy wdzięczni za krótką opinię na Google: ${appSettings?.reviewGoogleUrl || "https://g.page/r/YOUR_GOOGLE_LINK/review"}`;
                        navigator.clipboard.writeText(reviewText);
                        
                        setCopiedReviewClientId(client.id);
                        setTimeout(() => setCopiedReviewClientId(""), 2000);
                        
                        const cleanTelegram = String(client.telegram ?? "").trim().replace("@", "");
                        if (cleanTelegram) {
                          window.open(`https://t.me/${cleanTelegram}`, "_blank");
                        } else {
                          const cleanPhone = String(client.phone ?? "").trim().replace(/\D/g, "");
                          if (cleanPhone) {
                            window.open(`https://t.me/+${cleanPhone}`, "_blank");
                          } else {
                            window.open("https://t.me", "_blank");
                          }
                        }
                      }}
                    >
                      {copiedReviewClientId === client.id ? "Скопировано!" : "Запросить"}
                    </Button>
                  </div>
                </div>
              ))}
              {!firstTimersToday.length ? (
                <p className="today-empty-state">Нет новых клиентов сегодня</p>
              ) : null}
            </div>
          </section>

        </aside>
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
  employees,
  onAddTask,
  onAddVisit,
  onCompleteTask,
  onEditVisit,
  onOpenCalendar,
  onRemindVisit,
  supplies,
  tasks,
  visits,
}) {
  const [openVisitMenuId, setOpenVisitMenuId] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [copiedReviewClientId, setCopiedReviewClientId] = useState("");
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
        employees,
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
      employees,
      supplies,
      tasks,
      visits,
    ],
  );

  const firstTimersToday = useMemo(() => {
    if (!dashboard.today) return [];

    const completedVisitsToday = calendarEntries.filter(
      (entry) =>
        entry.date === dashboard.today &&
        entry.kind === "visit" &&
        entry.status === "completed" &&
        entry.client
    );

    const list = [];
    completedVisitsToday.forEach((visit) => {
      const client = clientProfiles.find(
        (c) =>
          c.id === visit.clientId ||
          (visit.client && c.name?.toLowerCase() === visit.client.toLowerCase())
      );
      if (client && client.visitsCount === 1) {
        if (!list.some(item => item.id === client.id)) {
          list.push({
            ...client,
            visitId: visit.id,
            service: visit.service || "Услуга",
            master: visit.master || "Мастер",
          });
        }
      }
    });
    return list;
  }, [calendarEntries, clientProfiles, dashboard.today]);

  const formatIncome = (value) =>
    Math.abs(Number(value) || 0) >= 1000 ? formatCompactMoney(value) : formatMoney(value);

  const freeMinutes = dashboard.freeSlots.reduce(
    (total, slot) => total + (Number(slot.durationMinutes) || 0),
    0,
  );

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
      appSettings={appSettings}
      copiedReviewClientId={copiedReviewClientId}
      dashboard={dashboard}
      formatIncome={formatIncome}
      freeMinutes={freeMinutes}
      firstTimersToday={firstTimersToday}
      onAddTask={onAddTask}
      onAddVisit={onAddVisit}
      onCompleteTask={onCompleteTask}
      onEditVisit={onEditVisit}
      onOpenCalendar={onOpenCalendar}
      onRemindVisit={onRemindVisit}
      openVisitMenuId={openVisitMenuId}
      openVisitMenuRef={openVisitMenuRef}
      selectedEmployees={selectedEmployees}
      selectedVisitId={selectedVisitId}
      setCopiedReviewClientId={setCopiedReviewClientId}
      setSelectedEmployees={setSelectedEmployees}
      setSelectedVisitId={setSelectedVisitId}
      setOpenVisitMenuId={setOpenVisitMenuId}
    />
  );
}

export default TodayPage;
