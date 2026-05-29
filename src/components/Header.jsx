import { Bell, CalendarDays, Plus, Settings } from 'lucide-react'

function Header() {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">NUAR CRM</p>
        <h1>Массажный салон</h1>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Календарь">
          <CalendarDays size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Уведомления">
          <Bell size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Настройки">
          <Settings size={18} />
        </button>
        <button className="add-button" type="button">
          <Plus size={18} />
          Запись
        </button>
      </div>
    </header>
  )
}

export default Header
