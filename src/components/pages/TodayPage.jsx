import {
  Banknote,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardList,
  Clock3,
  MessageSquareText,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";
import {useMemo, useState} from "react";
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

function TodayKpiCard({color, helper, icon: Icon, label, value}) {
  return (
    <article
      className="statistics-card statistics-card-secondary"
      style={{"--statistics-card-color": color}}>
      <div>
        <Icon size={17} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
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
  onOpenOperations,
  onOpenPayments,
  onRemindVisit,
  supplies,
  tasks,
  visits,
}) {
  const {isMobile} = useBreakpoint();
  const [mobileSection, setMobileSection] = useState("tasks");
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

  return (
    <section className={`today-page statistics-page ${isMobile ? "today-page-mobile" : ""}`}>
      <PageHeader
        collapsedMeta={dashboard.todayDisplay}
        collapsible={isMobile}
        defaultExpanded={!isMobile}
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
        <div className="statistics-today-grid">
          <TodayKpiCard
            color="#8fc5aa"
            helper={`${dashboard.snapshot.completedVisits} завершено`}
            icon={CalendarDays}
            label="Визиты"
            value={dashboard.snapshot.scheduledVisits}
          />
          <TodayKpiCard
            color="#b7a0d6"
            helper={`прогноз ~${formatIncome(dashboard.forecastRevenue)}`}
            icon={Banknote}
            label="Поступления"
            value={formatIncome(dashboard.snapshot.received)}
          />
          <TodayKpiCard
            color="#d99a9a"
            helper={
              dashboard.snapshot.debtVisits > 0
                ? `${dashboard.snapshot.debtVisits} записей`
                : "нет долгов"
            }
            icon={WalletCards}
            label="Долги"
            value={formatIncome(dashboard.snapshot.debtAmount)}
          />
          <TodayKpiCard
            color="#8ba7d8"
            helper="следующие 3 часа"
            icon={Clock3}
            label="Ближайшие"
            value={dashboard.snapshot.upcomingCount}
          />
        </div>
      </section>

      <div className="today-dashboard-grid">
        <section className="today-section">
          <div className="today-section-heading">
            <div>
              <h3>Расписание на сегодня</h3>
              <p>{dashboard.todayVisits.length} записей</p>
            </div>
            <button className="today-panel-link secondary-button" type="button" onClick={onOpenCalendar}>
              {isMobile ? "Календарь" : "Открыть календарь"}
            </button>
          </div>

          {dashboard.todayVisits.length === 0 ? (
            <p className="today-empty">На сегодня записей нет</p>
          ) : (
            <ul className="today-visit-list">
              {dashboard.todayVisits.map((entry) => (
                <li className="today-visit-row" key={entry.id}>
                  <div className="today-visit-main">
                    <strong>{entry.time}</strong>
                    <div>
                      <span>{entry.client || "Без клиента"}</span>
                      <small>
                        {entry.service || "Визит"} · {entry.master || "—"}
                      </small>
                    </div>
                  </div>
                  <div className="today-visit-meta">
                    <b>{visitStatusLabels[entry.status] || entry.status || "—"}</b>
                    <div className="today-visit-actions">
                      <button
                        aria-label="Написать клиенту"
                        className="today-inline-action"
                        type="button"
                        onClick={() => onRemindVisit?.(entry)}>
                        <MessageSquareText size={14} />
                      </button>
                      <button
                        aria-label="Редактировать запись"
                        className="today-inline-action"
                        type="button"
                        onClick={() => onEditVisit?.(entry)}>
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
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
              className={mobileSection === "slots" ? "active" : ""}
              role="tab"
              type="button"
              onClick={() => setMobileSection("slots")}>
              Окна
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

        <div className="today-side-column">
          {!isMobile && (
          <section className="today-section">
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

          {(!isMobile || mobileSection === "slots") && (
          <section className="today-section">
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
                  <li key={`${slot.master}-${slot.startTime}`}>
                    <strong>
                      {slot.startTime}–{slot.endTime}
                    </strong>
                    <span>{slot.master}</span>
                    <small>{slot.durationMinutes} мин</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {(!isMobile || mobileSection === "tasks") && (
          <section className="today-section">
            <div className="today-section-heading">
              <div>
                <h3>Задачи на сегодня</h3>
                <p>{dashboard.dueTasks.length} активных</p>
              </div>
              <button className="secondary-button" type="button" onClick={onOpenOperations}>
                <ClipboardList size={16} />
                Операции
              </button>
            </div>
            {dashboard.dueTasks.length === 0 ? (
              <p className="today-empty">Задач на сегодня нет</p>
            ) : (
              <ul className="today-task-list">
                {dashboard.dueTasks.slice(0, 6).map((task) => (
                  <li className="today-task-row" key={task.id}>
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
          <section className="today-section">
            <div className="today-section-heading">
              <div>
                <h3>Низкий остаток</h3>
                <p>{dashboard.lowStockSupplies.length} позиций</p>
              </div>
              <button className="secondary-button" type="button" onClick={onOpenOperations}>
                Склад
              </button>
            </div>
            {dashboard.lowStockSupplies.length === 0 ? (
              <p className="today-empty">Все позиции в норме</p>
            ) : (
              <ul className="today-supply-list">
                {dashboard.lowStockSupplies.map((item) => (
                  <li className="today-supply-row" key={item.id}>
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

          {(!isMobile || mobileSection === "alerts") &&
          (dashboard.todayBirthdays.length > 0 ||
            dashboard.priorityAlerts.length > 0) && (
            <section className="today-section">
              <div className="today-section-heading">
                <div>
                  <h3>Важное</h3>
                  <p>Дни рождения и сигналы</p>
                </div>
                <button className="secondary-button" type="button" onClick={onOpenPayments}>
                  Оплаты
                </button>
              </div>
              {dashboard.todayBirthdays.length > 0 ? (
                <ul className="today-note-list">
                  {dashboard.todayBirthdays.map((client) => (
                    <li key={client.id}>
                      🎂 {client.name} · поздравить сегодня
                    </li>
                  ))}
                </ul>
              ) : null}
              {dashboard.priorityAlerts.length > 0 ? (
                <ul className="today-note-list">
                  {dashboard.priorityAlerts.map((alert) => (
                    <li key={alert.id}>
                      {alert.title}
                      {alert.message ? ` · ${alert.message}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
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

export default TodayPage;
