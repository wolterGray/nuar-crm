import { Search, UserRound } from 'lucide-react'

function ClientsPanel({ clients, query, onQueryChange }) {
  const filteredClients = clients.filter((client) =>
    `${client.name} ${client.phone} ${client.favorite}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <section className="panel clients-panel">
      <div className="panel-header">
        <div className="panel-title">
          <UserRound size={18} />
          <h2>Клиенты</h2>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск"
          />
        </label>
      </div>
      <div className="client-list">
        {filteredClients.map((client) => (
          <article className="client-row" key={client.id}>
            <div className="avatar">{client.name.slice(0, 1)}</div>
            <div className="client-main">
              <strong>{client.name}</strong>
              <span>{client.phone}</span>
            </div>
            <div className="client-meta">
              <span>{client.visits} визитов</span>
              <b>{client.favorite}</b>
            </div>
            <span className={client.balance > 0 ? 'tag warning' : 'tag'}>
              {client.tag}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ClientsPanel
