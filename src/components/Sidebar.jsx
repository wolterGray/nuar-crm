import {
  CalendarRange,
  LayoutDashboard,
  MessageSquareText,
  Scissors,
  UsersRound,
} from 'lucide-react'

const navItems = [
  { label: 'Обзор', icon: LayoutDashboard, active: true },
  { label: 'Записи', icon: CalendarRange },
  { label: 'Клиенты', icon: UsersRound },
  { label: 'Услуги', icon: Scissors },
  { label: 'Сообщения', icon: MessageSquareText },
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>N</span>
        <div>
          <strong>Nuar</strong>
          <small>massage studio</small>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Основная навигация">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={item.active ? 'active' : ''}
              type="button"
              key={item.label}
            >
              <Icon size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-note">
        <strong>5 пакетов</strong>
        <span>активны у клиентов</span>
      </div>
    </aside>
  )
}

export default Sidebar
