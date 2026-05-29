import { ChartNoAxesColumnIncreasing, Sparkles } from 'lucide-react'

function ServicePanel({ services, staff }) {
  return (
    <section className="side-stack">
      <div className="panel services-panel">
        <div className="panel-title">
          <Sparkles size={18} />
          <h2>Услуги</h2>
        </div>
        <div className="service-list">
          {services.map((service) => (
            <article className="service-row" key={service.id}>
              <span className={`service-dot ${service.color}`} />
              <div>
                <strong>{service.title}</strong>
                <small>{service.duration} мин</small>
              </div>
              <b>{service.price} zl</b>
            </article>
          ))}
        </div>
      </div>
      <div className="panel team-panel">
        <div className="panel-title">
          <ChartNoAxesColumnIncreasing size={18} />
          <h2>Команда</h2>
        </div>
        {staff.map((person) => (
          <article className="team-row" key={person.id}>
            <div>
              <strong>{person.name}</strong>
              <span>{person.role}</span>
            </div>
            <div className="load-track" aria-label={`Загрузка ${person.name}`}>
              <span style={{ width: `${person.load}%` }} />
            </div>
            <b>{person.load}%</b>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ServicePanel
