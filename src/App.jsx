import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import EmployeeForm from './components/EmployeeForm.jsx'
import NewVisitForm from './components/NewVisitForm.jsx'
import ToastStack from './components/ToastStack.jsx'
import './App.css'

const visitsSeed = [
  {
    id: 1,
    date: '15.05.2024',
    client: 'Александр П.',
    master: 'Ольга',
    service: 'Классический массаж',
    duration: '60 мин',
    amount: 250,
    payment: 'Наличные',
    tip: 20,
    commission: 0,
    extra: 0,
    discount: 0,
  },
  {
    id: 2,
    date: '15.05.2024',
    client: 'Мария С.',
    master: 'Максим',
    service: 'Спортивный массаж',
    duration: '90 мин',
    amount: 350,
    payment: 'Карта',
    tip: 0,
    commission: 8,
    extra: 0,
    discount: 20,
  },
  {
    id: 3,
    date: '15.05.2024',
    client: 'Иван К.',
    master: 'Ольга',
    service: 'Массаж спины',
    duration: '45 мин',
    amount: 200,
    payment: 'Наличные',
    tip: 15,
    commission: 0,
    extra: 30,
    discount: 0,
  },
  {
    id: 4,
    date: '14.05.2024',
    client: 'Екатерина Л.',
    master: 'Ольга',
    service: 'Релакс массаж',
    duration: '60 мин',
    amount: 250,
    payment: 'Пакет (5/10)',
    tip: 0,
    commission: 0,
    extra: 0,
    discount: 0,
  },
  {
    id: 5,
    date: '14.05.2024',
    client: 'Дмитрий Т.',
    master: 'Максим',
    service: 'Спортивный массаж',
    duration: '60 мин',
    amount: 280,
    payment: 'Карта',
    tip: 10,
    commission: 7,
    extra: 0,
    discount: 0,
  },
  {
    id: 6,
    date: '14.05.2024',
    client: 'Анна Б.',
    master: 'Новая мастер',
    service: 'Лимфодренаж',
    duration: '60 мин',
    amount: 250,
    payment: 'Наличные',
    tip: 0,
    commission: 0,
    extra: 20,
    discount: 10,
  },
  {
    id: 7,
    date: '14.05.2024',
    client: 'Сергей М.',
    master: 'Максим',
    service: 'Массаж спины',
    duration: '45 мин',
    amount: 200,
    payment: 'Карта',
    tip: 0,
    commission: 5,
    extra: 0,
    discount: 0,
  },
  {
    id: 8,
    date: '13.05.2024',
    client: 'Юлия В.',
    master: 'Ольга',
    service: 'Классический массаж',
    duration: '90 мин',
    amount: 350,
    payment: 'Крипта',
    tip: 25,
    commission: 0,
    extra: 0,
    discount: 0,
  },
]

const navItems = [
  { label: 'Главная', page: 'home', icon: Home },
  { label: 'Визиты', page: 'visits', icon: ClipboardList },
  { label: 'Клиенты', page: 'clients', icon: Users },
  { label: 'Мастера', page: 'masters', icon: User },
  { label: 'Услуги', page: 'services', icon: BriefcaseBusiness },
  { label: 'Пакеты', page: 'packages', icon: Package },
  { label: 'Статистика', page: 'stats', icon: BarChart3 },
  { label: 'Настройки', page: 'settings', icon: Settings },
]

const clients = [
  'Александр П.',
  'Мария С.',
  'Иван К.',
  'Екатерина Л.',
  'Анна Б.',
]
const initialEmployees = [
  {
    id: 1,
    name: 'Ольга',
    role: 'Массажист',
    phone: '+48 500 100 200',
    commissionRate: 35,
    status: 'Активен',
  },
  {
    id: 2,
    name: 'Максим',
    role: 'Массажист',
    phone: '+48 500 200 300',
    commissionRate: 40,
    status: 'Активен',
  },
  {
    id: 3,
    name: 'Новая мастер',
    role: 'Стажер',
    phone: '',
    commissionRate: 30,
    status: 'Пауза',
  },
]
const services = [
  'Классический массаж',
  'Спортивный массаж',
  'Массаж спины',
  'Релакс массаж',
  'Лимфодренаж',
]
const paymentMethods = ['Наличные', 'Карта', 'Пакет', 'Крипта']
const VISITS_STORAGE_KEY = 'nuar-crm-visits'
const ACTIVE_PAGE_STORAGE_KEY = 'nuar-crm-active-page'
const EMPLOYEES_STORAGE_KEY = 'nuar-crm-employees'

const loadStoredVisits = () => {
  try {
    const storedVisits = window.localStorage.getItem(VISITS_STORAGE_KEY)

    if (!storedVisits) {
      return visitsSeed
    }

    const parsedVisits = JSON.parse(storedVisits)
    return Array.isArray(parsedVisits) ? parsedVisits : visitsSeed
  } catch {
    return visitsSeed
  }
}

const loadStoredActivePage = () => {
  try {
    const storedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY)
    const pageExists = navItems.some((item) => item.page === storedPage)
    return pageExists ? storedPage : 'home'
  } catch {
    return 'home'
  }
}

const loadStoredEmployees = () => {
  try {
    const storedEmployees = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY)

    if (!storedEmployees) {
      return initialEmployees
    }

    const parsedEmployees = JSON.parse(storedEmployees)
    return Array.isArray(parsedEmployees) ? parsedEmployees : initialEmployees
  } catch {
    return initialEmployees
  }
}

const toInputDate = (date) => {
  const [day, month, year] = date.split('.')
  return `${year}-${month}-${day}`
}

const toDisplayDate = (date) => {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

const getVisitTotal = (visit) =>
  visit.amount + visit.tip + visit.extra - visit.commission - visit.discount

const formatMoney = (value) => `${value} zł`

function App() {
  const [visits, setVisits] = useState(loadStoredVisits)
  const [employees, setEmployees] = useState(loadStoredEmployees)
  const [activePage, setActivePage] = useState(loadStoredActivePage)
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [pendingVisit, setPendingVisit] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [filters, setFilters] = useState({
    master: '',
    payment: '',
    client: '',
    date: '',
  })

  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) => {
        const matchesMaster = !filters.master || visit.master === filters.master
        const matchesPayment =
          !filters.payment || visit.payment.includes(filters.payment)
        const matchesClient = !filters.client || visit.client === filters.client
        const matchesDate = !filters.date || toInputDate(visit.date) === filters.date

        return matchesMaster && matchesPayment && matchesClient && matchesDate
      }),
    [filters, visits],
  )

  const masters = useMemo(
    () => employees.filter((employee) => employee.status !== 'Архив').map((employee) => employee.name),
    [employees],
  )

  useEffect(() => {
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits))
  }, [visits])

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage)
  }, [activePage])

  useEffect(() => {
    window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees))
  }, [employees])

  const homeStats = useMemo(() => {
    const today = '15.05.2024'
    const sumBy = (predicate) =>
      visits
        .filter(predicate)
        .reduce((sum, visit) => sum + getVisitTotal(visit), 0)

    const totalIncome = sumBy(() => true)
    const dayIncome = sumBy((visit) => visit.date === today)
    const cashIncome = sumBy((visit) => visit.payment.includes('Наличные'))
    const cryptoIncome = sumBy((visit) => visit.payment.includes('Крипта'))
    const tips = visits.reduce((sum, visit) => sum + visit.tip, 0)
    const discounts = visits.reduce((sum, visit) => sum + visit.discount, 0)
    const clientsCount = new Set(visits.map((visit) => visit.client)).size
    const averageCheck = Math.round(totalIncome / Math.max(visits.length, 1))

    return [
      {
        title: 'Общий доход',
        value: formatMoney(totalIncome),
        detail: 'все визиты',
        icon: CircleDollarSign,
      },
      {
        title: 'Доход за день',
        value: formatMoney(dayIncome),
        detail: today,
        icon: BarChart3,
      },
      {
        title: 'Наличные',
        value: formatMoney(cashIncome),
        detail: 'оплата наличными',
        icon: Banknote,
      },
      {
        title: 'Крипта',
        value: formatMoney(cryptoIncome),
        detail: 'крипто платежи',
        icon: Bitcoin,
      },
      {
        title: 'Клиентов',
        value: clientsCount,
        detail: 'уникальные клиенты',
        icon: Users,
      },
      {
        title: 'Визитов',
        value: visits.length,
        detail: 'в журнале',
        icon: ClipboardList,
      },
      {
        title: 'Чай',
        value: formatMoney(tips),
        detail: 'чаевые',
        icon: HandCoins,
      },
      {
        title: 'Средний чек',
        value: formatMoney(averageCheck),
        detail: 'после скидок',
        icon: WalletCards,
      },
      {
        title: 'Скидки',
        value: formatMoney(discounts),
        detail: 'сумма скидок',
        icon: TicketPercent,
      },
    ]
  }, [visits])

  const employeeStats = useMemo(
    () =>
      employees.map((employee) => {
        const employeeVisits = visits.filter((visit) => visit.master === employee.name)
        const income = employeeVisits.reduce(
          (sum, visit) => sum + getVisitTotal(visit),
          0,
        )
        const tips = employeeVisits.reduce((sum, visit) => sum + visit.tip, 0)
        const averageCheck = Math.round(income / Math.max(employeeVisits.length, 1))

        return {
          ...employee,
          visitsCount: employeeVisits.length,
          income,
          tips,
          averageCheck,
        }
      }),
    [employees, visits],
  )

  const handleVisitSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount')) || 0
    const tip = Number(form.get('tip')) || 0
    const commission = Number(form.get('commission')) || 0
    const extra = Number(form.get('extra')) || 0
    const discount = Number(form.get('discount')) || 0

    setPendingVisit({
      form: event.currentTarget,
      mode: editingVisit ? 'edit' : 'create',
      visit: {
        id: editingVisit?.id ?? Date.now(),
        date: toDisplayDate(form.get('date')),
        client: form.get('client'),
        master: form.get('master'),
        service: form.get('service'),
        duration: '',
        amount,
        payment: form.get('payment'),
        tip,
        commission,
        extra,
        discount,
      },
    })
  }

  const pushNotification = (notification) => {
    const id = Date.now()
    setNotifications((current) => [...current, { id, ...notification }])
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id))
    }, 3600)
  }

  const closeNotification = (id) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }

  const confirmVisitSave = () => {
    if (!pendingVisit) {
      return
    }

    if (pendingVisit.mode === 'edit') {
      setVisits((current) =>
        current.map((visit) =>
          visit.id === pendingVisit.visit.id ? pendingVisit.visit : visit,
        ),
      )
    } else {
      setVisits((current) => [pendingVisit.visit, ...current])
    }
    pendingVisit.form.reset()
    setVisitModalOpen(false)
    setEditingVisit(null)
    pushNotification({
      title: pendingVisit.mode === 'edit' ? 'Визит обновлен' : 'Визит сохранен',
      message: `${pendingVisit.visit.client} сохранен в журнале визитов`,
    })
    setPendingVisit(null)
  }

  const openCreateVisit = () => {
    setEditingVisit(null)
    setVisitModalOpen(true)
  }

  const openEditVisit = (visit) => {
    setOpenActionMenuId(null)
    setEditingVisit({ ...visit, date: toInputDate(visit.date) })
    setVisitModalOpen(true)
  }

  const deleteVisit = (visit) => {
    setOpenActionMenuId(null)
    setVisits((current) => current.filter((item) => item.id !== visit.id))
    pushNotification({
      title: 'Визит удален',
      message: `${visit.client} удален из журнала визитов`,
    })
  }

  const openCreateEmployee = () => {
    setEditingEmployee(null)
    setEmployeeModalOpen(true)
  }

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee)
    setEmployeeModalOpen(true)
  }

  const handleEmployeeSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const previousName = editingEmployee?.name

    if (!name) {
      return
    }

    const employee = {
      id: editingEmployee?.id ?? Date.now(),
      name,
      role: String(form.get('role') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      commissionRate: Number(form.get('commissionRate')) || 0,
      status: form.get('status'),
    }

    setEmployees((current) =>
      editingEmployee
        ? current.map((item) => (item.id === employee.id ? employee : item))
        : [employee, ...current],
    )

    if (previousName && previousName !== employee.name) {
      setVisits((current) =>
        current.map((visit) =>
          visit.master === previousName ? { ...visit, master: employee.name } : visit,
        ),
      )
    }

    setEmployeeModalOpen(false)
    setEditingEmployee(null)
    pushNotification({
      title: editingEmployee ? 'Сотрудник обновлен' : 'Сотрудник добавлен',
      message: `${employee.name} сохранен в базе сотрудников`,
    })
  }

  const deleteEmployee = (employee) => {
    setEmployees((current) => current.filter((item) => item.id !== employee.id))
    pushNotification({
      title: 'Сотрудник удален',
      message: `${employee.name} удален из базы сотрудников`,
    })
  }

  const isVisitsPage = activePage === 'visits'
  const isMastersPage = activePage === 'masters'
  const pageTitle = isVisitsPage ? 'Визиты' : isMastersPage ? 'Мастера' : 'Главная'
  const pageDescription = isVisitsPage
    ? 'Журнал визитов и добавление новой записи'
    : isMastersPage
      ? 'Сотрудники, управление и статистика'
      : 'Финансы, клиенты и ключевые показатели'

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const resetFilters = () => {
    setFilters({
      master: '',
      payment: '',
      client: '',
      date: '',
    })
  }

  return (
    <div
      className="crm-shell"
      onClick={() => {
        if (openActionMenuId) {
          setOpenActionMenuId(null)
        }
      }}
    >
      <aside className="sidebar">
        <div className="logo">
          <span>NUAR</span>
          <small>MASSAGE STUDIO</small>
        </div>

        <nav className="nav-list" aria-label="Главное меню">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activePage === item.page ? 'active' : ''}
                key={item.label}
                onClick={() => setActivePage(item.page)}
              >
                <Icon size={20} />
                {item.label}
              </button>
            )
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

      <main className={`content ${isVisitsPage ? 'visits-content' : 'home-content'}`}>
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
              onClick={openCreateVisit}
            >
              <Plus size={18} />
              Добавить визит
            </button>
          </section>
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
            aria-labelledby="visit-modal-title"
          >
            <div className="modal-header">
              <h2 id="visit-modal-title">
                {editingVisit ? 'Редактировать визит' : 'Добавить визит'}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setVisitModalOpen(false)
                  setEditingVisit(null)
                }}
              >
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
            aria-labelledby="employee-modal-title"
          >
            <div className="modal-header">
              <h2 id="employee-modal-title">
                {editingEmployee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setEmployeeModalOpen(false)
                  setEditingEmployee(null)
                }}
              >
                <X size={18} />
              </button>
            </div>
            <EmployeeForm employee={editingEmployee} onSubmit={handleEmployeeSubmit} />
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
  )
}

function StatsGrid({ stats }) {
  return (
    <section className="stats-grid">
      {stats.map((card) => {
        const Icon = card.icon
        return (
          <article className="stat-card" key={card.title}>
            <div className="stat-icon">
              <Icon size={25} />
            </div>
            <div>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function EmployeesPage({ employees, onAdd, onEdit, onDelete }) {
  return (
    <section className="employees-page">
      <div className="employees-toolbar">
        <div>
          <h2>Сотрудники</h2>
          <p>{employees.length} в базе</p>
        </div>
        <button className="add-visit-button" type="button" onClick={onAdd}>
          <Plus size={18} />
          Добавить сотрудника
        </button>
      </div>

      <div className="employees-grid">
        {employees.map((employee) => (
          <article className="employee-card" key={employee.id}>
            <div className="employee-card-header">
              <div className="employee-avatar">{employee.name.slice(0, 1)}</div>
              <div>
                <h3>{employee.name}</h3>
                <span>{employee.role}</span>
              </div>
              <b className={employee.status === 'Активен' ? 'status-active' : ''}>
                {employee.status}
              </b>
            </div>

            <div className="employee-stats">
              <span>
                Визитов <strong>{employee.visitsCount}</strong>
              </span>
              <span>
                Доход <strong>{formatMoney(employee.income)}</strong>
              </span>
              <span>
                Чай <strong>{formatMoney(employee.tips)}</strong>
              </span>
              <span>
                Средний чек <strong>{formatMoney(employee.averageCheck)}</strong>
              </span>
            </div>

            <div className="employee-meta">
              <span>{employee.phone || 'Телефон не указан'}</span>
              <span>Комиссия {employee.commissionRate}%</span>
            </div>

            <div className="employee-actions">
              <button className="secondary-button" type="button" onClick={() => onEdit(employee)}>
                <Pencil size={16} />
                Редактировать
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(employee)}>
                <Trash2 size={16} />
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function VisitsTable({
  visits,
  title,
  masters,
  filters,
  onFilterChange,
  onResetFilters,
  openActionMenuId,
  onToggleActionMenu,
  onEditVisit,
  onDeleteVisit,
}) {
  const clientCount = new Set(visits.map((visit) => visit.client)).size
  const clientOptions = [...new Set(visits.map((visit) => visit.client))]

  return (
    <section className="panel visits-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <button className="secondary-button" onClick={onResetFilters}>
          <ListFilter size={17} />
          Сбросить
        </button>
      </div>

      <div className="table-filters">
        <label>
          Сотрудник
          <select
            value={filters.master}
            onChange={(event) => onFilterChange('master', event.target.value)}
          >
            <option value="">Все</option>
            {masters.map((master) => (
              <option key={master}>{master}</option>
            ))}
          </select>
        </label>
        <label>
          Оплата
          <select
            value={filters.payment}
            onChange={(event) => onFilterChange('payment', event.target.value)}
          >
            <option value="">Все</option>
            {paymentMethods.map((payment) => (
              <option key={payment}>{payment}</option>
            ))}
          </select>
        </label>
        <label>
          Клиент
          <select
            value={filters.client}
            onChange={(event) => onFilterChange('client', event.target.value)}
          >
            <option value="">Все</option>
            {clientOptions.map((client) => (
              <option key={client}>{client}</option>
            ))}
          </select>
        </label>
        <label>
          Дата
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange('date', event.target.value)}
          />
        </label>
      </div>

      <div className="visits-table">
        <div className="table-row table-head">
          <span>Дата</span>
          <span>Клиент</span>
          <span>Услуга</span>
          <span>Работник</span>
          <span>Оплата</span>
          <span>Чай</span>
          <span>Комиссия</span>
          <span>Доп сумма</span>
          <span>Скидка</span>
          <span>Итог</span>
          <span></span>
        </div>
        {visits.map((visit) => (
          <div className="table-row" key={visit.id}>
            <span>{visit.date}</span>
            <TooltipCell value={visit.client} />
            <span>{visit.service}</span>
            <span>{visit.master}</span>
            <TooltipCell
              className={visit.payment.includes('Пакет') ? 'package' : ''}
              value={visit.payment}
            />
            <span>{formatMoney(visit.tip)}</span>
            <span>{formatMoney(visit.commission)}</span>
            <span>{formatMoney(visit.extra)}</span>
            <span>{formatMoney(visit.discount)}</span>
            <span className="total-cell">{formatMoney(getVisitTotal(visit))}</span>
            <div className="row-actions" onClick={(event) => event.stopPropagation()}>
              <button
                className="row-action"
                aria-label="Действия"
                onClick={() =>
                  onToggleActionMenu(openActionMenuId === visit.id ? null : visit.id)
                }
              >
                <MoreVertical size={18} />
              </button>
              {openActionMenuId === visit.id && (
                <div className="row-action-menu">
                  <button type="button" onClick={() => onEditVisit(visit)}>
                    Редактировать
                  </button>
                  <button type="button" onClick={() => onDeleteVisit(visit)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <footer className="table-footer">
        <span>Клиентов: {clientCount}</span>
      </footer>
    </section>
  )
}

function TooltipCell({ value, className = '' }) {
  return (
    <span className={`tooltip-cell ${className}`} tabIndex="0">
      <span className="cell-value">{value}</span>
      <span className="cell-tooltip" role="tooltip">
        {value}
      </span>
    </span>
  )
}

export default App
