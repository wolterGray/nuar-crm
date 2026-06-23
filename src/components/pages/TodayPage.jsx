import {
  Banknote,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardList,
  Clock3,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import PageHeader from "../PageHeader.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {buildTodayDashboard} from "../../utils/todayDashboard.js";
import {formatCompactMoney, formatMoney, toDisplayDate} from "../../utils/formatters.jsx";
import {getSupplyStockStatusLabel} from "../../utils/supplyStock.js";

const visitStatusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
};

function TodayKpiCard({helper, icon: Icon, label, tone, value}) {
  return (
    <article className={`today-summary-card today-summary-card-${tone}`}>
      <div className="today-summary-icon">
        <Icon size={15} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}

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
  onChangeSupplyStock,
  onCompleteTask,
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
  const {isMobile} = useBreakpoint();
  const [mobileSection, setMobileSection] = useState("tasks");
  const [openVisitMenuId, setOpenVisitMenuId] = useState(null);
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

  const formatIncome = (value) =>
    Math.abs(Number(value) || 0) >= 1000
      ? formatCompactMoney(value)
      : formatMoney(value);
  const openActionTarget = (action) => {
    if (action === "calendar") {
      onOpenCalendar?.();
    } else if (action === "payments") {
      onOpenPayments?.();
    } else if (action === "clients") {
      onOpenClients?.();
    } else {
      onOpenOperations?.();
    }
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
    <section className={`today-page ${isMobile ? "statistics-page today-page-mobile" : "today-page-desktop"}`}>
      <PageHeader
        collapsible={false}
        actions={
          isMobile ? (
            <div className="today-header-actions">
              <button
                className="today-header-chip secondary-button"
                type="button"
                onClick={onOpenCalendar}>
                <CalendarDays size={16} />
                <span>Календарь</span>
              </button>
              <button
                className="today-header-chip secondary-button"
                type="button"
                onClick={onAddVisit}>
                <CalendarPlus size={16} />
                <span>Визит</span>
              </button>
              <button
                className="today-header-chip today-header-chip-full add-visit-button"
                type="button"
                onClick={onAddTask}>
                <Plus size={16} />
                <span>Задача</span>
              </button>
            </div>
          ) : (
            <>
              <button className="secondary-button" type="button" onClick={onOpenCalendar}>
                <CalendarDays size={16} />
                Календарь
              </button>
              <button className="secondary-button" type="button" onClick={onAddVisit}>
                <CalendarPlus size={16} />
                Визит
              </button>
              <button className="add-visit-button" type="button" onClick={onAddTask}>
                <Plus size={16} />
                Задача
              </button>
            </>
          )
        }
        description="Операционная сводка дня: расписание, окна, задачи и остатки"
        title={`Сегодня · ${dashboard.todayDisplay}`}
      />

      {(() => {
        const todayBody = (
          <>
      <section className="today-kpi-section">
        <div className="statistics-panel-title today-section-heading">
          <div>
            <h3>Ключевые показатели</h3>
            <p>{toDisplayDate(dashboard.today)}</p>
          </div>
        </div>
        <div className="today-summary-grid">
          <TodayKpiCard
            helper={`${dashboard.snapshot.completedVisits} завершено`}
            icon={CalendarDays}
            label="Визиты"
            tone="visits"
            value={dashboard.snapshot.scheduledVisits}
          />
          <TodayKpiCard
            helper={`прогноз ~${formatIncome(dashboard.forecastRevenue)}`}
            icon={Banknote}
            label="Поступления"
            tone="income"
            value={formatIncome(dashboard.snapshot.received)}
          />
          <TodayKpiCard
            helper={
              dashboard.snapshot.debtVisits > 0
                ? `${dashboard.snapshot.debtVisits} записей`
                : "нет долгов"
            }
            icon={WalletCards}
            label="Долги"
            tone="debt"
            value={formatIncome(dashboard.snapshot.debtAmount)}
          />
          <TodayKpiCard
            helper="следующие 3 часа"
            icon={Clock3}
            label="Ближайшие"
            tone="upcoming"
            value={dashboard.snapshot.upcomingCount}
          />
        </div>
      </section>

      <div className="today-dashboard-grid">
        <section className="today-section today-section-schedule">
          <div className="today-section-heading">
            <div>
              <h3>Расписание на сегодня</h3>
              <p>{dashboard.todayVisits.length} записей</p>
            </div>
            <button
              className="today-section-action today-panel-link secondary-button"
              type="button"
              onClick={onOpenCalendar}>
              <CalendarDays size={14} />
              {isMobile ? "Календарь" : "Открыть календарь"}
            </button>
          </div>

          {dashboard.todayVisits.length === 0 ? (
            <p className="today-empty">На сегодня записей нет</p>
          ) : (
            <ul className="today-visit-list">
              {dashboard.todayVisits.map((entry) => {
                const visitMenuId = entry.id ?? `${entry.time}-${entry.client}`;
                const visitMenuOpen = openVisitMenuId === visitMenuId;

                return (
                <li className="today-visit-row" key={visitMenuId}>
                  <div className="today-visit-main">
                    <div>
                      <span>{entry.client || "Без клиента"}</span>
                      <small>
                        {entry.service || "Визит"} · {entry.master || "—"}
                      </small>
                    </div>
                  </div>
                  <div className="today-visit-meta">
                    <div className="today-visit-state">
                      <b>{visitStatusLabels[entry.status] || entry.status || "—"}</b>
                      <strong>{entry.time}</strong>
                    </div>
                    <div
                      ref={visitMenuOpen ? openVisitMenuRef : null}
                      className={`today-visit-actions${visitMenuOpen ? " open" : ""}`}>
                      <button
                        aria-label="Действия с визитом"
                        aria-expanded={visitMenuOpen}
                        className="today-inline-action"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenVisitMenuId(visitMenuOpen ? null : visitMenuId);
                        }}>
                        <MoreHorizontal size={15} />
                      </button>
                      {visitMenuOpen ? (
                        <div className="today-visit-action-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenVisitMenuId(null);
                            onRemindVisit?.(entry);
                          }}>
                          <MessageSquareText size={13} />
                          Написать
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenVisitMenuId(null);
                            onEditVisit?.(entry);
                          }}>
                          <Pencil size={13} />
                          Редактировать
                        </button>
                      </div>
                      ) : null}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className={`today-section today-section-schedule-quality ${
            dashboard.scheduleQuality.ok ? "is-ok" : "has-issues"
          }`}>
          <div className="today-section-heading">
            <div>
              <h3>Качество расписания</h3>
              <p>
                {dashboard.scheduleQuality.ok
                  ? "Ошибок в сегодняшних записях не найдено"
                  : `${dashboard.scheduleQuality.issues.length} пунктов к проверке`}
              </p>
            </div>
            <button
              className="today-section-action secondary-button"
              type="button"
              onClick={onOpenCalendar}>
              <CalendarDays size={14} />
              Календарь
            </button>
          </div>
          {dashboard.scheduleQuality.ok ? (
            <p className="today-empty">Расписание выглядит аккуратно.</p>
          ) : (
            <ul className="today-schedule-quality-list">
              {dashboard.scheduleQuality.issues.slice(0, 5).map((issue) => (
                <li
                  className={`today-row-card today-schedule-quality-row today-action-${issue.priority}`}
                  key={issue.id}>
                  <div>
                    <span>{getActionTypeLabel(issue.type)}</span>
                    <strong>{issue.title}</strong>
                    <small>{issue.message}</small>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openActionTarget(issue.action)}>
                    Открыть
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isMobile && (
          <div aria-label="Разделы дня" className="today-mobile-tabs" role="tablist">
            <button
              className={mobileSection === "tasks" ? "active" : ""}
              role="tab"
              type="button"
              onClick={() => setMobileSection("tasks")}>
              Задачи
            </button>
            <button
              className={mobileSection === "stock" ? "active" : ""}
              role="tab"
              type="button"
              onClick={() => setMobileSection("stock")}>
              Склад
            </button>
            <button
              className={mobileSection === "alerts" ? "active" : ""}
              role="tab"
              type="button"
              onClick={() => setMobileSection("alerts")}>
              Важное
            </button>
          </div>
        )}

        <div
          className={`today-side-column ${
            isMobile ? `today-side-column-mobile today-side-column-${mobileSection}` : ""
          }`}>
          {!isMobile && (
          <section className="today-section today-section-upcoming">
            <div className="today-section-heading">
              <div>
                <h3>Ближайшие визиты</h3>
                <p>Следующие 3 часа</p>
              </div>
            </div>
            {dashboard.upcomingVisits.length === 0 ? (
              <p className="today-empty">Ближайших визитов нет</p>
            ) : (
              <ul className="statistics-today-upcoming">
                {dashboard.upcomingVisits.map((entry) => (
                  <li key={entry.id ?? `${entry.time}-${entry.client}`}>
                    <strong>{entry.time}</strong>
                    <span>{entry.client || "Без клиента"}</span>
                    <small>{entry.service || "Визит"}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {!isMobile && (
          <section className="today-section today-section-windows">
            <div className="today-section-heading">
              <div>
                <h3>Свободные окна</h3>
                <p>Оставшееся время в сменах</p>
              </div>
            </div>
            {dashboard.freeSlots.length === 0 ? (
              <p className="today-empty">Свободных окон не найдено</p>
            ) : (
              <ul className="today-slot-list">
                {dashboard.freeSlots.map((slot) => (
                  <li
                    className="today-row-card today-slot-row today-window-row"
                    key={`${slot.master}-${slot.startTime}`}>
                    <strong className="today-window-time">{slot.startTime}–{slot.endTime}</strong>
                    <span className="today-window-master">{slot.master}</span>
                    <small className="today-slot-duration">{slot.durationMinutes} мин</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {(!isMobile || mobileSection === "tasks") && (
          <section className="today-section today-section-tasks">
            <div className="today-section-heading">
              <div>
                <h3>Задачи на сегодня</h3>
                <p>{dashboard.dueTasks.length} активных</p>
              </div>
              <button
                className="today-section-action secondary-button"
                type="button"
                onClick={onOpenOperations}>
                <ClipboardList size={16} />
                Операции
              </button>
            </div>
            {dashboard.dueTasks.length === 0 ? (
              <p className="today-empty">Задач на сегодня нет</p>
            ) : (
              <ul className="today-task-list">
                {dashboard.dueTasks.slice(0, 6).map((task) => (
                  <li className="today-row-card today-task-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {task.dueDate < dashboard.today ? "Просрочено" : "Срок сегодня"}
                      </small>
                    </div>
                    <button
                      aria-label={`Завершить задачу ${task.title}`}
                      className="icon-button"
                      type="button"
                      onClick={() => onCompleteTask?.(task)}>
                      <Check size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {(!isMobile || mobileSection === "stock") && (
          <section className="today-section today-section-stock">
            <div className="today-section-heading">
              <div>
                <h3>Низкий остаток</h3>
                <p>{dashboard.lowStockSupplies.length} позиций</p>
              </div>
              <button
                className="today-section-action secondary-button"
                type="button"
                onClick={onOpenOperations}>
                <ClipboardList size={14} />
                Склад
              </button>
            </div>
            {dashboard.lowStockSupplies.length === 0 ? (
              <p className="today-empty">Все позиции в норме</p>
            ) : (
              <ul className="today-supply-list">
                {dashboard.lowStockSupplies.map((item) => (
                  <li className="today-row-card today-supply-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.stock} {item.unit} · мин. {item.minStock} ·{" "}
                        {getSupplyStockStatusLabel(item)}
                      </small>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onChangeSupplyStock?.(item, 1)}>
                      +1
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {(!isMobile || mobileSection === "alerts") && (
            <section className="today-section today-section-important">
              <div className="today-section-heading">
                <div>
                  <h3>Центр действий</h3>
                  <p>{dashboard.actionItems.length} пунктов к проверке</p>
                </div>
                <button
                  className="today-section-action secondary-button"
                  type="button"
                  onClick={onOpenOperations}>
                  <ClipboardList size={14} />
                  Операции
                </button>
              </div>
              {dashboard.actionItems.length === 0 ? (
                <p className="today-empty">Сейчас нет срочных действий.</p>
              ) : (
                <ul className="today-action-list">
                  {dashboard.actionItems.map((item) => (
                    <li
                      className={`today-row-card today-action-row today-action-${item.priority}`}
                      key={item.id}>
                      <div>
                        <span>{getActionTypeLabel(item.type)}</span>
                        <strong>{item.title}</strong>
                        {item.message ? <small>{item.message}</small> : null}
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => openActionTarget(item.action)}>
                        Открыть
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
          </>
        );

        return isMobile ? <div className="today-scroll">{todayBody}</div> : todayBody;
      })()}
    </section>
  );
}

function getActionTypeLabel(type) {
  const labels = {
    birthday: "Клиент",
    calendar: "Календарь",
    certificate: "Сертификат",
    client: "Клиент",
    finance: "Финансы",
    package: "Пакет",
    stock: "Склад",
    task: "Задача",
  };

  return labels[type] || "Сигнал";
}

export default TodayPage;
