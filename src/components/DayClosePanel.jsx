import {Calculator, CheckCircle2, Lock, Trash2, Unlock} from "lucide-react";
import {useMemo, useState} from "react";
import PageHeader from "./PageHeader.jsx";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {
  buildDayCloseBreakdown,
  calculateDayCloseVariance,
  findDayCloseRecord,
  formatDayCloseLabel,
  formatDayCloseVariance,
  getRecentDayCloseRecords,
  normalizeCloseDate,
  parseDayCloseAmount,
} from "../utils/dayClose.js";
import {formatMoney} from "../utils/formatters.jsx";

function DayCloseForm({
  breakdown,
  existingRecord,
  journal,
  onCloseDay,
  onReopenDayClose,
  onRemoveDayClose,
  selectedDate,
  onSelectedDateChange,
}) {
  const [actualCash, setActualCash] = useState(() =>
    String(existingRecord?.actual?.cashInDrawer ?? ""),
  );
  const [cashWithdrawal, setCashWithdrawal] = useState(() =>
    String(existingRecord?.actual?.cashWithdrawal ?? ""),
  );
  const [note, setNote] = useState(() => existingRecord?.note ?? "");
  const previewVariance = useMemo(
    () =>
      calculateDayCloseVariance({
        actualCashInDrawer: parseDayCloseAmount(actualCash),
        cashWithdrawal: parseDayCloseAmount(cashWithdrawal),
        journalCash: journal.cashReceived ?? 0,
      }),
    [actualCash, cashWithdrawal, journal.cashReceived],
  );

  const handleSubmit = (event) => {
    event.preventDefault();

    onCloseDay?.({
      actualCashInDrawer: parseDayCloseAmount(actualCash),
      cashWithdrawal: parseDayCloseAmount(cashWithdrawal),
      date: selectedDate,
      note,
    });
  };

  return (
    <form className="day-close-form" onSubmit={handleSubmit}>
      <label>
        Дата
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onSelectedDateChange(event.target.value)}
        />
      </label>

      <div className="day-close-summary-grid">
        <article className="day-close-summary-card">
          <span>Поступления</span>
          <strong>{formatMoney(journal.receivedRevenue)}</strong>
          <small>{journal.completedVisits} визитов</small>
        </article>
        <article className="day-close-summary-card">
          <span>Нал по журналу</span>
          <strong>{formatMoney(journal.cashReceived)}</strong>
          <small>Чаевые: {formatMoney(journal.tips)}</small>
        </article>
        <article className="day-close-summary-card">
          <span>Карта / BLIK</span>
          <strong>
            {formatMoney(
              (journal.cardReceived ?? 0) +
                (journal.paymentsByMethod?.blik ?? 0) +
                (journal.paymentsByMethod?.mono ?? 0),
            )}
          </strong>
          <small>Расходы: {formatMoney(journal.expenses)}</small>
        </article>
        <article className="day-close-summary-card">
          <span>Чистая прибыль</span>
          <strong>{formatMoney(journal.netProfit)}</strong>
          <small>Операции: {formatMoney(journal.operationsIncome)}</small>
        </article>
      </div>

      {breakdown.length > 0 ? (
        <div className="day-close-breakdown">
          <strong>По способам оплаты</strong>
          <ul>
            {breakdown.map((item) => (
              <li key={item.key}>
                <span>
                  <i style={{background: item.color}} />
                  {item.label}
                </span>
                <b>{formatMoney(item.value)}</b>
                <small>{item.count} опл.</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="day-close-empty">За этот день в журнале пока нет оплат.</p>
      )}

      <div className="day-close-inputs">
        <label>
          Нал в кассе фактически
          <input
            inputMode="decimal"
            min="0"
            placeholder="0"
            step="0.01"
            type="number"
            value={actualCash}
            onChange={(event) => setActualCash(event.target.value)}
          />
        </label>
        <label>
          Выемка / сдача
          <input
            inputMode="decimal"
            min="0"
            placeholder="0"
            step="0.01"
            type="number"
            value={cashWithdrawal}
            onChange={(event) => setCashWithdrawal(event.target.value)}
          />
        </label>
      </div>

      <div
        className={`day-close-variance ${
          previewVariance.variance === 0
            ? "is-balanced"
            : previewVariance.variance > 0
              ? "is-surplus"
              : "is-shortage"
        }`}>
        <Calculator size={16} />
        <div>
          <strong>{formatDayCloseVariance(previewVariance.variance)}</strong>
          <span>
            Ожидалось в кассе: {formatMoney(previewVariance.expectedCash)} · по журналу
            нал: {formatMoney(journal.cashReceived)}
          </span>
        </div>
      </div>

      <label>
        Заметка
        <textarea
          placeholder="Комментарий к закрытию смены"
          rows="2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="day-close-actions">
        <button className="add-visit-button" type="submit">
          <CheckCircle2 size={16} />
          {existingRecord ? "Обновить закрытие" : "Закрыть день"}
        </button>
        {existingRecord ? (
          <>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onReopenDayClose?.(existingRecord)}>
              Отменить закрытие
            </button>
            <button
              aria-label="Удалить запись"
              className="secondary-button"
              type="button"
              onClick={() => onRemoveDayClose?.(existingRecord)}>
              <Trash2 size={15} />
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}

function DayClosePanel({
  dayCloseRecords = [],
  getJournalForDate,
  onCloseDay,
  onReopenDayClose,
  onRemoveDayClose,
}) {
  const {isMobile} = useBreakpoint();
  const [selectedDate, setSelectedDate] = useState(getTodayInput());
  const journal = useMemo(
    () => getJournalForDate?.(selectedDate),
    [getJournalForDate, selectedDate],
  );
  const breakdown = useMemo(
    () => (journal ? buildDayCloseBreakdown(journal) : []),
    [journal],
  );
  const existingRecord = useMemo(
    () => findDayCloseRecord(dayCloseRecords, selectedDate),
    [dayCloseRecords, selectedDate],
  );
  const recentRecords = useMemo(
    () =>
      getRecentDayCloseRecords(dayCloseRecords, 10).filter(
        (record) => normalizeCloseDate(record.date) !== normalizeCloseDate(selectedDate),
      ),
    [dayCloseRecords, selectedDate],
  );

  if (!journal || !getJournalForDate) {
    return null;
  }

  return (
    <details className="day-close-collapsible" open={!isMobile}>
      <summary className="day-close-collapsible-summary">
        <span>Закрытие дня</span>
        {existingRecord ? (
          <span className="day-close-status is-closed">
            <Lock size={14} />
            Закрыт
          </span>
        ) : (
          <span className="day-close-status is-open">
            <Unlock size={14} />
            Открыт
          </span>
        )}
      </summary>
    <section className="panel day-close-panel">
      <PageHeader
        description="Сверка наличных и поступлений по журналу за выбранный день"
        showNotifications={false}
        title="Закрытие дня">
        {existingRecord ? (
          <span className="day-close-status is-closed">
            <Lock size={15} />
            Закрыт{" "}
            {new Date(existingRecord.closedAt).toLocaleString("ru-RU", {
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              month: "2-digit",
            })}
          </span>
        ) : (
          <span className="day-close-status is-open">
            <Unlock size={15} />
            Открыт
          </span>
        )}
      </PageHeader>

      <DayCloseForm
        key={`${selectedDate}-${existingRecord?.id ?? "open"}`}
        breakdown={breakdown}
        existingRecord={existingRecord}
        journal={journal}
        selectedDate={selectedDate}
        onCloseDay={onCloseDay}
        onReopenDayClose={onReopenDayClose}
        onRemoveDayClose={onRemoveDayClose}
        onSelectedDateChange={setSelectedDate}
      />

      {recentRecords.length > 0 ? (
        <div className="day-close-history">
          <strong>Недавние закрытия</strong>
          <ul>
            {recentRecords.map((record) => (
              <li key={record.id}>
                <button type="button" onClick={() => setSelectedDate(record.date)}>
                  <span>{formatDayCloseLabel(record.date)}</span>
                  <b>{formatDayCloseVariance(record.variance)}</b>
                  <small>{formatMoney(record.journal?.receivedRevenue ?? 0)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
    </details>
  );
}

export default DayClosePanel;
