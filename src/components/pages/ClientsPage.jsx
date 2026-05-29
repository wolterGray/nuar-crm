import {UserRound} from "lucide-react";
import {formatMoney} from "../../utils/formatters.jsx";
import {getVisitTotal} from "../../utils/visits.jsx";
import {useState} from "react";

function ClientsPage({visits}) {
  const clients = Object.values(
    visits.reduce((acc, visit) => {
      if (!acc[visit.client]) {
        acc[visit.client] = {
          name: visit.client,
          visitsCount: 0,
          totalIncome: 0,
          lastVisit: visit.date,
        };
      }

      acc[visit.client].visitsCount += 1;
      acc[visit.client].totalIncome += getVisitTotal(visit);
      acc[visit.client].lastVisit = visit.date;

      return acc;
    }, {}),
  );
  const [search, setSearch] = useState("");

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="employees-page">
      <input
        type="text"
        placeholder="Поиск клиента..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="employees-toolbar">
        <div>
          <h2>Клиенты</h2>
          <p>{clients.length} в базе</p>
        </div>
      </div>

      <div className="employees-grid">
        {clients.map((client) => (
          <article className="employee-card" key={client.name}>
            <div className="employee-card-header">
              <div className="employee-avatar">
                <UserRound size={22} />
              </div>

              <div>
                <h3>{client.name}</h3>
                <span>Клиент Nuar</span>
              </div>
            </div>

            <div className="employee-stats">
              <span>
                Визитов <strong>{client.visitsCount}</strong>
              </span>
              <span>
                Сумма <strong>{formatMoney(client.totalIncome)}</strong>
              </span>
              <span>
                Последний визит <strong>{client.lastVisit}</strong>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ClientsPage;
