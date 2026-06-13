import {CheckCircle2, Lock, Trash2, Unlock, Wallet} from "lucide-react";
import {useMemo, useState} from "react";
import PageHeader from "./PageHeader.jsx";
import {
  findPayrollRecord,
  formatPayrollPeriodLabel,
  getCurrentMonthPayrollRange,
  getPreviousMonthPayrollRange,
  getRecentPayrollRecords,
  normalizePayrollDate,
} from "../utils/payroll.js";
import {formatMoney} from "../utils/formatters.jsx";

function PayrollForm({
  endDate,
  existingRecord,
  initialNote = "",
  onEndDateChange,
  onMarkPaid,
  onRemovePayrollRecord,
  onReopenPayrollRecord,
  onStartDateChange,
  report,
  startDate,
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <form
      className="payroll-form"
      onSubmit={(event) => {
        event.preventDefault();
        onMarkPaid?.({endDate, note, startDate});
      }}>
      <div className="payroll-period-row">
        <label>
          С
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </label>
        <label>
          По
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </label>
      </div>

      {report.employees.length === 0 ? (
        <p className="payroll-empty">За выбранный период начислений нет.</p>
      ) : (
        <div className="payroll-table-wrap">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Мастер</th>
                <th>Визиты</th>
                <th>Услуги</th>
                <th>Пакет</th>
                <th>Продажи</th>
                <th>Чай</th>
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              {report.employees.map((row) => (
                <tr key={row.employeeId}>
                  <td>
                    <strong>{row.employeeName}</strong>
                    <small>{row.commissionRate}%</small>
                  </td>
                  <td>{row.visitsCount}</td>
                  <td>{formatMoney(row.servicePayout)}</td>
                  <td>{formatMoney(row.packageVisitPayout)}</td>
                  <td>{formatMoney(row.packageSalePayout)}</td>
                  <td>{formatMoney(row.tips)}</td>
                  <td>
                    <strong>{formatMoney(row.totalPayout)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Итого</strong>
                </td>
                <td>{report.totals.visitsCount}</td>
                <td>{formatMoney(report.totals.servicePayout)}</td>
                <td>{formatMoney(report.totals.packageVisitPayout)}</td>
                <td>{formatMoney(report.totals.packageSalePayout)}</td>
                <td>{formatMoney(report.totals.tips)}</td>
                <td>
                  <strong>{formatMoney(report.totals.totalPayout)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <label>
        Заметка
        <textarea
          placeholder="Например: перевод 05.07"
          rows="2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="payroll-actions">
        <button
          className="add-visit-button"
          disabled={report.employees.length === 0}
          type="submit">
          <CheckCircle2 size={16} />
          {existingRecord ? "Обновить выплату" : "Отметить выплаченным"}
        </button>
        {existingRecord ? (
          <>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onReopenPayrollRecord?.(existingRecord)}>
              Отменить отметку
            </button>
            <button
              aria-label="Удалить запись"
              className="secondary-button"
              type="button"
              onClick={() => onRemovePayrollRecord?.(existingRecord)}>
              <Trash2 size={15} />
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}

function PayrollPanel({
  getPayrollReport,
  markPayrollPaid,
  payrollRecords = [],
  removePayrollRecord,
  reopenPayrollRecord,
}) {
  const initialRange = getCurrentMonthPayrollRange();
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [formSeed, setFormSeed] = useState(`${initialRange.startDate}:${initialRange.endDate}`);

  const report = useMemo(
    () => getPayrollReport?.({endDate, startDate}),
    [endDate, getPayrollReport, startDate],
  );
  const existingRecord = useMemo(
    () => findPayrollRecord(payrollRecords, startDate, endDate),
    [endDate, payrollRecords, startDate],
  );
  const recentRecords = useMemo(
    () =>
      getRecentPayrollRecords(payrollRecords, 8).filter(
        (record) => record.periodKey !== report?.periodKey,
      ),
    [payrollRecords, report?.periodKey],
  );

  const applyRange = (range) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setFormSeed(`${range.startDate}:${range.endDate}`);
  };

  if (!report || !getPayrollReport) {
    return null;
  }

  return (
    <section className="panel payroll-panel">
      <PageHeader
        description="Комиссии мастеров по завершённым визитам и продажам пакетов"
        title="Payroll">
        {existingRecord ? (
          <span className="payroll-status is-paid">
            <Lock size={15} />
            Выплачено{" "}
            {new Date(existingRecord.paidAt).toLocaleString("ru-RU", {
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              month: "2-digit",
            })}
          </span>
        ) : (
          <span className="payroll-status is-open">
            <Unlock size={15} />
            Не закрыто
          </span>
        )}
      </PageHeader>

      <div className="payroll-quick-ranges">
        <button
          className="secondary-button"
          type="button"
          onClick={() => applyRange(getCurrentMonthPayrollRange())}>
          <Wallet size={15} />
          Этот месяц
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => applyRange(getPreviousMonthPayrollRange())}>
          Прошлый месяц
        </button>
      </div>

      <PayrollForm
        key={`${formSeed}-${existingRecord?.id ?? "open"}`}
        endDate={endDate}
        existingRecord={existingRecord}
        initialNote={existingRecord?.note ?? ""}
        report={report}
        startDate={startDate}
        onEndDateChange={setEndDate}
        onMarkPaid={markPayrollPaid}
        onRemovePayrollRecord={removePayrollRecord}
        onReopenPayrollRecord={reopenPayrollRecord}
        onStartDateChange={setStartDate}
      />

      {recentRecords.length > 0 ? (
        <div className="payroll-history">
          <strong>Недавние выплаты</strong>
          <ul>
            {recentRecords.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(normalizePayrollDate(record.startDate));
                    setEndDate(normalizePayrollDate(record.endDate));
                    setFormSeed(`${record.startDate}:${record.endDate}`);
                  }}>
                  <span>{formatPayrollPeriodLabel(record.startDate, record.endDate)}</span>
                  <b>{formatMoney(record.report?.totals?.totalPayout ?? 0)}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default PayrollPanel;
