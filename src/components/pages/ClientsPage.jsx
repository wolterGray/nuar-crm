import {CakeSlice, Eye, MessageSquareText, MoreVertical, Pencil, Plus, Search, Trash2, X} from "lucide-react";
import {useMemo, useState} from "react";
import {
  formatMoney,
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
} from "../../utils/formatters.jsx";
import {getVisitTotal} from "../../utils/visits.jsx";

function ClientsPage({
  visits,
  clients,
  clientPackages,
  communicationLog,
  employees,
  inactiveClientDays,
  onAddClient,
  onEditClient,
  onDeleteClient,
  onMessageClient,
}) {
  const [openClientMenuId, setOpenClientMenuId] = useState(null);
  const [viewedClient, setViewedClient] = useState(null);
  const [search, setSearch] = useState("");
  const viewedClientCommunications = communicationLog
    .filter(
      (entry) =>
        entry.clientId === viewedClient?.id ||
        entry.clientName === viewedClient?.name,
    )
    .slice(0, 5);

  const clientsData = useMemo(
    () =>
      clients.map((client) => {
        const clientVisits = visits.filter((visit) => visit.client === client.name);
        const packages = clientPackages.filter(
          (packageItem) => packageItem.client === client.name,
        );
        const totalIncome = clientVisits.reduce(
          (sum, visit) => sum + getVisitTotal(visit, employees),
          0,
        ) + packages.reduce(
          (sum, packageItem) => sum + (Number(packageItem.price) || 0),
          0,
        );
        const packagesLeft = packages.reduce(
          (sum, packageItem) => sum + (Number(packageItem.remainingVisits) || 0),
          0,
        );
        const lastVisit =
          getLatestDisplayDate(clientVisits.map((visit) => visit.date)) || "—";
        const daysAbsent = getDaysSinceDisplayDate(lastVisit);

        return {
          ...client,
          visitsCount: clientVisits.length,
          totalIncome,
          packagesCount: packages.length,
          packagesLeft,
          lastVisit,
          daysAbsent,
        };
      }),
    [clientPackages, clients, employees, visits],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredClients = clientsData.filter((client) =>
    [
      client.name,
      client.phone,
      client.email,
      client.birthday,
      client.instagram,
      client.telegram,
      client.note,
      client.source,
      client.preference,
      client.status,
      client.tags,
      client.lastVisit,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );

  return (
    <section
      className="panel clients-page"
      onClick={() => setOpenClientMenuId(null)}>
      <div className="clients-toolbar">
        <div>
          <h2>Клиенты</h2>
          <p>
            {filteredClients.length} из {clients.length} в базе
          </p>
        </div>
        <div className="clients-toolbar-actions">
          <label className="clients-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenClientMenuId(null);
              }}
              placeholder="Поиск клиента"
            />
            {search && (
              <button
                aria-label="Очистить поиск"
                type="button"
                onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </label>
          <button className="add-visit-button" type="button" onClick={onAddClient}>
            <Plus size={18} />
            Добавить клиента
          </button>
        </div>
      </div>

      <div className="clients-table">
        <div className="clients-table-row clients-table-head">
          <span>Клиент</span>
          <span>Статус</span>
          <span>Визитов</span>
          <span>Пакеты</span>
          <span>Сумма</span>
          <span>Последний визит</span>
          <span>Не был</span>
          <span>Заметка</span>
          <span></span>
        </div>

        {filteredClients.map((client) => (
          <div
            className={`clients-table-row ${
              client.daysAbsent === null || client.daysAbsent >= inactiveClientDays
                ? "client-needs-contact"
                : ""
            }`}
            role="button"
            tabIndex="0"
            key={client.id}
            onClick={() => setViewedClient(client)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setViewedClient(client);
              }
            }}>
            <span className="client-name-cell">
              <strong>{client.name}</strong>
              <small>{client.phone || "Телефон не указан"}</small>
            </span>
            <span data-label="Статус"><b className="client-status">{client.status || "Активный"}</b></span>
            <span data-label="Визитов">{client.visitsCount}</span>
            <span data-label="Пакеты">
              {client.packagesCount} / {client.packagesLeft}
            </span>
            <span data-label="Сумма">{formatMoney(client.totalIncome)}</span>
            <span data-label="Последний визит">{client.lastVisit}</span>
            <span data-label="Не был">
              {client.daysAbsent === null ? "Новый" : `${client.daysAbsent} дн.`}
            </span>
            <span data-label="Заметка">{client.note || "—"}</span>

            <div
              className="row-actions client-row-actions"
              onClick={(event) => event.stopPropagation()}>
              <button
                className="row-action"
                aria-label="Действия"
                onClick={() =>
                  setOpenClientMenuId(
                    openClientMenuId === client.id ? null : client.id,
                  )
                }>
                <MoreVertical size={18} />
              </button>

              {openClientMenuId === client.id && (
                <div className="row-action-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setViewedClient(client);
                      setOpenClientMenuId(null);
                    }}>
                    <Eye size={15} />
                    Посмотреть
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onMessageClient(client);
                    }}>
                    <MessageSquareText size={15} />
                    Написать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onEditClient(client);
                    }}>
                    <Pencil size={15} />
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onDeleteClient(client);
                    }}>
                    <Trash2 size={15} />
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="clients-empty">
            <strong>Клиенты не найдены</strong>
            <span>Попробуйте изменить запрос или очистить поиск.</span>
          </div>
        )}
      </div>
      {viewedClient && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setViewedClient(null)}>
          <section
            aria-labelledby="client-card-title"
            aria-modal="true"
            className="employee-modal client-details-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span>Карточка клиента</span>
                <h2 id="client-card-title">{viewedClient.name}</h2>
              </div>
              <button
                aria-label="Закрыть карточку"
                className="modal-close"
                type="button"
                onClick={() => setViewedClient(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="client-details-grid">
              <span>
                Телефон <strong>{viewedClient.phone || "—"}</strong>
              </span>
              <span>
                Email <strong>{viewedClient.email || "—"}</strong>
              </span>
              <span>
                Instagram <strong>{viewedClient.instagram || "—"}</strong>
              </span>
              <span>
                Telegram <strong>{viewedClient.telegram || "—"}</strong>
              </span>
              <span>
                Дата рождения <strong>{viewedClient.birthday || "—"}</strong>
              </span>
              <span>
                Источник <strong>{viewedClient.source || "—"}</strong>
              </span>
              <span>
                Визитов <strong>{viewedClient.visitsCount}</strong>
              </span>
              <span>
                Последний визит <strong>{viewedClient.lastVisit}</strong>
              </span>
              <span>
                Не был{" "}
                <strong>
                  {viewedClient.daysAbsent === null
                    ? "Еще не приходил"
                    : `${viewedClient.daysAbsent} дн.`}
                </strong>
              </span>
              <span>
                Пакетов <strong>{viewedClient.packagesCount}</strong>
              </span>
              <span>
                Остаток сеансов <strong>{viewedClient.packagesLeft}</strong>
              </span>
              <span>
                Общая сумма <strong>{formatMoney(viewedClient.totalIncome)}</strong>
              </span>
              <span>
                Предпочтения <strong>{viewedClient.preference || "—"}</strong>
              </span>
              <span>
                Статус <strong>{viewedClient.status || "Активный"}</strong>
              </span>
              <span>
                Теги <strong>{viewedClient.tags || "—"}</strong>
              </span>
            </div>
            {viewedClient.birthday && (
              <div className="client-birthday-note">
                <CakeSlice size={15} />
                Дата рождения участвует в уведомлениях CRM.
              </div>
            )}
            <div className="client-details-note">
              <span>Заметка</span>
              <p>{viewedClient.note || "Заметок пока нет."}</p>
            </div>
            <div className="client-communications">
              <span>Последние сообщения</span>
              {viewedClientCommunications.map((entry) => (
                <article key={entry.id}>
                  <div>
                    <strong>{entry.channel}</strong>
                    <small>
                      {new Date(entry.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <p>{entry.templateName}</p>
                </article>
              ))}
              {viewedClientCommunications.length === 0 && (
                <p className="client-communications-empty">Сообщений пока не отправляли.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default ClientsPage;
