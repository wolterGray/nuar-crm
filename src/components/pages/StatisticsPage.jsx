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
import {
  createPaymentRingGradient,
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

const revenueChartColor = "#8f7cff";

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
}) {
  const [openMobileFilter, setOpenMobileFilter] = useState(null);
  const selectedCurrency = currencies.find((item) => item.code === currency) || currencies[0];

  const renderMobileFilter = ({label, options, value, onChange, type}) => {
    const selectedOption =
      options.find((option) => option.value === value) || options[0];

    return (
      <div className="relative flex-1 min-w-0">
        <button
          aria-expanded={openMobileFilter === type}
          className="flex justify-between items-center w-full min-h-10 px-3 border border-border rounded-lg bg-card text-foreground hover:bg-accent/5 transition-all text-xs"
          type="button"
          onClick={() =>
            setOpenMobileFilter((current) => (current === type ? null : type))
          }>
          <span className="text-muted-foreground">{label}</span>
          <strong className="font-bold">{selectedOption.label}</strong>
        </button>
        {openMobileFilter === type ? (
          <div className="absolute left-0 right-0 top-11 z-20 flex flex-col gap-1 p-1 rounded-lg border border-border bg-card shadow-lg">
            {options.map((option) => (
              <button
                className={`w-full px-3 py-2 rounded-md text-left text-xs transition-colors hover:bg-accent/10 ${
                  option.value === value ? "bg-accent/10 font-bold text-accent" : "text-foreground"
                }`}
                key={option.value || "all"}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpenMobileFilter(null);
                }}>
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full p-2`}>
      <label className="flex items-center gap-2 min-h-10 px-3 border border-border rounded-lg bg-card text-muted-foreground text-xs flex-1 min-w-0">
        <CalendarRange size={14} className="text-muted-foreground" />
        <input
          className="bg-transparent border-0 text-foreground w-full focus:outline-none"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </label>
      {!mobile ? <span className="text-muted-foreground font-semibold">—</span> : null}
      <label className="flex items-center gap-2 min-h-10 px-3 border border-border rounded-lg bg-card text-muted-foreground text-xs flex-1 min-w-0">
        <CalendarRange size={14} className="text-muted-foreground" />
        <input
          className="bg-transparent border-0 text-foreground w-full focus:outline-none"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </label>
      {mobile ? (
        <div className="flex gap-2 w-full mt-1">
          {renderMobileFilter({
            label: "Сотрудник",
            onChange: onMasterChange,
            options: [
              {label: "Все", value: ""},
              ...employees.map((employee) => ({
                label: employee.name,
                value: employee.name,
              })),
            ],
            type: "master",
            value: master,
          })}
          {renderMobileFilter({
            label: "Валюта",
            onChange: onCurrencyChange,
            options: currencies.map((item) => ({
              label: `${item.code}`,
              value: item.code,
            })),
            type: "currency",
            value: selectedCurrency.code,
          })}
        </div>
      ) : (
        <>
          <select
            className="min-h-10 min-w-[160px] px-3 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:border-accent text-xs cursor-pointer"
            value={master}
            onChange={(event) => onMasterChange(event.target.value)}>
            <option value="">Все сотрудники</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.name}>{employee.name}</option>
            ))}
          </select>
          <select
            aria-label="Валюта отчёта"
            className="min-h-10 min-w-[140px] px-3 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:border-accent text-xs cursor-pointer"
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}>
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function RevenueChart({chartData, formatIncome}) {
  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center min-h-[190px] border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
        Недостаточно данных для построения динамики дохода
      </div>
    );
  }

  return (
    <div className="w-full h-[190px] select-none mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{top: 10, right: 8, left: -22, bottom: 0}}>
          <defs>
            <linearGradient id="statisticsRevenueGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={revenueChartColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={revenueChartColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(126, 137, 151, 0.12)"
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={15}
            tick={{fill: "#8a8f98", fontSize: 10, fontWeight: 500}}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{fill: "#8a8f98", fontSize: 9, fontWeight: 500}}
            tickFormatter={(value) => formatCompactMoney(value).replace(" zł", "")}
            tickLine={false}
            width={45}
          />
          <Tooltip
            content={<RevenueTooltip formatIncome={formatIncome} />}
            cursor={{fill: "rgba(143, 124, 255, 0.05)"}}
          />
          <Area
            dataKey="income"
            dot={{fill: "#fff", r: 3.5, stroke: revenueChartColor, strokeWidth: 2}}
            fill="url(#statisticsRevenueGradient)"
            isAnimationActive={false}
            stroke={revenueChartColor}
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
    const daysCount = getPeriodDays(startDate, endDate);
    const previousStart = shiftAppDate(startDate, -daysCount);
    const previousEnd = shiftAppDate(startDate, -1);
    const now = new Date();

    const currentStats = buildFinanceStats({
      calendarEntries,
      certificates,
      clientPackages,
      employees,
      endDate,
      master,
      now,
      startDate,
      visits,
    });
    const previousStats = buildFinanceStats({
      calendarEntries,
      certificates,
      clientPackages,
      employees,
      endDate: previousEnd,
      master,
      now,
      startDate: previousStart,
      visits,
    });

    return {
      ...currentStats,
      previousPeriodIncome: previousStats.totalIncome,
    };
  }, [
    calendarEntries,
    clientPackages,
    certificates,
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

  const applyCurrentMonthRange = () => {
    setStartDate(getMonthStart());
    setEndDate(getTodayInput());
  };

  const applyPreviousMonthRange = () => {
    const range = getPreviousMonthRange();
    setStartDate(range.start);
    setEndDate(range.end);
  };

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

  const exportButton = (
    <button
      aria-label="Экспорт Excel"
      className="inline-flex items-center justify-center gap-1.5 min-h-10 md:min-h-9 px-3 rounded-lg border border-border text-foreground hover:bg-accent/5 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap"
      type="button"
      onClick={exportStatistics}>
      <Download size={14} />
      <span>{isMobile ? "Экспорт" : "Экспорт Excel"}</span>
    </button>
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
    />
  );

  const attentionPanel = (
    <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3">
        {attentionItems.map((item) => (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" key={item.title}>
            {item.tone === "good" ? (
              <CheckCircle2 size={17} className="text-green-500 flex-shrink-0" />
            ) : item.tone === "danger" ? (
              <AlertTriangle size={17} className="text-red-500 flex-shrink-0" />
            ) : (
              <AlertTriangle size={17} className="text-amber-500 flex-shrink-0" />
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
              <strong className={`font-bold ${value < 0 ? "text-red-500" : "text-foreground"}`}>
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
      <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/5 font-semibold text-xs text-foreground focus:outline-none">
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
      : `${periodChangePercent >= 0 ? "↑" : "↓"} ${Math.abs(
          Math.round(periodChangePercent),
        )}% к прошлому периоду`;

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
            <strong
              className={`font-bold ${
                periodChangePercent === null
                  ? "text-muted-foreground"
                  : periodChangePercent >= 0
                    ? "text-green-500"
                    : "text-red-500"
              }`}>
              {periodChangePercent === null
                ? "Нет прошлого периода"
                : `${periodChangePercent >= 0 ? "↑" : "↓"} ${Math.abs(
                    Math.round(periodChangePercent),
                  )}% к прошлому периоду`}
            </strong>
          </div>
          <RevenueChart chartData={chartData} formatIncome={formatIncome} />
        </div>
      ) : null}
    </article>
  );

  if (isMobile) {
    return (
      <section className="flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground">
        <PageHeader
          collapsedMeta={`${toDisplayDate(startDate)} — ${toDisplayDate(endDate)}`}
          collapsible={false}
          actions={
            <div className="flex flex-col gap-2 w-full">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex items-center justify-center min-h-10 px-3 rounded-lg border border-border text-foreground hover:bg-accent/5 font-semibold text-xs transition-all"
                  type="button"
                  onClick={applyCurrentMonthRange}>
                  Этот месяц
                </button>
                <button
                  className="inline-flex items-center justify-center min-h-10 px-3 rounded-lg border border-border text-foreground hover:bg-accent/5 font-semibold text-xs transition-all"
                  type="button"
                  onClick={applyPreviousMonthRange}>
                  Прошлый месяц
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {kpiStats.map((item) => (
                  <article className="flex flex-col p-3 rounded-xl border border-border bg-card" key={item.label}>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</span>
                    <strong className="text-foreground text-base font-bold mt-1">{item.value}</strong>
                  </article>
                ))}
              </div>
              <div className="border-t border-border/40 pt-2 mt-1">{filtersPanel}</div>
            </div>
          }
          className="statistics-hero-header"
          description={`${formatIncome(analytics.totalIncome)} · ${toDisplayDate(startDate)} — ${toDisplayDate(endDate)}`}
          headerActions={exportButton}
          title="Статистика"
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-4 select-none pr-1 scrollbar-thin">
          {incomeCard}

          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-semibold text-muted-foreground">График дохода</h3>
              {chartChangeLabel ? (
                <span
                  className={`font-semibold ${
                    periodChangePercent >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
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
        className="statistics-hero-header"
        description="Финансы, визиты и сигналы по клиентам"
        headerActions={exportButton}
        title="Статистика"
      />

      <div className="p-2 border border-border rounded-xl bg-card">{filtersPanel}</div>

      <article className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex flex-col">
          <h3 className="text-foreground text-sm font-bold">Сегодня</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{toDisplayDate(getTodayInput())}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <CheckCircle2 size={17} className="text-green-500 flex-shrink-0" />
              ) : item.tone === "danger" ? (
                <AlertTriangle size={17} className="text-red-500 flex-shrink-0" />
              ) : (
                <AlertTriangle size={17} className="text-amber-500 flex-shrink-0" />
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
  const Icon = item.icon;

  return (
    <article className="flex gap-3.5 p-4 rounded-xl border border-border bg-card select-none">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{backgroundColor: `${item.color}15`, color: item.color}}>
        <Icon size={16} />
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
