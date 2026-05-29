import {useEffect, useMemo, useState} from "react";
import {
  BarChart3,
  Banknote,
  Bitcoin,
  BriefcaseBusiness,
  Calendar,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  HandCoins,
  Home,
  ListFilter,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Settings,
  TicketPercent,
  Trash2,
  User,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import EmployeeForm from "./components/EmployeeForm.jsx";
import NewVisitForm from "./components/NewVisitForm.jsx";
import ToastStack from "./components/ToastStack.jsx";
import "./App.css";
import {
  clients,
  initialEmployees,
  initialClients,
  paymentMethods,
  services,
  visitsSeed,
} from "./data/seed.js";
import {formatMoney, toDisplayDate, toInputDate} from "./utils/formatters.jsx";
import {getVisitTotal} from "./utils/visits.jsx";
import StatsGrid from "./components/StatsGrid.jsx";
import VisitsTable from "./components/VisitsTable.jsx";
import EmployeesPage from "./components/EmployeesPage.jsx";
import ClientsPage from "./components/pages/ClientsPage.jsx";

const navItems = [
  {label: "Главная", page: "home", icon: Home},
  {label: "Визиты", page: "visits", icon: ClipboardList},
  {label: "Клиенты", page: "clients", icon: Users},
  {label: "Мастера", page: "masters", icon: User},
  {label: "Услуги", page: "services", icon: BriefcaseBusiness},
  {label: "Пакеты", page: "packages", icon: Package},
  {label: "Статистика", page: "stats", icon: BarChart3},
  {label: "Настройки", page: "settings", icon: Settings},
];

const VISITS_STORAGE_KEY = "nuar-crm-visits";
const ACTIVE_PAGE_STORAGE_KEY = "nuar-crm-active-page";
const EMPLOYEES_STORAGE_KEY = "nuar-crm-employees";
const CLIENTS_STORAGE_KEY = "nuar-crm-clients";

const loadStoredVisits = () => {
  try {
    const storedVisits = window.localStorage.getItem(VISITS_STORAGE_KEY);

    if (!storedVisits) {
      return visitsSeed;
    }

    const parsedVisits = JSON.parse(storedVisits);
    return Array.isArray(parsedVisits) ? parsedVisits : visitsSeed;
  } catch {
    return visitsSeed;
  }
};

const loadStoredActivePage = () => {
  try {
    const storedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    const pageExists = navItems.some((item) => item.page === storedPage);
    return pageExists ? storedPage : "home";
  } catch {
    return "home";
  }
};

const loadStoredEmployees = () => {
  try {
    const storedEmployees = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY);

    if (!storedEmployees) {
      return initialEmployees;
    }

    const parsedEmployees = JSON.parse(storedEmployees);
    return Array.isArray(parsedEmployees) ? parsedEmployees : initialEmployees;
  } catch {
    return initialEmployees;
  }
};
const loadStoredClients = () => {
  try {
    const storedClients = window.localStorage.getItem(CLIENTS_STORAGE_KEY);

    if (!storedClients) {
      return initialClients;
    }

    const parsedClients = JSON.parse(storedClients);
    return Array.isArray(parsedClients) ? parsedClients : initialClients;
  } catch {
    return initialClients;
  }
};

function App() {
  const [visits, setVisits] = useState(loadStoredVisits);
  const [employees, setEmployees] = useState(loadStoredEmployees);
  const [clientProfiles, setClientProfiles] = useState(loadStoredClients);
  const [activePage, setActivePage] = useState(loadStoredActivePage);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [pendingVisit, setPendingVisit] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({
    master: "",
    payment: "",
    client: "",
    date: "",
  });

  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) => {
        const matchesMaster =
          !filters.master || visit.master === filters.master;
        const matchesPayment =
          !filters.payment || visit.payment.includes(filters.payment);
        const matchesClient =
          !filters.client || visit.client === filters.client;
        const matchesDate =
          !filters.date || toInputDate(visit.date) === filters.date;

        return matchesMaster && matchesPayment && matchesClient && matchesDate;
      }),
    [filters, visits],
  );

  const masters = useMemo(
    () =>
      employees
        .filter((employee) => employee.status !== "Архив")
        .map((employee) => employee.name),
    [employees],
  );

  useEffect(() => {
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
  }, [activePage]);

  useEffect(() => {
    window.localStorage.setItem(
      EMPLOYEES_STORAGE_KEY,
      JSON.stringify(employees),
    );
  }, [employees]);
  useEffect(() => {
    window.localStorage.setItem(
      CLIENTS_STORAGE_KEY,
      JSON.stringify(clientProfiles),
    );
  }, [clientProfiles]);
  const homeStats = useMemo(() => {
    const today = "15.05.2024";
    const sumBy = (predicate) =>
      visits
        .filter(predicate)
        .reduce((sum, visit) => sum + getVisitTotal(visit), 0);

    const totalIncome = sumBy(() => true);
    const dayIncome = sumBy((visit) => visit.date === today);
    const cashIncome = sumBy((visit) => visit.payment.includes("Наличные"));
    const cryptoIncome = sumBy((visit) => visit.payment.includes("Крипта"));
    const tips = visits.reduce((sum, visit) => sum + visit.tip, 0);
    const discounts = visits.reduce((sum, visit) => sum + visit.discount, 0);
    const clientsCount = new Set(visits.map((visit) => visit.client)).size;
    const averageCheck = Math.round(totalIncome / Math.max(visits.length, 1));

    return [
      {
        title: "Общий доход",
        value: formatMoney(totalIncome),
        detail: "все визиты",
        icon: CircleDollarSign,
      },
      {
        title: "Доход за день",
        value: formatMoney(dayIncome),
        detail: today,
        icon: BarChart3,
      },
      {
        title: "Наличные",
        value: formatMoney(cashIncome),
        detail: "оплата наличными",
        icon: Banknote,
      },
      {
        title: "Крипта",
        value: formatMoney(cryptoIncome),
        detail: "крипто платежи",
        icon: Bitcoin,
      },
      {
        title: "Клиентов",
        value: clientsCount,
        detail: "уникальные клиенты",
        icon: Users,
      },
      {
        title: "Визитов",
        value: visits.length,
        detail: "в журнале",
        icon: ClipboardList,
      },
      {
        title: "Чай",
        value: formatMoney(tips),
        detail: "чаевые",
        icon: HandCoins,
      },
      {
        title: "Средний чек",
        value: formatMoney(averageCheck),
        detail: "после скидок",
        icon: WalletCards,
      },
      {
        title: "Скидки",
        value: formatMoney(discounts),
        detail: "сумма скидок",
        icon: TicketPercent,
      },
    ];
  }, [visits]);

  const employeeStats = useMemo(
    () =>
      employees.map((employee) => {
        const employeeVisits = visits.filter(
          (visit) => visit.master === employee.name,
        );
        const income = employeeVisits.reduce(
          (sum, visit) => sum + getVisitTotal(visit),
          0,
        );
        const tips = employeeVisits.reduce((sum, visit) => sum + visit.tip, 0);
        const averageCheck = Math.round(
          income / Math.max(employeeVisits.length, 1),
        );

        return {
          ...employee,
          visitsCount: employeeVisits.length,
          income,
          tips,
          averageCheck,
        };
      }),
    [employees, visits],
  );

  const handleVisitSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount")) || 0;
    const tip = Number(form.get("tip")) || 0;
    const commission = Number(form.get("commission")) || 0;
    const extra = Number(form.get("extra")) || 0;
    const discount = Number(form.get("discount")) || 0;

    setPendingVisit({
      form: event.currentTarget,
      mode: editingVisit ? "edit" : "create",
      visit: {
        id: editingVisit?.id ?? Date.now(),
        date: toDisplayDate(form.get("date")),
        client: form.get("client"),
        master: form.get("master"),
        service: form.get("service"),
        duration: "",
        amount,
        payment: form.get("payment"),
        tip,
        commission,
        extra,
        discount,
      },
    });
  };

  const pushNotification = (notification) => {
    const id = Date.now();
    setNotifications((current) => [...current, {id, ...notification}]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }, 3600);
  };

  const closeNotification = (id) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  const confirmVisitSave = () => {
    if (!pendingVisit) {
      return;
    }

    if (pendingVisit.mode === "edit") {
      setVisits((current) =>
        current.map((visit) =>
          visit.id === pendingVisit.visit.id ? pendingVisit.visit : visit,
        ),
      );
    } else {
      setVisits((current) => [pendingVisit.visit, ...current]);
    }
    pendingVisit.form.reset();
    setVisitModalOpen(false);
    setEditingVisit(null);
    pushNotification({
      title: pendingVisit.mode === "edit" ? "Визит обновлен" : "Визит сохранен",
      message: `${pendingVisit.visit.client} сохранен в журнале визитов`,
    });
    setPendingVisit(null);
  };

  const openCreateVisit = () => {
    setEditingVisit(null);
    setVisitModalOpen(true);
  };

  const openEditVisit = (visit) => {
    setOpenActionMenuId(null);
    setEditingVisit({...visit, date: toInputDate(visit.date)});
    setVisitModalOpen(true);
  };

  const deleteVisit = (visit) => {
    setOpenActionMenuId(null);
    setVisits((current) => current.filter((item) => item.id !== visit.id));
    pushNotification({
      title: "Визит удален",
      message: `${visit.client} удален из журнала визитов`,
    });
  };

  const openCreateEmployee = () => {
    setEditingEmployee(null);
    setEmployeeModalOpen(true);
  };

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const previousName = editingEmployee?.name;

    if (!name) {
      return;
    }

    const employee = {
      id: editingEmployee?.id ?? Date.now(),
      name,
      role: String(form.get("role") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      commissionRate: Number(form.get("commissionRate")) || 0,
      status: form.get("status"),
    };

    setEmployees((current) =>
      editingEmployee
        ? current.map((item) => (item.id === employee.id ? employee : item))
        : [employee, ...current],
    );

    if (previousName && previousName !== employee.name) {
      setVisits((current) =>
        current.map((visit) =>
          visit.master === previousName
            ? {...visit, master: employee.name}
            : visit,
        ),
      );
    }

    setEmployeeModalOpen(false);
    setEditingEmployee(null);
    pushNotification({
      title: editingEmployee ? "Сотрудник обновлен" : "Сотрудник добавлен",
      message: `${employee.name} сохранен в базе сотрудников`,
    });
  };

  const deleteEmployee = (employee) => {
    setEmployees((current) =>
      current.filter((item) => item.id !== employee.id),
    );
    pushNotification({
      title: "Сотрудник удален",
      message: `${employee.name} удален из базы сотрудников`,
    });
  };

  const isVisitsPage = activePage === "visits";
  const isMastersPage = activePage === "masters";
  const isClientsPage = activePage === "clients";
  const pageTitle = isVisitsPage
    ? "Визиты"
    : isClientsPage
      ? "Клиенты"
      : isMastersPage
        ? "Мастера"
        : "Главная";

  const pageDescription = isVisitsPage
    ? "Журнал визитов и добавление новой записи"
    : isClientsPage
      ? "База клиентов и история посещений"
      : isMastersPage
        ? "Сотрудники, управление и статистика"
        : "Финансы, клиенты и ключевые показатели";
  const handleFilterChange = (name, value) => {
    setFilters((current) => ({...current, [name]: value}));
  };

  const resetFilters = () => {
    setFilters({
      master: "",
      payment: "",
      client: "",
      date: "",
    });
  };

  return (
    <div
      className="crm-shell"
      onClick={() => {
        if (openActionMenuId) {
          setOpenActionMenuId(null);
        }
      }}>
      <aside className="sidebar">
        <div className="logo">
          <span>NUAR</span>
          <small>MASSAGE STUDIO</small>
        </div>

        <nav className="nav-list" aria-label="Главное меню">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activePage === item.page ? "active" : ""}
                key={item.label}
                onClick={() => setActivePage(item.page)}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="owner-card">
          <div className="owner-avatar">В</div>
          <div>
            <strong>Влад</strong>
            <span>Владелец</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </aside>

      <main
        className={`content ${isVisitsPage ? "visits-content" : "home-content"}`}>
        <header className="page-header">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          <button className="date-button">
            <Calendar size={18} />
            15 мая 2024
            <ChevronDown size={16} />
          </button>
        </header>
        {isVisitsPage ? (
          <section className="visits-page-grid">
            <VisitsTable
              visits={filteredVisits}
              title="Все визиты"
              masters={masters}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={resetFilters}
              openActionMenuId={openActionMenuId}
              onToggleActionMenu={setOpenActionMenuId}
              onEditVisit={openEditVisit}
              onDeleteVisit={deleteVisit}
            />
            <button
              className="add-visit-button"
              type="button"
              onClick={openCreateVisit}>
              <Plus size={18} />
              Добавить визит
            </button>
          </section>
        ) : isClientsPage ? (
          <ClientsPage visits={visits} clients={clientProfiles} />
        ) : isMastersPage ? (
          <EmployeesPage
            employees={employeeStats}
            onAdd={openCreateEmployee}
            onEdit={openEditEmployee}
            onDelete={deleteEmployee}
          />
        ) : (
          <StatsGrid stats={homeStats} />
        )}
      </main>
      {visitModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="visit-modal"
            role="dialog"
            aria-labelledby="visit-modal-title">
            <div className="modal-header">
              <h2 id="visit-modal-title">
                {editingVisit ? "Редактировать визит" : "Добавить визит"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setVisitModalOpen(false);
                  setEditingVisit(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <NewVisitForm
              clients={clients}
              masters={masters}
              services={services}
              initialVisit={editingVisit}
              onSubmit={handleVisitSubmit}
            />
          </section>
        </div>
      )}
      {employeeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal"
            role="dialog"
            aria-labelledby="employee-modal-title">
            <div className="modal-header">
              <h2 id="employee-modal-title">
                {editingEmployee
                  ? "Редактировать сотрудника"
                  : "Добавить сотрудника"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setEmployeeModalOpen(false);
                  setEditingEmployee(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <EmployeeForm
              employee={editingEmployee}
              onSubmit={handleEmployeeSubmit}
            />
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingVisit)}
        title="Сохранить визит?"
        message="Проверьте данные перед добавлением визита в журнал."
        confirmLabel="Сохранить"
        onCancel={() => setPendingVisit(null)}
        onConfirm={confirmVisitSave}
      />
      <ToastStack notifications={notifications} onClose={closeNotification} />
    </div>
  );
}

export default App;
