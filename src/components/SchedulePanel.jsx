import { CalendarDays, MoreHorizontal } from 'lucide-react'

const statusLabels = {
  confirmed: 'Подтверждена',
  waiting: 'Ожидает',
  done: 'Завершена',
}

function SchedulePanel({ appointments, onStatusChange }) {
  return (
    <section className="panel schedule-panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={18} />
          <h2>Сегодня</h2>
        </div>
        <button className="ghost-button" type="button">
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div className="timeline">
        {appointments.map((appointment) => (
          <article className="appointment-row" key={appointment.id}>
            <div className="appointment-body">
              <div>
                <strong>{appointment.client}</strong>
                <span>
                  {appointment.service} · {appointment.room}
                </span>
              </div>
              <div className="appointment-side">
                <b>{appointment.price} zl</b>
                <span>{appointment.master}</span>
              </div>
              <div className="status-switch" aria-label="Статус записи">
                {Object.entries(statusLabels).map(([status, label]) => (
                  <button
                    className={appointment.status === status ? 'active' : ''}
                    key={status}
                    type="button"
                    onClick={() => onStatusChange(appointment.id, status)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default SchedulePanel
