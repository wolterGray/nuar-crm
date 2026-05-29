import { Banknote, CalendarCheck, Clock3, UsersRound } from 'lucide-react'

const icons = {
  revenue: Banknote,
  appointments: CalendarCheck,
  clients: UsersRound,
  fill: Clock3,
}

function MetricGrid({ metrics }) {
  return (
    <section className="metric-grid" aria-label="Показатели">
      {metrics.map((metric) => {
        const Icon = icons[metric.icon]
        return (
          <article className="metric-card" key={metric.label}>
            <div className="metric-icon">
              <Icon size={19} />
            </div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        )
      })}
    </section>
  )
}

export default MetricGrid
