import {useEffect, useMemo, useState} from "react";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import HintIcon from "../HintIcon.jsx";
import {
  formatCompactMoney,
  toDisplayDate,
} from "../../utils/formatters.jsx";
import {
  formatAppDate,
  getPeriodDays,
  getStartOfMonth,
  getUpcomingVisitsWithinHours,
  shiftAppDate,
} from "../../utils/dateUtils.js";
import {
  buildFinanceStats,
  isCancelledVisit,
} from "../../utils/finance.js";
import {getTodayInput} from "../../utils/dateHelpers.js";
import PageHeader from "../PageHeader.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import {
  createPaymentRingGradient,
} from "../../utils/payments.js";
import {exportRowsToExcel} from "../../utils/exportExcel.js";
import AppIcon from "../ui/AppIcon.jsx";
import {Button, Input, Select} from "../ui/index.js";

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

const statisticsChartTokens = {
  cursor: "rgba(56, 189, 248, 0.08)",
  dot: "#ffffff",
  grid: "rgba(255, 255, 255, 0.08)",
  revenue: "#38bdf8",
  tick: "#a3a6b3",
};
const paymentDisplay = [
  {color: "var(--color-chart-cash)", key: "cash", label: "Наличные"},
  {color: "var(--color-chart-card)", key: "card", label: "Карта"},
  {color: "var(--color-chart-ukrainian-card)", key: "ukrainianCard", label: "Укр. карта"},
  {color: "var(--color-chart-package)", key: "package", label: "Пакеты"},
  {color: "var(--color-chart-certificate)", key: "certificate", label: "Сертификаты"},
  {color: "var(--color-chart-blik)", key: "blik", label: "BLIK"},
  {color: "var(--color-chart-crypto)", key: "crypto", label: "Crypto"},
  {color: "var(--color-chart-barter)", key: "barter", label: "Бартер"},
  {color: "var(--color-chart-unspecified)", key: "unspecified", label: "Не указано"},
];

const getAttentionIconClass = (tone) =>
  `statistics-attention-icon is-${tone === "good" ? "good" : tone === "danger" ? "danger" : "warning"}`;

const getTrendClass = (value) =>
  value === null ? "statistics-trend is-muted" : value >= 0 ? "statistics-trend is-positive" : "statistics-trend is-negative";

const getMonthStart = () => {
  return formatAppDate(getStartOfMonth(new Date()), "yyyy-MM-dd");
};

const getPreviousMonthRange = () => {
  const monthStart = getMonthStart();
  const previousEnd = shiftAppDate(monthStart, -1);
  const previousStart = formatAppDate(getStartOfMonth(previousEnd), "yyyy-MM-dd");

  return {end: previousEnd, start: previousStart};
};

const formatChartDate = (date) => formatAppDate(date, "dd MMM");

const toSafeFinanceNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getVisitClientName = (visit) =>
  String(visit?.client ?? visit?.clientName ?? visit?.name ?? "").trim();

const getClientActivity = (appointments = []) => {
  const counts = appointments.reduce((items, visit) => {
    const name = getVisitClientName(visit);
    if (!name) return items;
    items.set(name, (items.get(name) ?? 0) + 1);
    return items;
  }, new Map());

  return {
    clientsCount: counts.size,
    repeatClients: [...counts.values()].filter((count) => count > 1).length,
  };
};

const buildPaymentsView = (stats) =>
  paymentDisplay.map((item) => ({
    ...item,
    recordsCount: toSafeFinanceNumber(stats.paymentRecordsByMethod?.[item.key]),
    value: toSafeFinanceNumber(stats.paymentsByMethod?.[item.key]),
  }));

const buildStatisticsAnalytics = (stats, clients = []) => {
  const filteredAppointments = stats.completedAppointments ?? [];
  const clientActivity = getClientActivity(filteredAppointments);
  const payments = buildPaymentsView(stats);
  const paymentTotal = payments.reduce((sum, item) => sum + item.value, 0);
  const serviceRevenue = toSafeFinanceNumber(stats.serviceReceived);
  const totalReceived = toSafeFinanceNumber(stats.receivedRevenue);
  const totalIncome = toSafeFinanceNumber(stats.netProfit);

  return {
    ...stats,
    averageCheck: toSafeFinanceNumber(stats.averageReceivedCheck),
    certificatesCount: stats.filteredCertificates?.length ?? 0,
    clientsCount: clientActivity.clientsCount || clients.length,
    debts: toSafeFinanceNumber(stats.debtAmount),
    filteredAppointments,
    financialOperationsIncome: toSafeFinanceNumber(stats.operationsIncome),
    forecastIncome: toSafeFinanceNumber(stats.forecastRevenue),
    paymentTotal,
    payments,
    platformCommissions: toSafeFinanceNumber(stats.platformCommission),
    repeatClients: clientActivity.repeatClients,
    serviceRevenue,
    totalIncome,
    totalReceived,
  };
};

function StatisticsFilters({
  currency,
  employees,
  endDate,
  master,
  mobile = false,
  onCurrencyChange,
  onEndDateChange,
  onMasterChange,
  onStartDateChange,
  startDate,
  onApplyCurrentMonthRange,
  onApplyPreviousMonthRange,
}) {
  if (mobile) {
    return (
      <div className="flex flex-col gap-3 w-full p-3 rounded-xl border border-border/60 bg-card/30">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="min-h-[38px]"
            size="sm"
            variant="secondary"
            onClick={onApplyCurrentMonthRange}>
            Этот месяц
          </Button>
          <Button
            className="min-h-[38px]"
            size="sm"
            variant="secondary"
            onClick={onApplyPreviousMonthRange}>
            Прошлый месяц
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Дата начала"
            className="h-10 min-h-10 text-xs cursor-pointer"
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
          <Input
            aria-label="Дата окончания"
            className="h-10 min-h-10 text-xs cursor-pointer"
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            className="h-10 min-h-10 text-xs cursor-pointer"
            value={master}
            onChange={(event) => onMasterChange(event.target.value)}>
            <option value="">Все сотрудники</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.name}>{employee.name}</option>
            ))}
          </Select>
          <Select
            aria-label="Валюта отчёта"
            className="h-10 min-h-10 text-xs cursor-pointer"
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}>
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} ({item.label})
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div
      className="statistics-filters flex flex-col flex-wrap lg:flex-row lg:items-center justify-between gap-4 w-full p-2 bg-transparent">
      {/* Left side: Range presets and date fields */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Presets */}
        <div className="flex items-center gap-2">
          <Button
            className="h-[34px] min-h-[34px] whitespace-nowrap"
            size="sm"
            variant="secondary"
            onClick={onApplyCurrentMonthRange}>
            Этот месяц
          </Button>
          <Button
            className="h-[34px] min-h-[34px] whitespace-nowrap"
            size="sm"
            variant="secondary"
            onClick={onApplyPreviousMonthRange}>
            Прошлый месяц
          </Button>
        </div>

        <div className="h-6 w-px bg-border/40 hidden sm:block" />

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <Input
            aria-label="Дата начала"
            className="statistics-filter-field h-[38px] min-h-[38px] w-[178px] min-w-[178px] text-xs cursor-pointer"
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
          <span className="text-muted-foreground font-semibold text-xs">—</span>
          <Input
            aria-label="Дата окончания"
            className="statistics-filter-field h-[38px] min-h-[38px] w-[178px] min-w-[178px] text-xs cursor-pointer"
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </div>
      </div>

      {/* Right side: Dropdown Selects */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="statistics-filter-select h-[38px] min-h-[38px] w-[190px] min-w-[190px] text-xs cursor-pointer"
          value={master}
          onChange={(event) => onMasterChange(event.target.value)}>
          <option value="">Все сотрудники</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.name}>{employee.name}</option>
          ))}
        </Select>
        <Select
          aria-label="Валюта отчёта"
          className="statistics-filter-select h-[38px] min-h-[38px] w-[150px] min-w-[150px] text-xs cursor-pointer"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}>
          {currencies.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {item.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function RevenueChart({chartData, formatIncome}) {
  const {isMobile} = useBreakpoint();
  const hasVisibleData = chartData.some(
    (item) => toSafeFinanceNumber(item.income) > 0 || toSafeFinanceNumber(item.visitsCount) > 0,
  );

  if (chartData.length < 2 || !hasVisibleData) {
    return (
      <div className="statistics-chart-empty flex items-center justify-center min-h-[190px] border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
        Недостаточно данных для построения динамики дохода
      </div>
    );
  }

  if (isMobile) {
    const width = 320;
    const height = 190;
    const padding = {top: 14, right: 10, bottom: 28, left: 44};
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const values = chartData.map((item) => toSafeFinanceNumber(item.income));
    const maxValue = Math.max(...values, 1);
    const yMax = maxValue * 1.12;
    const getX = (index) =>
      padding.left + (chartData.length === 1 ? plotWidth / 2 : (index / (chartData.length - 1)) * plotWidth);
    const getY = (value) => padding.top + plotHeight - (value / yMax) * plotHeight;
    const points = chartData.map((item, index) => `${getX(index)},${getY(toSafeFinanceNumber(item.income))}`);
    const linePath = `M ${points.join(" L ")}`;
    const areaPath = `${linePath} L ${padding.left + plotWidth},${padding.top + plotHeight} L ${padding.left},${padding.top + plotHeight} Z`;
    const ticks = [0, yMax / 2, yMax];
    const firstLabel = chartData[0]?.label ?? "";
    const lastLabel = chartData[chartData.length - 1]?.label ?? "";

    return (
      <div className="statistics-revenue-chart statistics-revenue-chart-mobile w-full select-none mt-2">
        <svg aria-label="График дохода" role="img" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="statisticsRevenueMobileGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={statisticsChartTokens.revenue} stopOpacity="0.24" />
              <stop offset="100%" stopColor={statisticsChartTokens.revenue} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  stroke={statisticsChartTokens.grid}
                  strokeDasharray="4 6"
                  x1={padding.left}
                  x2={padding.left + plotWidth}
                  y1={y}
                  y2={y}
                />
                <text
                  fill={statisticsChartTokens.tick}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="end"
                  x={padding.left - 8}
                  y={y + 3}>
                  {formatCompactMoney(tick).replace(" zł", "")}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill="url(#statisticsRevenueMobileGradient)" />
          <path d={linePath} fill="none" stroke={statisticsChartTokens.revenue} strokeLinecap="round" strokeWidth="2.5" />
          {chartData.map((item, index) => (
            <circle
              cx={getX(index)}
              cy={getY(toSafeFinanceNumber(item.income))}
              fill={statisticsChartTokens.dot}
              key={`${item.label}-${index}`}
              r="3"
              stroke={statisticsChartTokens.revenue}
              strokeWidth="2"
            />
          ))}
          <text fill={statisticsChartTokens.tick} fontSize="9" fontWeight="600" textAnchor="start" x={padding.left} y={height - 7}>
            {firstLabel}
          </text>
          <text fill={statisticsChartTokens.tick} fontSize="9" fontWeight="600" textAnchor="end" x={width - padding.right} y={height - 7}>
            {lastLabel}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="statistics-revenue-chart w-full h-[190px] select-none mt-2">
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={chartData} margin={{top: 10, right: 8, left: -22, bottom: 0}}>
          <defs>
            <linearGradient id="statisticsRevenueGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={statisticsChartTokens.revenue} stopOpacity={0.2} />
              <stop offset="95%" stopColor={statisticsChartTokens.revenue} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke={statisticsChartTokens.grid}
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={15}
            tick={{fill: statisticsChartTokens.tick, fontSize: 10, fontWeight: 500}}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{fill: statisticsChartTokens.tick, fontSize: 9, fontWeight: 500}}
            tickFormatter={(value) => formatCompactMoney(value).replace(" zł", "")}
            tickLine={false}
            width={45}
          />
          <Tooltip
            content={<RevenueTooltip formatIncome={formatIncome} />}
            cursor={{fill: statisticsChartTokens.cursor}}
          />
          <Area
            dataKey="income"
            dot={{fill: statisticsChartTokens.dot, r: 3.5, stroke: statisticsChartTokens.revenue, strokeWidth: 2}}
            fill="url(#statisticsRevenueGradient)"
            isAnimationActive={false}
            stroke={statisticsChartTokens.revenue}
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatisticsPage({
  calendarEntries,
  clientPackages,
  certificates = [],
  clients,
  employees,
  visits,
}) {
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getTodayInput);
  const [master, setMaster] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [rates, setRates] = useState(() => {
    const cached = localStorage.getItem(CURRENCY_CACHE_KEY);
    return cached ? JSON.parse(cached) : defaultRates;
  });
  const {isMobile} = useBreakpoint();

  useEffect(() => {
    const cachedRates = localStorage.getItem(CURRENCY_CACHE_KEY);
    if (cachedRates) {
      // rates already initialized from cache in state initializer; no need to set state here
      return;
    }

    fetch("https://api.nbp.pl/api/exchangerates/tables/A/?format=json")
      .then((res) => res.json())
      .then((data) => {
        const tableRates = data?.[0]?.rates || [];
        const nextRates = {PLN: 1};

        tableRates.forEach((rate) => {
          if (["USD", "EUR", "UAH"].includes(rate.code)) {
            nextRates[rate.code] = rate.mid;
          }
        });

        setRates(nextRates);
        localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(nextRates));
      })
      .catch((error) => console.error("Failed to fetch currency rates", error));
  }, []);

  const formatIncome = (value) => {
    const plnRate = rates[currency] || 1;
    const converted = value / plnRate;

    if (currency === "PLN") {
      return formatCompactMoney(converted);
    }

    return `${formatCompactMoney(converted).replace(" zł", "")} ${currencyIcons[currency] || currency}`;
  };

  const analytics = useMemo(() => {
    const periodDays = getPeriodDays(startDate, endDate);
    const daysCount = periodDays.length;
    const previousStart = shiftAppDate(startDate, -daysCount);
    const previousEnd = shiftAppDate(startDate, -1);
    const now = new Date();

    const currentStats = buildStatisticsAnalytics(buildFinanceStats({
      calendarEntries,
      certificates,
      clientPackages,
      employees,
      endDate,
      master,
      now,
      startDate,
      visits,
    }), clients);
    const previousStats = buildStatisticsAnalytics(buildFinanceStats({
      calendarEntries,
      certificates,
      clientPackages,
      employees,
      endDate: previousEnd,
      master,
      now,
      startDate: previousStart,
      visits,
    }), clients);
    const dates = periodDays.map((date) => {
      const dailyStats = buildStatisticsAnalytics(buildFinanceStats({
        calendarEntries,
        certificates,
        clientPackages,
        employees,
        endDate: date,
        master,
        now,
        startDate: date,
        visits,
      }), clients);

      return {
        date,
        income: dailyStats.totalIncome,
        visitsCount: dailyStats.filteredAppointments.length,
      };
    });

    return {
      ...currentStats,
      dates,
      previousPeriodIncome: previousStats.totalIncome,
    };
  }, [
    calendarEntries,
    clientPackages,
    certificates,
    clients,
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
      certificates,
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
      todayVisits: upcomingVisits,
      upcomingVisits,
    };
  }, [calendarEntries, certificates, clientPackages, employees, master, visits]);

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
      icon: "users",
      color: "var(--color-kpi-clients)",
    },
    {
      label: "Визиты",
      value: analytics.filteredAppointments.length,
      helper: "завершено",
      icon: "calendarRange",
      color: "var(--color-kpi-visits)",
    },
    {
      label: "Средний чек",
      value: formatIncome(analytics.averageCheck),
      icon: "banknote",
      color: "var(--color-kpi-average-check)",
    },
    {
      label: "Долги",
      value: formatIncome(analytics.outstandingDebts),
      helper:
        analytics.debts > 0
          ? `${analytics.debtVisits.length} в периоде`
          : `${analytics.allDebtVisits.length} всего`,
      icon: "walletCards",
      color: "var(--color-kpi-debts)",
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

  const applyCurrentMonthRange = () => {
    setStartDate(getMonthStart());
    setEndDate(getTodayInput());
  };

  const applyPreviousMonthRange = () => {
    const range = getPreviousMonthRange();
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const exportStatistics = async () => {
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

    await exportRowsToExcel({
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

  const exportButton = (
    <Button
      aria-label="Экспорт Excel"
      className="h-[34px] min-h-[34px] whitespace-nowrap"
      leftIcon="download"
      size="sm"
      variant="secondary"
      onClick={exportStatistics}>
      {isMobile ? "Экспорт" : "Экспорт Excel"}
    </Button>
  );

  const filtersPanel = (
    <StatisticsFilters
      currency={currency}
      employees={employees}
      endDate={endDate}
      master={master}
      mobile={isMobile}
      startDate={startDate}
      onCurrencyChange={setCurrency}
      onEndDateChange={setEndDate}
      onMasterChange={setMaster}
      onStartDateChange={setStartDate}
      onApplyCurrentMonthRange={applyCurrentMonthRange}
      onApplyPreviousMonthRange={applyPreviousMonthRange}
    />
  );

  const attentionPanel = (
    <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3">
        {attentionItems.map((item) => (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" key={item.title}>
            {item.tone === "good" ? (
              <AppIcon name="checkCircle" size="sm" className={getAttentionIconClass(item.tone)} />
            ) : item.tone === "danger" ? (
              <AppIcon name="alert" size="sm" className={getAttentionIconClass(item.tone)} />
            ) : (
              <AppIcon name="alert" size="sm" className={getAttentionIconClass(item.tone)} />
            )}
            <span className="flex flex-col gap-0.5">
              <strong className="text-foreground text-xs font-bold">{item.title}</strong>
              <small className="text-[10px] text-muted-foreground">{item.text}</small>
            </span>
          </div>
        ))}
      </div>
    </article>
  );

  const paymentsPanel = (
    <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3.5">
        {paymentRows.length > 0 ? (
          paymentRows.map((item) => (
            <PaymentRow
              item={item}
              key={item.label}
              total={analytics.paymentTotal}
              value={formatIncome(item.value)}
            />
          ))
        ) : (
          <p className="statistics-empty-note m-0 text-xs text-muted-foreground">
            Оплат за выбранный период нет.
          </p>
        )}
      </div>
    </article>
  );

  const financialDetailsGrid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex justify-between items-center gap-4">
          <div className="flex flex-col">
            <h3 className="text-foreground text-sm font-bold">Финансовая разбивка</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Из чего складывается чистый доход</p>
          </div>
          <div
            className="percent-ring dynamic-payment-ring flex flex-col justify-center items-center w-16 h-16 rounded-full text-center"
            style={{
              "--payment-ring-gradient": createPaymentRingGradient(activePayments),
            }}>
            <strong className="text-foreground text-xs font-extrabold leading-none">
              {formatCompactMoney(analytics.totalIncome / (rates[currency] || 1))}
            </strong>
            <span className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">{currency}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
          {earnings.map(([label, value]) => (
            <span key={label} className="flex justify-between items-center text-xs text-foreground">
              {label}
              <strong className={`font-bold ${value < 0 ? "statistics-value is-negative" : "text-foreground"}`}>
                {formatIncome(value)}
              </strong>
            </span>
          ))}
        </div>
      </article>

      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex flex-col">
          <h3 className="text-foreground text-sm font-bold">Активность</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Клиенты, пакеты и сертификаты</p>
        </div>
        <div className="flex flex-col gap-3.5 border-t border-border/40 pt-3 flex-1 justify-center">
          {activityStats.map(([label, value]) => (
            <span key={label} className="flex justify-between items-center text-xs text-foreground">
              {label}
              <strong className="font-extrabold">{value}</strong>
            </span>
          ))}
        </div>
      </article>
    </div>
  );

  const detailsPanel = (
    <details className="w-full border border-border rounded-xl bg-card overflow-hidden group select-none transition-all">
      <summary className="statistics-details-summary flex items-center justify-between p-4 cursor-pointer font-semibold text-xs text-foreground focus:outline-none">
        <span>
          <strong className="inline-flex items-center gap-1.5 font-bold text-xs">
            Подробная финансовая аналитика
            <HintIcon>
              Разбивка дохода, пакеты, сертификаты и возвратность
            </HintIcon>
          </strong>
        </span>
      </summary>
      <div className="p-4 border-t border-border bg-muted/40">
        {financialDetailsGrid}
      </div>
    </details>
  );

  const chartChangeLabel =
    periodChangePercent === null
      ? null
      : `${Math.abs(Math.round(periodChangePercent))}% к прошлому периоду`;
  const chartChangeIcon =
    periodChangePercent === null ? null : periodChangePercent >= 0 ? "arrowUp" : "arrowDown";

  const incomeCard = (
    <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card shadow-lg">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{incomeScopeLabel}</span>
          <strong className="text-foreground text-3xl md:text-5xl font-extrabold leading-none mt-1">{formatIncome(analytics.totalIncome)}</strong>
          <p className="text-xs text-muted-foreground mt-1.5">
            Поступления {formatIncome(analytics.totalReceived)} ·{" "}
            {toDisplayDate(startDate)} — {toDisplayDate(endDate)}
          </p>
          {!isMobile ? (
            <small className="text-[10px] text-muted-foreground mt-2 max-w-lg">
              {master
                ? "Показаны визиты выбранного мастера и проданные им пакеты. Операции без мастера остаются только в общем доходе бизнеса."
                : businessExtraIncome > 0
                  ? `Включает доп. доход бизнеса: ${formatIncome(
                      businessExtraIncome,
                    )} · пакеты, сертификаты и операции.`
                  : "Считаются завершённые визиты и финансовые операции за период."}
            </small>
          ) : null}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10 text-accent font-extrabold text-lg select-none">
          <span>{currencyIcons[currency] || currency}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-border/40 text-xs">
        <span className="flex flex-col gap-0.5 text-muted-foreground">
          Прогноз <b className="text-foreground font-bold text-sm mt-0.5">{formatIncome(analytics.forecastIncome)}</b>
        </span>
        <span className="flex flex-col gap-0.5 text-muted-foreground">
          Завершено <b className="text-foreground font-bold text-sm mt-0.5">{analytics.filteredAppointments.length}</b>
        </span>
        <span className="flex flex-col gap-0.5 text-muted-foreground">
          Средний чек <b className="text-foreground font-bold text-sm mt-0.5">{formatIncome(analytics.averageCheck)}</b>
        </span>
      </div>
      {!isMobile ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Динамика дохода</span>
            <strong className={`font-bold ${getTrendClass(periodChangePercent)}`}>
              {periodChangePercent === null
                ? "Нет прошлого периода"
                : (
                  <span className="inline-flex items-center gap-1">
                    <AppIcon name={chartChangeIcon} size="xs" />
                    {chartChangeLabel}
                  </span>
                )}
            </strong>
          </div>
          <RevenueChart chartData={chartData} formatIncome={formatIncome} />
        </div>
      ) : null}
    </article>
  );

  if (isMobile) {
    return (
      <section className="statistics-page statistics-page-mobile flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground">
        <header className="statistics-mobile-header">
          <h1>Статистика</h1>
          <div className="statistics-mobile-header-actions">
            {exportButton}
            <PageNotificationsSlot />
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-4 select-none pr-1 scrollbar-thin">
          <div className="flex flex-col gap-1 pb-3 border-b border-border/40 mt-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              {master ? `Доход мастера ${master}` : "Общий доход бизнеса"}
            </span>
            <strong className="text-foreground text-3xl font-extrabold leading-none mt-1">
              {formatIncome(analytics.totalIncome)}
            </strong>
            <p className="text-xs text-muted-foreground mt-1.5">
              Период: {toDisplayDate(startDate)} — {toDisplayDate(endDate)}
            </p>
          </div>

          <StatisticsFilters
            currency={currency}
            employees={employees}
            endDate={endDate}
            master={master}
            mobile={true}
            startDate={startDate}
            onCurrencyChange={setCurrency}
            onEndDateChange={setEndDate}
            onMasterChange={setMaster}
            onStartDateChange={setStartDate}
            onApplyCurrentMonthRange={applyCurrentMonthRange}
            onApplyPreviousMonthRange={applyPreviousMonthRange}
          />

          <div className="grid grid-cols-2 gap-2 mt-1">
            {kpiStats.map((item) => (
              <article className="flex flex-col p-3 rounded-xl border border-border bg-card shadow-sm" key={item.label}>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</span>
                <strong className="text-foreground text-base font-bold mt-1">{item.value}</strong>
                {item.helper && <small className="text-[9px] text-muted-foreground mt-0.5 truncate">{item.helper}</small>}
              </article>
            ))}
          </div>

          {incomeCard}

          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-semibold text-muted-foreground">График дохода</h3>
              {chartChangeLabel ? (
                <span className={`font-semibold ${getTrendClass(periodChangePercent)}`}>
                  {chartChangeLabel}
                </span>
              ) : null}
            </div>
            <RevenueChart chartData={chartData} formatIncome={formatIncome} />
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-semibold text-muted-foreground">Требует внимания</h3>
              <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full bg-muted text-[10px] font-bold text-foreground">{attentionItems.length}</span>
            </div>
            {attentionPanel}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-semibold text-muted-foreground">Оплаты</h3>
              <span className="font-semibold text-foreground">
                {formatIncome(analytics.paymentTotal)}
              </span>
            </div>
            {paymentsPanel}
          </section>

          <section className="flex flex-col gap-2 pb-6">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                Подробная аналитика
                <HintIcon>
                  Разбивка дохода, пакеты, сертификаты и возвратность
                </HintIcon>
              </h3>
            </div>
            {financialDetailsGrid}
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col h-full w-full min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 select-none scrollbar-thin scrollbar-thumb-accent scrollbar-track-transparent">
      <PageHeader
        className="statistics-hero-header w-full"
        description="Финансы, визиты и сигналы по клиентам"
        headerActions={exportButton}
        title="Статистика"
      />

      <div className="statistics-filters-card p-2 border border-border rounded-xl bg-card">{filtersPanel}</div>

      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex flex-col">
          <h3 className="text-foreground text-sm font-bold">Сегодня</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{toDisplayDate(getTodayInput())}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatisticsCard
            item={{
              color: "var(--color-kpi-visits)",
              helper: `${todaySnapshot.completedVisits} завершено`,
              icon: "calendarRange",
              label: "Визиты",
              value: todaySnapshot.scheduledVisits,
            }}
          />
          <StatisticsCard
            item={{
              color: "var(--color-kpi-average-check)",
              icon: "banknote",
              label: "Поступления",
              value: formatIncome(todaySnapshot.received),
            }}
          />
          <StatisticsCard
            item={{
              color: "var(--color-kpi-debts)",
              helper:
                todaySnapshot.debtVisits > 0
                  ? `${todaySnapshot.debtVisits} записей`
                  : "нет долгов",
              icon: "walletCards",
              label: "Долги",
              value: formatIncome(todaySnapshot.debtAmount),
            }}
          />
          <StatisticsCard
            item={{
              color: "var(--color-kpi-clients)",
              helper: "следующие 3 часа",
              icon: "clock",
              label: "Ближайшие",
              value: todaySnapshot.upcomingVisits.length,
            }}
          />
        </div>
        {todaySnapshot.upcomingVisits.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-border/40 pt-3 mt-1 list-none">
            {todaySnapshot.todayVisits.map((entry) => (
              <li key={entry.id ?? `${entry.time}-${entry.client}`} className="flex items-center gap-3 text-xs">
                <strong className="text-foreground font-bold min-w-10">{entry.time}</strong>
                <span className="text-foreground truncate max-w-xs">{entry.client || "Без клиента"}</span>
                <small className="text-muted-foreground truncate">{entry.service || "Визит"}</small>
              </li>
            ))}
          </ul>
        )}
      </article>

      {incomeCard}

      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex flex-col">
          <h3 className="text-foreground text-sm font-bold">Требует внимания</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Самые важные сигналы по деньгам</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {attentionItems.map((item) => (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" key={item.title}>
              {item.tone === "good" ? (
                <AppIcon name="checkCircle" size="sm" className={getAttentionIconClass(item.tone)} />
              ) : item.tone === "danger" ? (
                <AppIcon name="alert" size="sm" className={getAttentionIconClass(item.tone)} />
              ) : (
                <AppIcon name="alert" size="sm" className={getAttentionIconClass(item.tone)} />
              )}
              <span className="flex flex-col gap-0.5">
                <strong className="text-foreground text-xs font-bold">{item.title}</strong>
                <small className="text-[10px] text-muted-foreground">{item.text}</small>
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiStats.map((item) => (
          <StatisticsCard item={item} key={item.label} />
        ))}
      </div>

      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-foreground text-sm font-bold">Оплаты</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Наличные, карта, укр. карта, пакеты и неразобранные оплаты</p>
          </div>
          <strong className="text-foreground text-lg font-bold">{formatIncome(analytics.paymentTotal)}</strong>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
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

      {detailsPanel}
    </section>
  );
}

function StatisticsCard({item}) {
  return (
    <article className="flex gap-3.5 p-4 rounded-xl border border-border bg-card select-none">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg"
        style={{
          backgroundColor: `color-mix(in srgb, ${item.color} 15%, transparent)`,
          color: item.color,
        }}>
        <AppIcon name={item.icon} size="sm" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{item.label}</span>
        <strong className="text-foreground text-base font-bold truncate mt-0.5">{item.value}</strong>
        {item.helper && <small className="text-[10px] text-muted-foreground truncate">{item.helper}</small>}
      </div>
    </article>
  );
}

function PaymentRow({item, total, value}) {
  const percent = Math.round((item.value / Math.max(total, 1)) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}} />
          <span className="text-foreground font-semibold">{item.label}</span>
        </div>
        <strong className="text-foreground font-bold">{value}</strong>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <b className="block h-full rounded-full transition-all" style={{backgroundColor: item.color, width: `${Math.min(percent, 100)}%`}} />
      </div>
      <small className="text-[10px] text-muted-foreground">
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
    <div className="p-3 border border-border rounded-lg bg-card shadow-lg flex flex-col gap-1 text-xs">
      <strong className="text-foreground font-bold">{item.tooltipDate}</strong>
      <span className="text-accent font-extrabold text-sm">{formatIncome(item.income)}</span>
      <small className="text-muted-foreground">{item.visitsCount} визитов</small>
    </div>
  );
}

const groupChartDates = (dates) => {
  const validDates = (Array.isArray(dates) ? dates : [])
    .map((item) => ({
      ...item,
      dateLabel: formatChartDate(item?.date),
    }))
    .filter((item) => item.date && item.dateLabel);

  if (validDates.length <= 31) {
    return validDates.map((item) => ({
      key: item.date,
      label: item.dateLabel,
      tooltipDate: item.dateLabel,
      income: toSafeFinanceNumber(item.income),
      visitsCount: toSafeFinanceNumber(item.visitsCount),
    }));
  }

  const groups = [];

  for (let index = 0; index < validDates.length; index += 7) {
    const chunk = validDates.slice(index, index + 7);
    const firstDate = chunk[0];
    const lastDate = chunk.at(-1);

    groups.push({
      key: `${firstDate.date}-${lastDate.date}`,
      label: `${firstDate.dateLabel}–${lastDate.dateLabel}`,
      tooltipDate: `${firstDate.dateLabel} — ${lastDate.dateLabel}`,
      income: chunk.reduce((sum, item) => sum + toSafeFinanceNumber(item.income), 0),
      visitsCount: chunk.reduce(
        (sum, item) => sum + toSafeFinanceNumber(item.visitsCount),
        0,
      ),
    });
  }

  return groups;
};

export default StatisticsPage;
