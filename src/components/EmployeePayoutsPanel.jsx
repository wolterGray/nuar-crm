import {useCallback, useEffect, useMemo, useState} from "react";
import {
  cancelEmployeePayout,
  createEmployeePayout,
  fetchEmployeeEarningsDetail,
  fetchEmployeeEarningsSummary,
  fetchEmployeePayout,
  fetchEmployeePayouts,
} from "../api/employeePayouts.js";
import {formatMoney} from "../utils/formatters.jsx";
import {Button, EmptyState} from "./ui/index.js";

const toMoneyNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toInputDate = (date) => [
  String(date.getFullYear()).padStart(4, "0"),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const startOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getPeriodRange = (mode, customRange) => {
  const today = new Date();
  if (mode === "all") return {endDate: "", startDate: ""};
  if (mode === "custom") return customRange;

  if (mode === "thisWeek") {
    const start = startOfWeek(today);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {endDate: toInputDate(end), startDate: toInputDate(start)};
  }

  if (mode === "previousWeek") {
    const end = startOfWeek(today);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return {endDate: toInputDate(end), startDate: toInputDate(start)};
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {endDate: toInputDate(end), startDate: toInputDate(start)};
};

const formatDateTime = (earning) => {
  const visit = earning?.visit ?? {};
  const payload = visit.payload && typeof visit.payload === "object" ? visit.payload : visit;
  const date = payload.date || (visit.scheduledAt ? toInputDate(new Date(visit.scheduledAt)) : "");
  const time = payload.time || "";
  return [date, time].filter(Boolean).join(" ");
};

const getVisitLabel = (earning) => {
  const visit = earning?.visit ?? {};
  const payload = visit.payload && typeof visit.payload === "object" ? visit.payload : visit;
  return {
    client: payload.client || visit.client?.name || "Клиент",
    service: payload.service || visit.service?.name || "Услуга",
  };
};

function PeriodFilters({customRange, mode, onCustomRange, onMode}) {
  const filters = [
    ["thisWeek", "Эта неделя"],
    ["previousWeek", "Прошлая"],
    ["thisMonth", "Этот месяц"],
    ["all", "Всё время"],
    ["custom", "Период"],
  ];

  return (
    <div className="employee-payout-period-controls">
      {filters.map(([key, label]) => (
        <button
          className={`employee-payout-period-tab ${mode === key ? "is-active" : ""}`}
          key={key}
          type="button"
          onClick={() => onMode(key)}>
          {label}
        </button>
      ))}
      {mode === "custom" ? (
        <div className="employee-payout-period-dates">
          <input
            className="employee-payout-date-input"
            type="date"
            value={customRange.startDate}
            onChange={(event) => onCustomRange({...customRange, startDate: event.target.value})}
          />
          <input
            className="employee-payout-date-input"
            type="date"
            value={customRange.endDate}
            onChange={(event) => onCustomRange({...customRange, endDate: event.target.value})}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmployeeSummaryCard({row, selected, onOpen}) {
  return (
    <button
      className={`employee-card text-left transition ${selected ? "ring-2 ring-red-500" : ""}`}
      type="button"
      onClick={onOpen}>
      <div className="employee-card-top">
        <div className="employee-card-person">
          <div className="employee-avatar-tile">{row.employeeName.slice(0, 1)}</div>
          <div className="employee-card-title">
            <h3>{row.employeeName}</h3>
            <span>{row.visitsCount} массажей</span>
          </div>
        </div>
        <strong className="text-lg">{formatMoney(row.unpaid)}</strong>
      </div>
      <div className="employee-stats">
        <div>
          <span>Заработано</span>
          <strong>{formatMoney(row.earned)}</strong>
        </div>
        <div>
          <span>Выплачено</span>
          <strong>{formatMoney(row.paid)}</strong>
        </div>
        <div>
          <span>К выплате</span>
          <strong>{formatMoney(row.unpaid)}</strong>
        </div>
        <div>
          <span>Неоплачено</span>
          <strong>{row.unpaidCount}</strong>
        </div>
      </div>
    </button>
  );
}

function EarningRow({earning, checked, disabled = false, onPayOne, onToggle}) {
  const {client, service} = getVisitLabel(earning);
  const paid = Boolean(earning.payoutId);

  return (
    <article className={`employee-earning-row ${paid ? "is-paid" : ""}`}>
      {!paid ? (
        <input
          className="employee-earning-checkbox"
          type="checkbox"
          disabled={disabled}
          checked={checked}
          onChange={(event) => onToggle(earning.id, event.target.checked)}
        />
      ) : null}
      <div className="employee-earning-content">
        <div className="employee-earning-header">
          <strong>{formatDateTime(earning)}</strong>
          <span className={`payroll-status ${paid ? "is-paid" : "is-open"}`}>
            {paid ? "Выплачено" : "Не выплачено"}
          </span>
        </div>
        <p>{service} · {client}</p>
        <div className="employee-earning-stats">
          <span>Клиент: <b>{formatMoney(earning.actualPrice)}</b></span>
          <span>Комиссия: <b>{toMoneyNumber(earning.commissionPercent)}%</b></span>
          <span>Сотруднику: <b>{formatMoney(earning.amount)}</b></span>
        </div>
        {paid ? (
          <small>
            Выплата {earning.payout?.paidAt ? new Date(earning.payout.paidAt).toLocaleDateString("ru-RU") : ""}
          </small>
        ) : (
          <Button className="employee-earning-pay-button" disabled={disabled} size="sm" type="button" variant="secondary" onClick={() => onPayOne(earning.id)}>
            Отметить как выплачено
          </Button>
        )}
      </div>
    </article>
  );
}

function PayoutHistory({disabled = false, onCancel, onOpen, payouts}) {
  return (
    <section className="employee-payout-history">
      <h3>История выплат</h3>
      {payouts.length === 0 ? (
        <EmptyState description="История появится после первой выплаты." icon="wallet" title="Выплат пока нет" />
      ) : (
        payouts.slice(0, 12).map((payout) => (
          <article className="employee-payout-history-card" key={payout.id}>
            <button type="button" onClick={() => onOpen(payout.id)}>
              <div>
                <strong>{payout.paidAt ? new Date(payout.paidAt).toLocaleDateString("ru-RU") : "Дата не указана"}</strong>
                <b>{formatMoney(payout.amount)}</b>
              </div>
              <small>
                {payout.employee?.name || payout.employeeName || "Сотрудник"} · {payout.earnings?.length ?? 0} массажей · {payout.status}
              </small>
            </button>
            {payout.status !== "CANCELLED" ? (
              <Button disabled={disabled} size="sm" type="button" variant="secondary" onClick={() => onCancel(payout.id)}>
                Отменить выплату
              </Button>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}

function PayoutDetail({payout, onClose}) {
  if (!payout) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <section className="mx-auto max-h-[90vh] max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-xl font-bold">{payout.employee?.name || "Выплата"}</h3>
            <p className="m-0 text-sm text-text-muted">
              {payout.paidAt ? new Date(payout.paidAt).toLocaleString("ru-RU") : ""} · {formatMoney(payout.amount)}
            </p>
          </div>
          <Button size="sm" type="button" variant="secondary" onClick={onClose}>Закрыть</Button>
        </div>
        <div className="mt-4 space-y-2">
          {(payout.earnings ?? []).map((earning) => {
            const {client, service} = getVisitLabel(earning);
            return (
              <article className="rounded-lg border border-border-subtle p-3" key={earning.id}>
                <strong>{formatDateTime(earning)} · {service}</strong>
                <p className="m-0 text-sm">{client}</p>
                <small>
                  Клиент {formatMoney(earning.actualPrice)} · {toMoneyNumber(earning.commissionPercent)}% · сотруднику {formatMoney(earning.amount)}
                </small>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EmployeePayoutsPanel({pushNotification}) {
  const [mode, setMode] = useState("thisWeek");
  const [customRange, setCustomRange] = useState({endDate: "", startDate: ""});
  const [earningStatus, setEarningStatus] = useState("unpaid");
  const [summary, setSummary] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [detail, setDetail] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [payoutDetail, setPayoutDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const period = useMemo(() => getPeriodRange(mode, customRange), [customRange, mode]);
  const selectedEarnings = useMemo(
    () => (detail?.earnings ?? []).filter((earning) => selectedIds.has(earning.id) && !earning.payoutId),
    [detail, selectedIds],
  );
  const selectedTotal = selectedEarnings.reduce((sum, earning) => sum + toMoneyNumber(earning.amount), 0);
  const unpaidEarnings = (detail?.earnings ?? []).filter((earning) => !earning.payoutId);
  const paidEarnings = (detail?.earnings ?? []).filter((earning) => earning.payoutId);
  const visibleEarnings = earningStatus === "paid" ? paidEarnings : unpaidEarnings;
  const selectedEmployeePayouts = payouts.filter((payout) => {
    const payoutEmployeeId = payout.employeeId ?? payout.employee?.id;
    return !selectedEmployeeId || !payoutEmployeeId || String(payoutEmployeeId) === String(selectedEmployeeId);
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, payoutsResponse] = await Promise.all([
        fetchEmployeeEarningsSummary(period),
        fetchEmployeePayouts(),
      ]);
      const rows = Array.isArray(summaryResponse?.data?.rows) ? summaryResponse.data.rows : [];
      setSummary(rows);
      setPayouts(Array.isArray(payoutsResponse?.data) ? payoutsResponse.data : []);
      const nextEmployeeId = selectedEmployeeId || rows[0]?.employeeId || "";
      setSelectedEmployeeId(nextEmployeeId);
      if (nextEmployeeId) {
        const detailResponse = await fetchEmployeeEarningsDetail(nextEmployeeId, period);
        setDetail(detailResponse?.data ?? null);
      } else {
        setDetail(null);
      }
    } catch (error) {
      pushNotification?.({
        title: "Расчёты не загружены",
        message: error?.message || "Backend не вернул расчёты",
        persist: false,
      });
    } finally {
      setLoading(false);
    }
  }, [period, pushNotification, selectedEmployeeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openEmployee = async (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setSelectedIds(new Set());
    setEarningStatus("unpaid");
    try {
      const response = await fetchEmployeeEarningsDetail(employeeId, period);
      setDetail(response?.data ?? null);
    } catch (error) {
      pushNotification?.({title: "Начисления не загружены", message: error?.message, persist: false});
    }
  };

  const paySelected = async (earningIds) => {
    if (!selectedEmployeeId || earningIds.length === 0) return;
    setSaving(true);
    try {
      const response = await createEmployeePayout({
        employeeId: selectedEmployeeId,
        earningIds,
      });
      pushNotification?.({
        title: "Выплата сохранена",
        message: formatMoney(response?.data?.amount ?? 0),
      });
      setSelectedIds(new Set());
      await load();
    } catch (error) {
      pushNotification?.({title: "Выплата не сохранена", message: error?.message, persist: false});
    } finally {
      setSaving(false);
    }
  };

  const openPayout = async (id) => {
    try {
      const response = await fetchEmployeePayout(id);
      setPayoutDetail(response?.data ?? null);
    } catch (error) {
      pushNotification?.({title: "Выплата не открыта", message: error?.message, persist: false});
    }
  };

  const cancelPayout = async (id) => {
    setSaving(true);
    try {
      await cancelEmployeePayout(id);
      pushNotification?.({title: "Выплата отменена", message: "Начисления снова доступны к выплате"});
      await load();
    } catch (error) {
      pushNotification?.({title: "Выплата не отменена", message: error?.message, persist: false});
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="employee-payouts-panel">
      <div className="employee-payouts-header">
        <div>
          <h2>Расчёты</h2>
          <p>К выплате не обнуляется фильтрами: старые неоплаченные массажи остаются долгом.</p>
        </div>
        <PeriodFilters
          customRange={customRange}
          mode={mode}
          onCustomRange={setCustomRange}
          onMode={setMode}
        />
      </div>

      {loading ? <p className="employee-payouts-loading">Загружаем расчёты…</p> : null}

      <section className="employees-grid">
        {summary.map((row) => (
          <EmployeeSummaryCard
            key={row.employeeId}
            row={row}
            selected={String(row.employeeId) === String(selectedEmployeeId)}
            onOpen={() => openEmployee(row.employeeId)}
          />
        ))}
      </section>

      {detail ? (
        <section className="employee-payout-detail-layout">
          <div className="employee-payout-detail-main">
            <div className="employee-payout-detail-card">
              <div className="employee-payout-detail-head">
                <div>
                  <h3>{detail.employee?.name}</h3>
                  <small>
                    К выплате {formatMoney(detail.totals?.unpaid)} · {detail.totals?.unpaidCount ?? 0} неоплаченных
                  </small>
                </div>
                <div className="employee-payout-status-tabs" role="tablist" aria-label="Статус начислений">
                  <button
                    className={earningStatus === "unpaid" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={earningStatus === "unpaid"}
                    onClick={() => {
                      setEarningStatus("unpaid");
                      setSelectedIds(new Set());
                    }}>
                    Не выплачено <b>{unpaidEarnings.length}</b>
                  </button>
                  <button
                    className={earningStatus === "paid" ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={earningStatus === "paid"}
                    onClick={() => {
                      setEarningStatus("paid");
                      setSelectedIds(new Set());
                    }}>
                    Выплачено <b>{paidEarnings.length}</b>
                  </button>
                </div>
              </div>
              {earningStatus === "unpaid" ? (
                <div className="employee-payout-detail-actions">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    disabled={saving || unpaidEarnings.length === 0}
                    onClick={() => setSelectedIds(new Set(unpaidEarnings.map((earning) => earning.id)))}>
                    Выбрать все
                  </Button>
                  <Button
                    disabled={selectedIds.size === 0 || saving}
                    size="sm"
                    type="button"
                    variant="primary"
                    onClick={() => paySelected([...selectedIds])}>
                    Выплатить {formatMoney(selectedTotal)}
                  </Button>
                  {selectedIds.size > 0 ? (
                    <span className="employee-payout-selected-note">
                      {selectedIds.size} · {formatMoney(selectedTotal)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {visibleEarnings.length === 0 ? (
              <EmptyState
                description={earningStatus === "paid" ? "Здесь появятся уже выплаченные начисления." : "Начисления появятся после завершённых визитов."}
                icon="wallet"
                title={earningStatus === "paid" ? "Выплаченных пока нет" : "Начислений нет"}
              />
            ) : (
              <div className="employee-earning-list">
                {visibleEarnings.map((earning) => (
                  <EarningRow
                    checked={selectedIds.has(earning.id)}
                    disabled={saving}
                    earning={earning}
                    key={earning.id}
                    onPayOne={(id) => paySelected([id])}
                    onToggle={(id, checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked) next.add(id);
                        else next.delete(id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            )}
            {earningStatus === "paid" ? (
              <PayoutHistory disabled={saving} payouts={selectedEmployeePayouts} onCancel={cancelPayout} onOpen={openPayout} />
            ) : null}
          </div>
        </section>
      ) : (
        <EmptyState description="Завершите первый визит, чтобы увидеть задолженность по сотрудникам." icon="wallet" title="Расчётов пока нет" />
      )}

      <PayoutDetail payout={payoutDetail} onClose={() => setPayoutDetail(null)} />
    </section>
  );
}

export default EmployeePayoutsPanel;
