import {
  Banknote,
  CalendarRange,
  CircleDollarSign,
  Package,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  formatCompactMoney,
  parseDisplayDate,
  toDisplayDate,
} from "../../utils/formatters.jsx";
import {
  getDiscountedServiceAmount,
  getEmployeePayout,
  getVisitCommission,
  getVisitDebt,
  getVisitTotal,
  getVisitTransactionTotal,
  isBarterPayment,
  isPackagePayment,
  toVisitNumber,
} from "../../utils/visits.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import {
  createPaymentRingGradient,
  getPaymentGroup,
  paymentGroups,
} from "../../utils/payments.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CURRENCY_CACHE_KEY = "nuar-crm-nbp-rates";
const defaultRates = {PLN: 1, USD: 3.72, EUR: 4.28, UAH: 0.087};
const currencies = [
  {code: "PLN", label: "zł"},
  {code: "USD", label: "$"},
  {code: "EUR", label: "€"},
  {code: "UAH", label: "₴"},
];

const toInputDate = (date) => {
  const parsedDate = parseDisplayDate(date);
  return parsedDate ? parsedDate.toISOString().slice(0, 10) : "";
};

const getTodayInput = () => new Date().toISOString().slice(0, 10);

const getMonthStart = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
};

const enumerateDates = (startDate, endDate) => {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const result = [];

  if (start > end) {
    return result;
  }

  for (
    let date = start;
    date <= end;
    date = new Date(date.getTime() + DAY_IN_MS)
  ) {
    result.push(date.toISOString().slice(0, 10));
  }

  return result;
};

const shortDate = (date) => {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
};

const isCompletedVisit = (visit) =>
  visit.recordType === "operation" ||
  (!visit.isPlanned &&
    !["scheduled", "confirmed", "cancelled", "no_show"].includes(visit.status));

const isForecastVisit = (visit) =>
  visit.kind === "visit" &&
  !["completed", "cancelled", "no_show"].includes(visit.status);

const isDebtEligibleVisit = (visit) =>
  visit.recordType !== "operation" &&
  !["cancelled", "no_show"].includes(visit.status) &&
  getVisitDebt(visit) > 0;

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
    const dateRange = enumerateDates(startDate, endDate);
    const filteredVisits = visits.filter((visit) => {
      const date = toInputDate(visit.date);
      return (
        isCompletedVisit(visit) &&
        date >= startDate &&
        date <= endDate &&
        (!master || visit.master === master)
      );
    });
    const filteredAppointments = filteredVisits.filter(
      (visit) => visit.recordType !== "operation",
    );
    const allDebtVisits = visits.filter(
      (visit) => isDebtEligibleVisit(visit) && (!master || visit.master === master),
    );
    const debtVisits = visits.filter((visit) => {
      const date = toInputDate(visit.date);
      return (
        isDebtEligibleVisit(visit) &&
        date >= startDate &&
        date <= endDate &&
        (!master || visit.master === master)
      );
    });
    const filteredPackages = master
      ? []
      : clientPackages.filter((item) => {
          const date = toInputDate(item.purchaseDate);
          return date >= startDate && date <= endDate;
        });
    const packageIncome = filteredPackages.reduce(
      (sum, item) => sum + toVisitNumber(item.price),
      0,
    );
    const forecastVisits = calendarEntries.filter((visit) => {
      const date = visit.date;
      return (
        isForecastVisit(visit) &&
        date >= startDate &&
        date <= endDate &&
        (!master || visit.master === master)
      );
    });
    const forecastIncome = forecastVisits.reduce(
      (sum, visit) => sum + getVisitTransactionTotal(visit),
      0,
    );
    const visitsIncome = filteredVisits.reduce(
      (sum, visit) => sum + getVisitTotal(visit, employees),
      0,
    );
    const visitsReceived = filteredVisits.reduce(
      (sum, visit) => sum + getVisitTransactionTotal(visit),
      0,
    );
    const financialOperations = filteredVisits.filter(
      (visit) => visit.recordType === "operation",
    );
    const financialOperationsIncome = financialOperations.reduce(
      (sum, visit) => sum + getVisitTotal(visit, employees),
      0,
    );
    const certificatesCount = financialOperations.filter(
      (visit) => visit.service === "Продажа сертификата",
    ).length;
    const serviceRevenue = filteredAppointments.reduce(
      (sum, visit) =>
        isPackagePayment(visit) || isBarterPayment(visit)
          ? sum
          : sum + getDiscountedServiceAmount(visit),
      0,
    );
    const tips = filteredAppointments.reduce(
      (sum, visit) => sum + toVisitNumber(visit.tip),
      0,
    );
    const extras = filteredAppointments.reduce(
      (sum, visit) => sum + toVisitNumber(visit.extra),
      0,
    );
    const debts = debtVisits.reduce(
      (sum, visit) => sum + getVisitDebt(visit),
      0,
    );
    const outstandingDebts = allDebtVisits.reduce(
      (sum, visit) => sum + getVisitDebt(visit),
      0,
    );
    const discounts = filteredAppointments.reduce(
      (sum, visit) =>
        sum +
        toVisitNumber(visit.amount) * (toVisitNumber(visit.discount) / 100),
      0,
    );
    const employeePayouts = filteredAppointments.reduce(
      (sum, visit) => sum + getEmployeePayout(visit, employees),
      0,
    );
    const platformCommissions = filteredAppointments.reduce(
      (sum, visit) => sum + getVisitCommission(visit),
      0,
    );
    const totalIncome = visitsIncome + packageIncome;
    const totalReceived = visitsReceived + packageIncome;
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
    const averageCheck = totalReceived / Math.max(incomeRecordsCount, 1);
    const dates = dateRange.map((date) => {
      const dailyVisits = filteredVisits.filter(
        (visit) => toInputDate(visit.date) === date,
      );
      const dailyPackages = filteredPackages.filter(
        (item) => toInputDate(item.purchaseDate) === date,
      );

      return {
        date,
        income:
          dailyVisits.reduce(
            (sum, visit) => sum + getVisitTotal(visit, employees),
            0,
          ) +
          dailyPackages.reduce(
            (sum, item) => sum + toVisitNumber(item.price),
            0,
          ),
      };
    });
    const payments = paymentGroups.map((group) => {
      const visitPayments = filteredVisits.filter(
        (visit) => getPaymentGroup(visit.payment) === group,
      );
      const packagePayments = filteredPackages.filter(
        (item) => getPaymentGroup(item.payment) === group,
      );

      return {
        ...group,
        value:
          visitPayments.reduce(
            (sum, visit) => sum + getVisitTransactionTotal(visit),
            0,
          ) +
          packagePayments.reduce(
            (sum, item) => sum + toVisitNumber(item.price),
            0,
          ),
        recordsCount: visitPayments.length + packagePayments.length,
      };
    });
    const paymentTotal = payments.reduce((sum, item) => sum + item.value, 0);

    return {
      averageCheck,
      clientsCount: clientNames.size,
      dates,
      discounts,
      debts,
      debtVisits,
      employeePayouts,
      extras,
      certificatesCount,
      financialOperationsIncome,
      forecastIncome,
      forecastVisits,
      filteredPackages,
      filteredAppointments,
      filteredVisits,
      incomeRecordsCount,
      packageIncome,
      paymentTotal,
      payments,
      platformCommissions,
      repeatClients,
      serviceRevenue,
      tips,
      totalIncome,
      totalReceived,
      outstandingDebts,
      allDebtVisits,
      visitsReceived,
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

  const chart = createChart(analytics.dates);
  const activePayments = analytics.payments.filter(
    (item) => item.recordsCount > 0,
  );
  const visiblePaymentStats = analytics.payments.filter(
    (item) =>
      item.recordsCount > 0 || ["Наличные", "Карта"].includes(item.label),
  );
  const mainStats = [
    {
      label: "Чистый доход",
      value: formatIncome(analytics.totalIncome),
      icon: CircleDollarSign,
      color: "#2364d2",
    },
    {
      label: "Поступления",
      value: formatIncome(analytics.totalReceived),
      icon: Banknote,
      color: "#248a4f",
      primary: true,
    },
    ...visiblePaymentStats.map((item) => ({
      label: item.label,
      value: formatIncome(item.value),
      icon: WalletCards,
      color: item.color,
      primary: ["Наличные", "Карта"].includes(item.label),
    })),
  ];
  const primaryStats = mainStats.filter(
    (item) => item.primary || item.label === "Чистый доход",
  );
  const secondaryStats = mainStats.filter(
    (item) => !item.primary && item.label !== "Чистый доход",
  );
  const overviewStats = [
    {
      label: `Прогноз · ${analytics.forecastVisits.length} записей`,
      value: formatIncome(analytics.forecastIncome),
      icon: TrendingUp,
      color: "#8b6fd6",
    },
    {
      label: "Завершено визитов",
      value: analytics.filteredAppointments.length,
      icon: CalendarRange,
      color: "#248a4f",
    },
    {
      label: "Клиентов за период",
      value: analytics.clientsCount,
      icon: Users,
      color: "#2364d2",
    },
    {
      label: "Пакетов продано",
      value: analytics.filteredPackages.length,
      icon: Package,
      color: "#d07a12",
    },
    {
      label: "Сертификатов",
      value: analytics.certificatesCount,
      icon: CircleDollarSign,
      color: "#d85886",
    },
    {
      label: "Средний чек",
      value: formatIncome(analytics.averageCheck),
      icon: Banknote,
      color: "#546273",
    },
    {
      label: "Долги клиентов",
      value: formatIncome(analytics.outstandingDebts),
      helper:
        analytics.debts > 0
          ? `${analytics.debtVisits.length} в периоде`
          : `${analytics.allDebtVisits.length} всего`,
      icon: WalletCards,
      color: "#c9483c",
    },
  ];
  const earnings = [
    ["Массажи после скидок", analytics.serviceRevenue],
    ["Продажи пакетов", analytics.packageIncome],
    ["Прочие поступления", analytics.financialOperationsIncome],
    ["Чаевые", analytics.tips],
    ["Доп. услуги", analytics.extras],
    ["Долги клиентов", -analytics.debts],
    ["Скидки предоставлено", -analytics.discounts],
    ["Выплаты мастерам", -analytics.employeePayouts],
    ["Комиссии платформ", -analytics.platformCommissions],
  ];
  const repeatRate =
    (analytics.repeatClients / Math.max(analytics.clientsCount, 1)) * 100;

  return (
    <section className="statistics-page">
      <div className="statistics-toolbar">
        <div className="statistics-heading">
          <div className="title-notifications-flex">
            <div>
              <h2>Статистика</h2>
              <p>Доходы, оплаты и поведение клиентов</p>
            </div>
            <PageNotificationsSlot />
          </div>
        </div>
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

      <div className="statistics-main-cards">
        <div className="statistics-primary-cards">
          {primaryStats.map((item) => (
            <StatisticsCard item={item} key={item.label} primary />
          ))}
        </div>
        {secondaryStats.length > 0 && (
          <div className="statistics-secondary-cards">
            {secondaryStats.map((item) => (
              <StatisticsCard item={item} key={item.label} />
            ))}
          </div>
        )}
      </div>

      <div className="statistics-overview-cards">
        {overviewStats.map((item) => (
          <StatisticsCard item={item} key={item.label} />
        ))}
      </div>

      <div className="statistics-layout">
        <article className="panel statistics-chart-panel">
          <div className="panel-header">
            <div>
              <h2>Доход по датам</h2>
              <p>
                Только завершённые визиты · {toDisplayDate(startDate)} —{" "}
                {toDisplayDate(endDate)}
              </p>
            </div>
            <strong>{formatIncome(analytics.totalIncome)}</strong>
          </div>
          <svg
            className="statistics-line-chart"
            viewBox="0 0 760 270"
            role="img"
            aria-label="График дохода по дням">
            {[30, 90, 150, 210].map((y) => (
              <line key={y} x1="38" x2="744" y1={y} y2={y} />
            ))}
            <path className="statistics-area" d={chart.areaPath} />
            <path className="statistics-line" d={chart.linePath} />
            {chart.points.map((point) => (
              <circle key={point.date} cx={point.x} cy={point.y} r="3">
                <title>
                  {shortDate(point.date)}: {formatIncome(point.income)}
                </title>
              </circle>
            ))}
          </svg>
          <div className="statistics-chart-labels">
            {chart.labels.map((date) => (
              <span key={date}>{shortDate(date)}</span>
            ))}
          </div>
        </article>

        <article className="panel statistics-ring-panel">
          <div>
            <h2>Структура оплат</h2>
            <p>По выбранному периоду</p>
          </div>
          <div className="statistics-ring-wrap">
            <div
              className="percent-ring dynamic-payment-ring statistics-ring"
              style={{
                "--payment-ring-gradient":
                  createPaymentRingGradient(activePayments),
              }}>
              <strong>
                {formatCompactMoney(
                  analytics.paymentTotal / (rates[currency] || 1),
                )}
              </strong>
              <span>поступления</span>
            </div>
            <div className="payment-breakdown">
              {activePayments.map((item) => (
                <span key={item.label}>
                  <i style={{background: item.color}} />
                  {item.label}
                  <strong>{formatIncome(item.value)}</strong>
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="panel statistics-breakdown-panel">
          <div>
            <h2>Вариации заработка</h2>
            <p>Что формирует итог</p>
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

        <article className="panel statistics-client-panel">
          <div>
            <h2>Клиенты</h2>
            <p>Аналитика базы и возвратов</p>
          </div>
          <div className="statistics-client-grid">
            <span>
              <Users size={16} />
              Уникальных<strong>{analytics.clientsCount}</strong>
            </span>
            <span>
              <TrendingUp size={16} />
              Повторных<strong>{analytics.repeatClients}</strong>
            </span>
            <span>
              <Banknote size={16} />
              Возвратность<strong>{Math.round(repeatRate)}%</strong>
            </span>
            <span>
              <Package size={16} />
              Пакетов продано
              <strong>{analytics.filteredPackages.length}</strong>
            </span>
            <span>
              <WalletCards size={16} />
              Визитов за период
              <strong>{analytics.filteredAppointments.length}</strong>
            </span>
            <span>
              <CircleDollarSign size={16} />
              Сертификатов<strong>{analytics.certificatesCount}</strong>
            </span>
          </div>
          <small>Всего клиентов в базе: {clients.length}</small>
        </article>
      </div>
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
    </article>
  );
}

const createChart = (dates) => {
  const width = 706;
  const height = 220;
  const maxIncome = Math.max(...dates.map((item) => item.income), 1);
  const points = dates.map((item, index) => ({
    ...item,
    x: 38 + (index / Math.max(dates.length - 1, 1)) * width,
    y: 240 - (item.income / maxIncome) * height,
  }));
  const linePath = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1).x} 240 L ${points[0].x} 240 Z`
    : "";
  const labelStep = Math.max(1, Math.ceil(dates.length / 7));
  const labels = dates
    .filter((_, index) => index % labelStep === 0 || index === dates.length - 1)
    .map((item) => item.date);

  return {areaPath, labels, linePath, points};
};

export default StatisticsPage;
