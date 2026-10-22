import {useCallback, useEffect, useMemo, useState} from "react";
import {fetchPayrollRecords, fetchPayrollSummary} from "../../api/financial.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {AppIcon, Badge, Button, Card} from "../ui/index.js";

function getMonthBounds(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);

  const format = (d) => d.toISOString().slice(0, 10);
  return {startDate: format(start), endDate: format(end)};
}

export default function MyEarningsPage({
  authUser = null,
  visits = [],
  pushNotification,
}) {
  const [loading, setLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [activeTab, setActiveTab] = useState("visits"); // "visits" | "payouts"

  const employeeId = authUser?.employeeId ? Number(authUser.employeeId) : null;
  const employeeName = authUser?.name || authUser?.email?.split("@")[0] || "Мастер";

  // Selected period: default current month
  const [currentPeriod] = useState(() => getMonthBounds());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.allSettled([
        fetchPayrollRecords(),
        employeeId
          ? fetchPayrollSummary({
              employeeId,
              startDate: currentPeriod.startDate,
              endDate: currentPeriod.endDate,
            })
          : Promise.resolve(null),
      ]);

      if (recordsRes.status === "fulfilled" && Array.isArray(recordsRes.value?.data)) {
        setPayrollRecords(recordsRes.value.data);
      }
      if (summaryRes.status === "fulfilled" && summaryRes.value?.data) {
        setSummaryData(summaryRes.value.data);
      }
    } catch (err) {
      if (pushNotification) {
        pushNotification({
          title: "Ошибка загрузки начислений",
          message: err?.message || "Не удалось загрузить личные начисления",
          persist: false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, employeeId, pushNotification]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        void loadData();
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadData]);

  // Filter assigned completed visits in the period
  const periodVisits = useMemo(() => {
    if (!Array.isArray(visits)) return [];
    return visits
      .filter((v) => {
        const status = String(v.status || v.payload?.status || "").toLowerCase();
        const isCompleted = status === "completed" || Boolean(v.completed);
        if (!isCompleted) return false;

        const visitDate = (v.date || v.scheduledAt || v.inputDate || "").slice(0, 10);
        if (!visitDate) return false;
        if (visitDate < currentPeriod.startDate || visitDate > currentPeriod.endDate) {
          return false;
        }
        // If employeeId is known, verify assignment by id or master name
        if (employeeId) {
          const vEmpId = v.employeeId ?? v.payload?.employeeId;
          if (vEmpId && Number(vEmpId) === employeeId) return true;
          if (v.master && authUser?.name && v.master.toLowerCase() === authUser.name.toLowerCase()) return true;
          return false;
        }
        return false;
      })
      .sort((a, b) => {
        const da = a.date || a.scheduledAt || "";
        const db = b.date || b.scheduledAt || "";
        return db.localeCompare(da);
      });
  }, [visits, currentPeriod, employeeId, authUser]);

  // Calculate earnings from server payroll report totals.totalPayout or fallback to visits
  const totalEarned = useMemo(() => {
    if (summaryData?.totals?.totalPayout !== undefined && summaryData?.totals?.totalPayout !== null) {
      return Number(summaryData.totals.totalPayout);
    }
    if (summaryData?.totalEarnings !== undefined && summaryData?.totalEarnings !== null) {
      return Number(summaryData.totalEarnings);
    }
    return periodVisits.reduce((acc, v) => {
      const earning = Number(v.masterEarned || v.employeeEarning || v.commissionAmount || 0);
      return acc + earning;
    }, 0);
  }, [summaryData, periodVisits]);

  const totalRevenue = useMemo(() => {
    return periodVisits.reduce((acc, v) => {
      const price = Number(v.price || v.cost || v.amount || 0);
      return acc + price;
    }, 0);
  }, [periodVisits]);

  const salonCommission = useMemo(() => {
    return Math.max(0, totalRevenue - totalEarned);
  }, [totalRevenue, totalEarned]);

  const totalPaid = useMemo(() => {
    if (summaryData?.totalPaid !== undefined && summaryData?.totalPaid !== null) {
      return Number(summaryData.totalPaid);
    }
    return payrollRecords
      .filter((r) => {
        if (employeeId && r.employeeId && Number(r.employeeId) !== employeeId) {
          return false;
        }
        const paidDate = (r.paidAt || r.createdAt || "").slice(0, 10);
        return paidDate >= currentPeriod.startDate && paidDate <= currentPeriod.endDate;
      })
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  }, [summaryData, payrollRecords, currentPeriod, employeeId]);

  const balanceDue = useMemo(() => {
    if (summaryData?.balanceDue !== undefined && summaryData?.balanceDue !== null) {
      return Number(summaryData.balanceDue);
    }
    return Math.max(0, totalEarned - totalPaid);
  }, [summaryData, totalEarned, totalPaid]);

  const visitsCount = summaryData?.totals?.visitsCount ?? periodVisits.length;
  const tipsAmount = summaryData?.totals?.tips ? Number(summaryData.totals.tips) : 0;

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto flex flex-col gap-6 select-none">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border-soft">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-text-main m-0">
              Мой расчёт
            </h1>
            <Badge variant="neutral" size="sm">
              {employeeName}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1 m-0">
            Личные комиссии за визиты, расчёт выплат и история начислений •{" "}
            {new Date().toLocaleDateString("ru-RU", {month: "long", year: "numeric"})} ({currentPeriod.startDate} — {currentPeriod.endDate})
          </p>
        </div>

        <Button
          leftIcon="refresh"
          loading={loading}
          size="sm"
          variant="secondary"
          onClick={loadData}
        >
          Обновить
        </Button>
      </header>

      {/* Unlinked Master Alert / EmptyState */}
      {!employeeId && (
        <Card className="p-5 flex items-center gap-3.5 bg-accentWarning/10 border border-accentWarning/30 rounded-card">
          <AppIcon name="alertTriangle" size="lg" className="text-accentWarning shrink-0" />
          <div className="flex flex-col gap-0.5">
            <strong className="text-xs text-text-main font-bold">
              Учётная запись не привязана к профилю мастера
            </strong>
            <p className="text-xs text-text-muted m-0">
              Для автоматического расчёта выплат и комиссий обратитесь к администратору студии для привязки аккаунта в разделе «Доступы».
            </p>
          </div>
        </Card>
      )}

      {/* 6 KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4" aria-label="Сводка расчёта">
        {/* 1. Выполненные массажи */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Выполненные массажи</span>
          <strong className="text-lg md:text-xl font-bold text-text-main">
            {visitsCount}
          </strong>
          <span className="text-[11px] text-text-faint">
            {visitsCount === 1 ? "визит" : visitsCount >= 2 && visitsCount <= 4 ? "визита" : "визитов"}
            {tipsAmount > 0 && ` • чаевые ${formatMoney(tipsAmount)}`}
          </span>
        </Card>

        {/* 2. Расчётная выручка */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Расчётная выручка</span>
          <strong className="text-lg md:text-xl font-bold text-text-main">
            {formatMoney(totalRevenue)}
          </strong>
          <span className="text-[11px] text-text-faint">Оборот по визитам</span>
        </Card>

        {/* 3. Комиссия салона */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Комиссия салона</span>
          <strong className="text-lg md:text-xl font-bold text-text-muted">
            {formatMoney(salonCommission)}
          </strong>
          <span className="text-[11px] text-text-faint">Доля студии</span>
        </Card>

        {/* 4. Чистый заработок */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Чистый заработок</span>
          <strong className="text-lg md:text-xl font-bold text-text-main">
            {formatMoney(totalEarned)}
          </strong>
          <span className="text-[11px] text-text-faint">Начислено мастеру</span>
        </Card>

        {/* 5. Выплаты */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Выплаты</span>
          <strong className="text-lg md:text-xl font-bold text-accentSuccess">
            {formatMoney(totalPaid)}
          </strong>
          <span className="text-[11px] text-text-faint">Перечислено</span>
        </Card>

        {/* 6. Остаток к выплате */}
        <Card className="p-3.5 flex flex-col gap-1 bg-surface border border-border rounded-card">
          <span className="text-xs text-text-muted font-medium">Остаток к выплате</span>
          <strong className="text-lg md:text-xl font-bold text-accent">
            {formatMoney(balanceDue)}
          </strong>
          <span className="text-[11px] text-text-faint">Текущий баланс</span>
        </Card>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border-soft pb-1">
        <Button
          size="sm"
          variant={activeTab === "visits" ? "primary" : "ghost"}
          onClick={() => setActiveTab("visits")}
        >
          <AppIcon name="calendarDays" size="xs" />
          <span className="ml-1.5">Визиты и комиссии ({periodVisits.length})</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "payouts" ? "primary" : "ghost"}
          onClick={() => setActiveTab("payouts")}
        >
          <AppIcon name="receipt" size="xs" />
          <span className="ml-1.5">История выплат ({payrollRecords.length})</span>
        </Button>
      </div>

      {/* Tab 1: Visits Breakdown */}
      {activeTab === "visits" && (
        <section className="flex flex-col gap-3" aria-label="Список визитов">
          {periodVisits.length === 0 ? (
            <Card className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-surface/50 border border-border rounded-card">
              <AppIcon name="sun" size="xl" className="text-text-faint" />
              <p className="text-sm font-semibold text-text-main m-0">Нет завершённых визитов</p>
              <p className="text-xs text-text-muted m-0">В этом месяце пока нет начислений по визитам.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-field text-text-muted font-medium">
                    <th className="p-3">Дата / Время</th>
                    <th className="p-3">Клиент</th>
                    <th className="p-3">Услуга</th>
                    <th className="p-3 text-right">Стоимость</th>
                    <th className="p-3 text-right">Начислено</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {periodVisits.map((v, i) => {
                    const dateStr = v.date || v.scheduledAt || "";
                    const clientName = v.clientName || v.client || "Клиент";
                    const serviceName = v.serviceName || v.service || "Услуга";
                    const price = Number(v.price || v.cost || 0);
                    const earned = Number(v.masterEarned || v.employeeEarning || v.commissionAmount || 0);

                    return (
                      <tr key={v.id || i} className="hover:bg-field/50 transition-colors">
                        <td className="p-3 font-mono text-text-main whitespace-nowrap">
                          {dateStr ? dateStr.slice(0, 16).replace("T", " ") : "—"}
                        </td>
                        <td className="p-3 font-medium text-text-main whitespace-nowrap">
                          {clientName}
                        </td>
                        <td className="p-3 text-text-muted max-w-[200px] truncate" title={serviceName}>
                          {serviceName}
                        </td>
                        <td className="p-3 text-right font-mono text-text-muted whitespace-nowrap">
                          {formatMoney(price)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-accent whitespace-nowrap">
                          +{formatMoney(earned)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Payout Records */}
      {activeTab === "payouts" && (
        <section className="flex flex-col gap-3" aria-label="История выплат">
          {payrollRecords.length === 0 ? (
            <Card className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-surface/50 border border-border rounded-card">
              <AppIcon name="receipt" size="xl" className="text-text-faint" />
              <p className="text-sm font-semibold text-text-main m-0">Выплат пока нет</p>
              <p className="text-xs text-text-muted m-0">История фактических выплат появится здесь.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-field text-text-muted font-medium">
                    <th className="p-3">Дата выплаты</th>
                    <th className="p-3">Период</th>
                    <th className="p-3">Заметка / Способ</th>
                    <th className="p-3 text-right">Сумма выплаты</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {payrollRecords.map((r) => {
                    const dateStr = (r.paidAt || r.createdAt || "").slice(0, 10);
                    const periodStr = r.startDate && r.endDate ? `${r.startDate} — ${r.endDate}` : r.periodKey || "—";
                    const noteStr = r.note || r.payload?.note || "Выплата зарплаты";
                    const amount = Number(r.amount) || 0;

                    return (
                      <tr key={r.id} className="hover:bg-field/50 transition-colors">
                        <td className="p-3 font-mono text-text-main whitespace-nowrap">
                          {dateStr || "—"}
                        </td>
                        <td className="p-3 text-text-muted whitespace-nowrap">
                          {periodStr}
                        </td>
                        <td className="p-3 text-text-faint">
                          {noteStr}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-accentSuccess whitespace-nowrap">
                          {formatMoney(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
