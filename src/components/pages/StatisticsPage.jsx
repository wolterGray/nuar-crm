import {
  AlertTriangle,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  Users,
  WalletCards,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCompactMoney,
  toDisplayDate,
} from "../../utils/formatters.jsx";
import {
  formatAppDate,
  getEndOfMonth,
  getPeriodDays,
  getStartOfMonth,
  getUpcomingVisitsWithinHours,
  shiftAppDate,
} from "../../utils/dateUtils.js";
import {
  buildFinanceStats,
  getVisitNetProfit,
  isCancelledVisit,
  toFinanceNumber,
  toFinanceInputDate,
} from "../../utils/finance.js";
import {getTodayInput} from "../../utils/dateHelpers.js";
import PageHeader from "../PageHeader.jsx";
import {
  createPaymentRingGradient,
  paymentGroups,
} from "../../utils/payments.js";
import {exportRowsToExcel} from "../../utils/exportExcel.js";

const CURRENCY_CACHE_KEY = "nuar-crm-nbp-rates";
const defaultRates = {PLN: 1, USD: 3.72, EUR: 4.28, UAH: 0.087};
const currencies = [
  {code: "PLN", label: "zł"},
  {code: "USD", label: "$"},
  {code: "EUR", label: "€"},
  {code: "UAH", label: "₴"},
];

const currencyIcons = {
  EUR: "€",
  PLN: "zł",
  UAH: "₴",
  USD: "$",
};

const revenueChartColor = "#3f2a63";

const getMonthStart = () => {
  return formatAppDate(getStartOfMonth(new Date()), "yyyy-MM-dd");
};

const formatChartDate = (date) => formatAppDate(date, "dd MMM");

function StatisticsPage({
  visits,
  calendarEntries = [],
  clientPackages,
  clients,
  employees,
}) {
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getTodayInput);
  const [master, setMaster] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [rates, setRates] = useState(() => {
    try {
      return {
        ...defaultRates,
        ...JSON.parse(window.localStorage.getItem(CURRENCY_CACHE_KEY)),
      };
    } catch {
      return defaultRates;
    }
  });

  useEffect(() => {
    Promise.all(
      ["USD", "EUR", "UAH"].map(async (code) => {
        const response = await fetch(
          `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
        );
        if (!response.ok) throw new Error("NBP unavailable");
        const data = await response.json();
        return [code, Number(data.rates?.[0]?.mid) || defaultRates[code]];
      }),
    )
      .then((entries) => {
        const nextRates = {...defaultRates, ...Object.fromEntries(entries)};
        setRates(nextRates);
        window.localStorage.setItem(
          CURRENCY_CACHE_KEY,
          JSON.stringify(nextRates),
        );
      })
      .catch(() => {});
  }, []);

  const formatIncome = (value) =>
    new Intl.NumberFormat("ru-RU", {
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: currency === "PLN" ? 1 : 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format((Number(value) || 0) / (rates[currency] || 1));
  const analytics = useMemo(() => {
    const dateRange = getPeriodDays(startDate, endDate);
    const financeStats = buildFinanceStats({
      calendarEntries,
      clientPackages,
      employees,
      endDate,
      master,
      startDate,
      visits,
    });
    const previousPeriodEnd = shiftAppDate(startDate, -1);
    const previousPeriodStart = shiftAppDate(
      previousPeriodEnd,
      -(dateRange.length - 1),
    );
    const previousStats = buildFinanceStats({
      calendarEntries,
      clientPackages,
      employees,
      endDate: previousPeriodEnd,
      master,
      startDate: previousPeriodStart,
      visits,
    });
    const fallbackForecastEndDate = formatAppDate(
      getEndOfMonth(new Date()),
      "yyyy-MM-dd",
    );
    const forecastStats =
      financeStats.forecastRevenue > 0
        ? financeStats
        : buildFinanceStats({
            calendarEntries,
            clientPackages,
            employees,
            endDate: fallbackForecastEndDate,
            master,
            startDate: getTodayInput(),
            visits,
          });
    const filteredVisits = financeStats.completedVisits;
    const filteredAppointments = financeStats.completedAppointments;
    const financialOperations = financeStats.financialOperations;
    const filteredPackages = financeStats.filteredPackages;
    const previousPeriodIncome = previousStats.netProfit;
    const clientNames = new Set(
      filteredAppointments.map((visit) => visit.client).filter(Boolean),
    );
    const repeatClients = [...clientNames].filter(
      (clientName) =>
        visits.filter(
          (visit) =>
            visit.recordType !== "operation" && visit.client === clientName,
        ).length > 1,
    ).length;
    const incomeRecordsCount =
      filteredAppointments.length +
      filteredPackages.length +
      financialOperations.length;
    const dates = dateRange.map((date) => {
      const dailyVisits = filteredVisits.filter(
        (visit) => toFinanceInputDate(visit.date) === date,
      );
      const dailyPackages = filteredPackages.filter(
        (item) => toFinanceInputDate(item.purchaseDate) === date,
      );
      const dailyOperations = financialOperations.filter(
        (visit) => toFinanceInputDate(visit.date) === date,
      );

      return {
        date,
        income:
          dailyVisits.reduce(
            (sum, visit) =>
              sum + getVisitNetProfit(visit, employees, clientPackages),
            0,
          ) +
          dailyPackages.reduce(
            (sum, item) => sum + toFinanceNumber(item.price),
            0,
          ) +
          dailyOperations.reduce(
            (sum, visit) => sum + getVisitNetProfit(visit, employees),
            0,
          ),
        visitsCount: dailyVisits.filter(
          (visit) => visit.recordType !== "operation",
        ).length,
      };
    });
    const payments = paymentGroups.map((group) => ({
      ...group,
      recordsCount: financeStats.paymentRecordsByMethod[group.key] || 0,
      value: financeStats.paymentsByMethod[group.key] || 0,
    }));
    const paymentTotal = payments.reduce((sum, item) => sum + item.value, 0);

    return {
      ...financeStats,
      averageCheck: financeStats.averageReceivedCheck,
      averageReceivedCheck: financeStats.averageReceivedCheck,
      averageVisitCheck: financeStats.averageVisitCheck,
      certificatesCount: financialOperations.filter(
        (visit) => visit.service === "Продажа сертификата",
      ).length,
      clientsCount: clientNames.size,
      dates,
      debts: financeStats.debtAmount,
      debtVisits: financeStats.debtVisits,
      certificateIncome: financeStats.certificateIncome,
      financialOperationsIncome:
        financeStats.operationsIncome - financeStats.certificateIncome,
      forecastIncome: forecastStats.forecastRevenue,
      forecastVisits: forecastStats.forecastVisits,
      filteredAppointments,
      filteredPackages,
      filteredVisits,
      incomeRecordsCount,
      packageIncome: financeStats.packageIncome,
      paymentTotal,
      payments,
      platformCommissions: financeStats.platformCommission,
      previousPeriodIncome,
      repeatClients,
      serviceRevenue: financeStats.discountedRevenue,
      totalIncome: financeStats.netProfit,
      totalReceived: financeStats.receivedRevenue,
      visitsReceived: financeStats.serviceReceived,
    };
  }, [
    calendarEntries,
    clientPackages,
    employees,
    endDate,
    master,
    startDate,
    visits,
  ]);

  const todaySnapshot = useMemo(() => {
    const today = getTodayInput();
    const now = new Date();
    const todayStats = buildFinanceStats({
      calendarEntries,
      clientPackages,
      employees,
      endDate: today,
      master,
      now,
      startDate: today,
      visits,
    });
    const todayCalendarVisits = calendarEntries.filter(
      (entry) =>
        entry.kind === "visit" &&
        entry.date === today &&
        !isCancelledVisit(entry) &&
        (!master || entry.master === master),
    );
    const upcomingVisits = getUpcomingVisitsWithinHours(
      todayCalendarVisits,
      3,
      now,
    );

    return {
      completedVisits: todayStats.completedAppointments.length,
      debtAmount: todayStats.debtAmount,
      debtVisits: todayStats.debtVisits.length,
      received: todayStats.receivedRevenue,
      scheduledVisits: todayCalendarVisits.length,
      upcomingVisits,
    };
  }, [calendarEntries, clientPackages, employees, master, visits]);

  const chartData = groupChartDates(analytics.dates);
  const periodChangePercent =
    analytics.previousPeriodIncome > 0
      ? ((analytics.totalIncome - analytics.previousPeriodIncome) /
          analytics.previousPeriodIncome) *
        100
      : null;
  const activePayments = analytics.payments.filter(
    (item) => item.recordsCount > 0,
  );
  const unknownPayment =
    analytics.payments.find((item) => item.label === "Не указано") || {};
  const businessExtraIncome =
    analytics.packageIncome +
    analytics.certificateIncome +
    analytics.financialOperationsIncome;
  const incomeScopeLabel = master ? `Доход мастера ${master}` : "Доход бизнеса";
  const kpiStats = [
    {
      label: "Клиенты",
      value: analytics.clientsCount,
      helper: `${analytics.repeatClients} повторных`,
      icon: Users,
      color: "#8ba7d8",
    },
    {
      label: "Визиты",
      value: analytics.filteredAppointments.length,
      helper: "завершено",
      icon: CalendarRange,
      color: "#8fc5aa",
    },
    {
      label: "Средний чек",
      value: formatIncome(analytics.averageCheck),
      icon: Banknote,
      color: "#b7a0d6",
    },
    {
      label: "Долги",
      value: formatIncome(analytics.outstandingDebts),
      helper:
        analytics.debts > 0
          ? `${analytics.debtVisits.length} в периоде`
          : `${analytics.allDebtVisits.length} всего`,
      icon: WalletCards,
      color: "#d99a9a",
    },
  ];
  const repeatRate =
    (analytics.repeatClients / Math.max(analytics.clientsCount, 1)) * 100;
  const activityStats = [
    ["Пакетов продано", analytics.filteredPackages.length],
    ["Сертификатов", analytics.certificatesCount],
    ["Клиентов в базе", clients.length],
    ["Возвратность", `${Math.round(repeatRate)}%`],
  ];
  const earnings = [
    ["Массажи после скидок", analytics.serviceRevenue],
    ["Продажи пакетов", analytics.packageIncome],
    ["Сертификаты", analytics.certificateIncome],
    ["Прочие поступления", analytics.financialOperationsIncome],
    ["Чаевые", analytics.tips],
    ["Доп. услуги", analytics.extras],
    ["Долги клиентов", -analytics.debts],
    ["Скидки предоставлено", -analytics.discounts],
    ["Выплаты мастерам", -analytics.employeePayouts],
    ["Комиссии платформ", -analytics.platformCommissions],
  ];
  const paymentRows = analytics.payments.filter(
    (item) => item.recordsCount > 0 || item.value > 0,
  );
  const attentionItems = [];

  if (analytics.outstandingDebts > 0) {
    attentionItems.push({
      tone: "danger",
      title: "Есть долги клиентов",
      text: `${analytics.allDebtVisits.length} записей · ${formatIncome(
        analytics.outstandingDebts,
      )}`,
    });
  }

  if ((unknownPayment.recordsCount || 0) > 0) {
    attentionItems.push({
      tone: "warning",
      title: "Есть оплаты без способа",
      text: `${unknownPayment.recordsCount} записей · ${formatIncome(
        unknownPayment.value || 0,
      )}`,
    });
  }

  if (attentionItems.length === 0) {
    attentionItems.push({
      tone: "good",
      title: "Финансы выглядят аккуратно",
      text: "Критичных долгов и неразобранных оплат за период не найдено.",
    });
  }

  const exportStatistics = () => {
    const rows = [
      {
        metric: "Чистая прибыль",
        section: "Итог",
        value: formatIncome(analytics.totalIncome),
        valuePln: analytics.totalIncome,
      },
      {
        metric: "Поступления",
        section: "Итог",
        value: formatIncome(analytics.totalReceived),
        valuePln: analytics.totalReceived,
      },
      {
        metric: "Прогноз",
        section: "Итог",
        value: formatIncome(analytics.forecastIncome),
        valuePln: analytics.forecastIncome,
      },
      {
        metric: "Долги клиентов",
        section: "Сигналы",
        value: formatIncome(analytics.outstandingDebts),
        valuePln: analytics.outstandingDebts,
      },
      {
        metric: "Завершённые визиты",
        section: "Активность",
        value: analytics.filteredAppointments.length,
        valuePln: "",
      },
      {
        metric: "Клиенты за период",
        section: "Активность",
        value: analytics.clientsCount,
        valuePln: "",
      },
      {
        metric: "Средний чек визита",
        section: "Активность",
        value: formatIncome(analytics.averageVisitCheck),
        valuePln: analytics.averageVisitCheck,
      },
      ...paymentRows.map((item) => ({
        metric: item.label,
        section: "Оплаты",
        value: formatIncome(item.value),
        valuePln: item.value,
      })),
      ...earnings.map(([label, value]) => ({
        metric: label,
        section: "Финансовая разбивка",
        value: formatIncome(value),
        valuePln: value,
      })),
    ];

    exportRowsToExcel({
      columns: [
        {label: "Раздел", value: "section"},
        {label: "Метрика", value: "metric"},
        {label: "Значение", value: "value"},
        {label: "PLN", value: "valuePln"},
      ],
      fileName: `nuar-statistics-${startDate}-${endDate}.xlsx`,
      rows,
      sheetName: "Статистика",
    });
  };

  return (
    <section className="statistics-page">
      <PageHeader
        className="statistics-hero-header"
        description="Финансы, визиты и сигналы по клиентам"
        headerActions={
          <button
            className="statistics-export-button"
            type="button"
            onClick={exportStatistics}>
            <Download size={15} />
            <span>Экспорт Excel</span>
          </button>
        }
        title="Статистика"
      />

      <div className="statistics-filters-card">
        <div className="statistics-filters">
          <label>
            <CalendarRange size={15} />
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <span>—</span>
          <label>
            <CalendarRange size={15} />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <select
            value={master}
            onChange={(event) => setMaster(event.target.value)}>
            <option value="">Все сотрудники</option>
            {employees.map((employee) => (
              <option key={employee.id}>{employee.name}</option>
            ))}
          </select>
          <select
            aria-label="Валюта отчёта"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <article className="statistics-panel statistics-today-panel">
        <div className="statistics-panel-title">
          <div>
            <h3>Сегодня</h3>
            <p>{toDisplayDate(getTodayInput())}</p>
          </div>
        </div>
        <div className="statistics-today-grid">
          <StatisticsCard
            item={{
              color: "#8fc5aa",
              helper: `${todaySnapshot.completedVisits} завершено`,
              icon: CalendarRange,
              label: "Визиты",
              value: todaySnapshot.scheduledVisits,
            }}
          />
          <StatisticsCard
            item={{
              color: "#b7a0d6",
              icon: Banknote,
              label: "Поступления",
              value: formatIncome(todaySnapshot.received),
            }}
          />
          <StatisticsCard
            item={{
              color: "#d99a9a",
              helper:
                todaySnapshot.debtVisits > 0
                  ? `${todaySnapshot.debtVisits} записей`
                  : "нет долгов",
              icon: WalletCards,
              label: "Долги",
              value: formatIncome(todaySnapshot.debtAmount),
            }}
          />
          <StatisticsCard
            item={{
              color: "#8ba7d8",
              helper: "следующие 3 часа",
              icon: Clock3,
              label: "Ближайшие",
              value: todaySnapshot.upcomingVisits.length,
            }}
          />
        </div>
        {todaySnapshot.upcomingVisits.length > 0 && (
          <ul className="statistics-today-upcoming">
            {todaySnapshot.upcomingVisits.map((entry) => (
              <li key={entry.id ?? `${entry.time}-${entry.client}`}>
                <strong>{entry.time}</strong>
                <span>{entry.client || "Без клиента"}</span>
                <small>{entry.service || "Визит"}</small>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="statistics-income-card">
        <div className="statistics-income-top">
          <div>
            <span>{incomeScopeLabel}</span>
            <strong>{formatIncome(analytics.totalIncome)}</strong>
            <p>
              Поступления {formatIncome(analytics.totalReceived)} ·{" "}
              {toDisplayDate(startDate)} — {toDisplayDate(endDate)}
            </p>
            <small className="statistics-income-context">
              {master
                ? "Показаны визиты выбранного мастера и проданные им пакеты. Операции без мастера остаются только в общем доходе бизнеса."
                : businessExtraIncome > 0
                  ? `Включает доп. доход бизнеса: ${formatIncome(
                      businessExtraIncome,
                    )} · пакеты, сертификаты и операции.`
                  : "Считаются завершённые визиты и финансовые операции за период."}
            </small>
          </div>
          <div className="statistics-income-icon">
            <span>{currencyIcons[currency] || currency}</span>
          </div>
        </div>
        <div className="statistics-income-strip">
          <span>
            Прогноз <b>{formatIncome(analytics.forecastIncome)}</b>
          </span>
          <span>
            Завершено <b>{analytics.filteredAppointments.length}</b>
          </span>
          <span>
            Средний чек <b>{formatIncome(analytics.averageCheck)}</b>
          </span>
        </div>
        <div className="statistics-chart-heading">
          <span>Динамика дохода</span>
          <strong
            className={
              periodChangePercent === null
                ? ""
                : periodChangePercent >= 0
                  ? "positive"
                  : "negative"
            }>
            {periodChangePercent === null
              ? "Нет прошлого периода"
              : `${periodChangePercent >= 0 ? "↑" : "↓"} ${Math.abs(
                  Math.round(periodChangePercent),
                )}% к прошлому периоду`}
          </strong>
        </div>
        {chartData.length < 2 ? (
          <div className="statistics-chart-empty">
            Недостаточно данных для построения динамики дохода
          </div>
        ) : (
          <div className="statistics-revenue-chart">
            <div className="statistics-revenue-chart-frame">
              <ResponsiveContainer
                width="100%"
                height={190}
                minWidth={260}
                minHeight={190}>
                <AreaChart
                  data={chartData}
                  margin={{top: 10, right: 8, left: -10, bottom: 0}}>
                  <defs>
                    <linearGradient
                      id="statisticsRevenueGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1">
                      <stop
                        offset="5%"
                        stopColor={revenueChartColor}
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="95%"
                        stopColor={revenueChartColor}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(126, 137, 151, 0.18)"
                    strokeDasharray="4 6"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    interval="preserveStartEnd"
                    minTickGap={12}
                    tick={{fill: "#8a8f98", fontSize: 11}}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{
                      fill: "#8a8f98",
                      fontSize: 10,
                    }}
                    tickFormatter={(value) =>
                      formatCompactMoney(value).replace(" zł", "")
                    }
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={<RevenueTooltip formatIncome={formatIncome} />}
                    cursor={{fill: "rgba(63, 42, 99, 0.08)"}}
                  />
                  <Area
                    dataKey="income"
                    dot={{
                      fill: "#fff",
                      r: 3,
                      stroke: revenueChartColor,
                      strokeWidth: 2,
                    }}
                    fill="url(#statisticsRevenueGradient)"
                    isAnimationActive={false}
                    stroke={revenueChartColor}
                    strokeWidth={2.4}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </article>

      <article className="statistics-panel statistics-attention-panel">
        <div className="statistics-panel-title">
          <div>
            <h3>Требует внимания</h3>
            <p>Самые важные сигналы по деньгам</p>
          </div>
        </div>
        <div className="statistics-attention-list">
          {attentionItems.map((item) => (
            <div
              className={`statistics-attention-item ${item.tone}`}
              key={item.title}>
              {item.tone === "good" ? (
                <CheckCircle2 size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
              <span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="statistics-kpi-grid">
        {kpiStats.map((item) => (
          <StatisticsCard item={item} key={item.label} />
        ))}
      </div>

      <article className="statistics-panel statistics-payments-panel">
        <div className="statistics-panel-title">
          <div>
            <h3>Оплаты</h3>
            <p>Наличные, карта, укр. карта, пакеты и неразобранные оплаты</p>
          </div>
          <strong>{formatIncome(analytics.paymentTotal)}</strong>
        </div>
        <div className="statistics-payment-bars">
          {paymentRows.map((item) => (
            <PaymentRow
              item={item}
              key={item.label}
              total={analytics.paymentTotal}
              value={formatIncome(item.value)}
            />
          ))}
        </div>
      </article>

      <details className="statistics-details-panel">
        <summary>
          <span>
            <strong>Подробная финансовая аналитика</strong>
            <small>Разбивка дохода, пакеты, сертификаты и возвратность</small>
          </span>
        </summary>
        <div className="statistics-business-grid statistics-business-grid-bottom">
          <article className="statistics-panel statistics-breakdown-panel">
            <div className="statistics-panel-title">
              <div>
                <h3>Финансовая разбивка</h3>
                <p>Из чего складывается чистый доход</p>
              </div>
              <div
                className="percent-ring dynamic-payment-ring statistics-ring"
                style={{
                  "--payment-ring-gradient":
                    createPaymentRingGradient(activePayments),
                }}>
                <strong>
                  {formatCompactMoney(
                    analytics.totalIncome / (rates[currency] || 1),
                  )}
                </strong>
                <span>{currency}</span>
              </div>
            </div>
            <div className="statistics-breakdown-list">
              {earnings.map(([label, value]) => (
                <span key={label}>
                  {label}
                  <strong className={value < 0 ? "negative" : ""}>
                    {formatIncome(value)}
                  </strong>
                </span>
              ))}
            </div>
          </article>

          <article className="statistics-panel statistics-activity-panel">
            <div className="statistics-panel-title">
              <div>
                <h3>Активность</h3>
                <p>Клиенты, пакеты и сертификаты</p>
              </div>
            </div>
            <div className="statistics-activity-grid">
              {activityStats.map(([label, value]) => (
                <span key={label}>
                  {label}
                  <strong>{value}</strong>
                </span>
              ))}
            </div>
          </article>
        </div>
      </details>
    </section>
  );
}

function StatisticsCard({item, primary = false}) {
  const Icon = item.icon;

  return (
    <article
      className={`statistics-card ${primary ? "statistics-card-primary" : "statistics-card-secondary"}`}
      style={{"--statistics-card-color": item.color}}>
      <div>
        <Icon size={17} />
      </div>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      {item.helper && <small>{item.helper}</small>}
    </article>
  );
}

function PaymentRow({item, total, value}) {
  const percent = Math.round((item.value / Math.max(total, 1)) * 100);

  return (
    <div className="statistics-payment-row">
      <div>
        <i style={{background: item.color}} />
        <span>{item.label}</span>
        <strong>{value}</strong>
      </div>
      <div className="statistics-payment-track">
        <b
          style={{width: `${Math.min(percent, 100)}%`, background: item.color}}
        />
      </div>
      <small>
        {item.recordsCount} записей · {percent}%
      </small>
    </div>
  );
}

function RevenueTooltip({active, payload, formatIncome}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="statistics-revenue-tooltip">
      <strong>{item.tooltipDate}</strong>
      <span>{formatIncome(item.income)}</span>
      <small>{item.visitsCount} визитов</small>
    </div>
  );
}

const groupChartDates = (dates) => {
  if (dates.length <= 31) {
    return dates.map((item) => ({
      ...item,
      key: item.date,
      label: formatChartDate(item.date),
      tooltipDate: formatChartDate(item.date),
    }));
  }

  const groups = [];

  for (let index = 0; index < dates.length; index += 7) {
    const chunk = dates.slice(index, index + 7);
    const firstDate = chunk[0].date;
    const lastDate = chunk.at(-1).date;

    groups.push({
      key: `${firstDate}-${lastDate}`,
      label: `${formatChartDate(firstDate)}–${formatChartDate(lastDate)}`,
      tooltipDate: `${formatChartDate(firstDate)} — ${formatChartDate(
        lastDate,
      )}`,
      income: chunk.reduce((sum, item) => sum + item.income, 0),
      visitsCount: chunk.reduce((sum, item) => sum + item.visitsCount, 0),
    });
  }

  return groups;
};

export default StatisticsPage;
