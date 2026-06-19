import {CheckCircle2, Circle, Coins} from "lucide-react";
import {useMemo, useState} from "react";
import PageHeader from "./PageHeader.jsx";
import {getDailyPayrollEmployees} from "../utils/dailyPayroll.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {formatMoney, toDisplayDate} from "../utils/formatters.jsx";

function DailyPayrollPanel({
  employees = [],
  getDailyPayrollReport,
  markAllDailyPayoutsPaid,
  setVisitMasterPayoutPaid,
}) {
  const dailyEmployees = useMemo(
    () => getDailyPayrollEmployees(employees),
    [employees],
  );
  const [selectedDate, setSelectedDate] = useState(getTodayInput());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    () => dailyEmployees[0]?.id ?? "",
  );
  const selectedEmployee = useMemo(
    () =>
      dailyEmployees.find(
        (employee) => String(employee.id) === String(selectedEmployeeId),
      ) ?? dailyEmployees[0],
    [dailyEmployees, selectedEmployeeId],
  );
  const activeEmployeeId = selectedEmployee?.id ?? "";

  const report = useMemo(
    () =>
      activeEmployeeId
        ? getDailyPayrollReport?.({
            date: selectedDate,
            employeeId: activeEmployeeId,
          })
        : null,
    [activeEmployeeId, getDailyPayrollReport, selectedDate],
  );

  if (!getDailyPayrollReport || !setVisitMasterPayoutPaid) {
    return null;
  }

  if (dailyEmployees.length === 0) {
    return (
      <section className="panel daily-payroll-panel">
        <PageHeader
          description="Для мастера с ежедневной выплатой здесь появится расчёт по каждому массажу. В карточке сотрудника выберите «Ежедневно по визитам» — например, для Максима с комиссией 40%."
          showNotifications={false}
          title="Ежедневная выплата">
          <span className="payroll-status is-open">
            <Coins size={15} />
            Не настроено
          </span>
        </PageHeader>
      </section>
    );
  }

  return (
    <section className="panel daily-payroll-panel">
      <PageHeader
        description="Комиссия с каждого завершённого массажа за выбранный день"
        showNotifications={false}
        title="Ежедневная выплата">
        {report?.totals.unpaidCount ? (
          <span className="payroll-status is-open">
            <Circle size={15} />
            {report.totals.unpaidCount} не оплачено
          </span>
        ) : (
          <span className="payroll-status is-paid">
            <CheckCircle2 size={15} />
            Всё оплачено
          </span>
        )}
      </PageHeader>

      <div className="daily-payroll-controls">
        <label>
          Мастер
          <select
            value={String(activeEmployeeId)}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}>
            {dailyEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.commissionRate}%
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </div>

      {report ? (
        <>
          <div className="daily-payroll-summary-grid">
            <article className="day-close-summary-card">
              <span>Массажей</span>
              <strong>{report.totals.visitsCount}</strong>
              <small>{report.commissionRate}% с каждого</small>
            </article>
            <article className="day-close-summary-card">
              <span>К выплате</span>
              <strong>{formatMoney(report.totals.totalPayout)}</strong>
              <small>Чаевые: {formatMoney(report.totals.tips)}</small>
            </article>
            <article className="day-close-summary-card">
              <span>Оплачено</span>
              <strong>{formatMoney(report.totals.paidPayout)}</strong>
              <small>{report.totals.paidCount} визит(ов)</small>
            </article>
            <article className="day-close-summary-card">
              <span>Осталось</span>
              <strong>{formatMoney(report.totals.unpaidPayout)}</strong>
              <small>{report.totals.unpaidCount} визит(ов)</small>
            </article>
          </div>

          {report.rows.length === 0 ? (
            <p className="payroll-empty">
              За {toDisplayDate(report.date)} у {report.employeeName} завершённых
              визитов нет.
            </p>
          ) : (
            <div className="payroll-table-wrap">
              <table className="payroll-table daily-payroll-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Клиент / услуга</th>
                    <th>Сумма</th>
                    <th>Выплата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr
                      className={row.isPaid ? "is-paid" : "is-unpaid"}
                      key={row.visitId}>
                      <td>{row.time || "—"}</td>
                      <td>
                        <strong>{row.client || "Без имени"}</strong>
                        <small>{row.service || row.payment}</small>
                      </td>
                      <td>{formatMoney(row.receivedAmount)}</td>
                      <td>
                        <strong>{formatMoney(row.payout)}</strong>
                        <small>{row.commissionRate}%</small>
                      </td>
                      <td>
                        <button
                          className={
                            row.isPaid ? "secondary-button" : "add-visit-button"
                          }
                          type="button"
                          onClick={() =>
                            setVisitMasterPayoutPaid(row.visitId, !row.isPaid)
                          }>
                          {row.isPaid ? (
                            <>
                              <CheckCircle2 size={14} />
                              Оплачено
                            </>
                          ) : (
                            <>
                              <Circle size={14} />
                              Не оплачено
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.totals.unpaidCount > 0 ? (
            <div className="payroll-actions">
              <button
                className="add-visit-button"
                type="button"
                onClick={() =>
                  markAllDailyPayoutsPaid?.({
                    date: selectedDate,
                    employeeId: activeEmployeeId,
                  })
                }>
                <CheckCircle2 size={16} />
                Отметить всё оплаченным
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default DailyPayrollPanel;
