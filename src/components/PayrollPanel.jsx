import {useEffect, useMemo, useState} from "react";
import PageHeader from "./PageHeader.jsx";
import {AppIcon, Button, EmptyState, Field, IconButton, Input, Textarea} from "./ui/index.js";
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
  embeddedMobile = false,
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
      className={`payroll-form${embeddedMobile ? " payroll-form-embedded-mobile" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onMarkPaid?.({endDate, note, startDate});
      }}>
      <div
        className={`payroll-period-row${
          embeddedMobile ? " payroll-period-row-embedded-mobile" : ""
        }`}>
        <Field label="С">
          <Input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </Field>
        <Field label="По">
          <Input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </Field>
      </div>

      {report.employees.length === 0 ? (
        <EmptyState
          className="payroll-empty"
          icon="wallet"
          title="Начислений нет"
          description="За выбранный период начислений нет."
        />
      ) : (
        <>
          {embeddedMobile ? (
            <div className="payroll-period-summary-grid">
              <article className="day-close-summary-card">
                <span>Мастеров</span>
                <strong>{report.employees.length}</strong>
                <small>в расчёте</small>
              </article>
              <article className="day-close-summary-card">
                <span>Визитов</span>
                <strong>{report.totals.visitsCount}</strong>
                <small>за период</small>
              </article>
              <article className="day-close-summary-card">
                <span>Чаевые</span>
                <strong>{formatMoney(report.totals.tips)}</strong>
                <small>учтены</small>
              </article>
              <article className="day-close-summary-card">
                <span>К выплате</span>
                <strong>{formatMoney(report.totals.totalPayout)}</strong>
                <small>итого</small>
              </article>
            </div>
          ) : (
            <div className="payroll-hero">
              <div className="payroll-hero-main">
                <span>К выплате за период</span>
                <strong>{formatMoney(report.totals.totalPayout)}</strong>
              </div>
              <div className="payroll-hero-meta">
                <span>{report.totals.visitsCount} визитов</span>
                <span>{report.employees.length} мастеров</span>
              </div>
            </div>
          )}
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
        </>
      )}

      <Field label="Заметка">
        <Textarea
          placeholder="Например: перевод 05.07"
          rows="2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <div className="payroll-actions">
        <Button
          className="add-visit-button"
          disabled={report.employees.length === 0}
          leftIcon="check"
          variant="primary"
          type="submit">
          {existingRecord ? "Обновить выплату" : "Отметить выплаченным"}
        </Button>
        {existingRecord ? (
          <>
            <Button
              className="secondary-button"
              variant="secondary"
              onClick={() => onReopenPayrollRecord?.(existingRecord)}>
              Отменить отметку
            </Button>
            <IconButton
              className="secondary-button"
              icon="trash"
              label="Удалить запись"
              variant="secondary"
              onClick={() => onRemovePayrollRecord?.(existingRecord)}>
            </IconButton>
          </>
        ) : null}
      </div>
    </form>
  );
}

function PayrollPanel({
  embeddedMobile = false,
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
  const activeRangeKey = `${startDate}:${endDate}`;
  const [reportState, setReportState] = useState({
    rangeKey: activeRangeKey,
    report: null,
  });

  useEffect(() => {
    let cancelled = false;
    const rangeKey = `${startDate}:${endDate}`;

    if (!getPayrollReport) {
      return () => {
        cancelled = true;
      };
    }

    getPayrollReport({endDate, startDate})
      .then((nextReport) => {
        if (!cancelled) {
          setReportState({rangeKey, report: nextReport});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReportState({rangeKey, report: null});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endDate, getPayrollReport, startDate]);
  const report = reportState.rangeKey === activeRangeKey ? reportState.report : null;
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
    <section
      className={`panel payroll-panel${
        embeddedMobile ? " payroll-panel-embedded-mobile" : ""
      }`}>
      {embeddedMobile ? (
        <div className="payroll-embedded-status">
          {existingRecord ? (
            <span className="payroll-status is-paid">
              <AppIcon name="shield" size="sm" />
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
              <AppIcon name="clock" size="sm" />
              Не закрыто
            </span>
          )}
        </div>
      ) : (
        <PageHeader
          description="Комиссии мастеров по завершённым визитам и продажам пакетов"
          showNotifications={false}
          title="Payroll">
          {existingRecord ? (
            <span className="payroll-status is-paid">
              <AppIcon name="shield" size="sm" />
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
              <AppIcon name="clock" size="sm" />
              Не закрыто
            </span>
          )}
        </PageHeader>
      )}

      <div
        className={`payroll-quick-ranges${
          embeddedMobile ? " payroll-quick-ranges-embedded-mobile" : ""
        }`}>
        <Button
          className="secondary-button"
          leftIcon="wallet"
          variant="secondary"
          onClick={() => applyRange(getCurrentMonthPayrollRange())}>
          Этот месяц
        </Button>
        <Button
          className="secondary-button"
          variant="secondary"
          onClick={() => applyRange(getPreviousMonthPayrollRange())}>
          Прошлый месяц
        </Button>
      </div>

      <PayrollForm
        embeddedMobile={embeddedMobile}
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
                <Button
                  className="payroll-history-button"
                  fullWidth
                  variant="ghost"
                  onClick={() => {
                    setStartDate(normalizePayrollDate(record.startDate));
                    setEndDate(normalizePayrollDate(record.endDate));
                    setFormSeed(`${record.startDate}:${record.endDate}`);
                  }}>
                  <span>{formatPayrollPeriodLabel(record.startDate, record.endDate)}</span>
                  <b>{formatMoney(record.report?.totals?.totalPayout ?? 0)}</b>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default PayrollPanel;
