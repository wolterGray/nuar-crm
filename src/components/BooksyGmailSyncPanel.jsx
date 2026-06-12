import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Link2,
  MailCheck,
  RefreshCw,
  Unplug,
  X,
} from "lucide-react";
import {useState} from "react";
import {formatMoney} from "../utils/formatters.jsx";

const missingFieldLabels = {
  client_name: "имя клиента",
  appointment_date: "дата",
  start_time: "время",
  staff_name: "мастер",
  service_name: "услуга",
};

function BooksyGmailSyncPanel({
  calendarEntries,
  connection,
  isConfigured,
  isGmailConnected,
  isLoading,
  isSyncing,
  loadError,
  onApplyDecision,
  onConnect,
  onDisconnect,
  onRefresh,
  onSync,
  parseErrors,
  pendingEvents,
  reviewKindLabel,
  summary,
  useServerSync,
}) {
  const [linkTargetByEvent, setLinkTargetByEvent] = useState({});

  if (!isConfigured) {
    return (
      <section className="panel import-setup import-setup-warning">
        <MailCheck size={20} />
        <div>
          <h2>Booksy Gmail Sync</h2>
          <p>
            Для серверной синхронизации нужны переменные Supabase и Edge Functions.
          </p>
        </div>
      </section>
    );
  }

  const isConnected = Boolean(connection?.is_connected || isGmailConnected);
  const connectionLabel = isConnected
    ? `Gmail подключён${connection?.google_email ? `: ${connection.google_email}` : ""}`
    : "Gmail не подключён";

  return (
    <section className="booksy-gmail-sync">
      <section className="panel import-setup">
        <MailCheck size={20} />
        <div>
          <h2>{connectionLabel}</h2>
          <p>
            {isConnected
              ? "Доступ к Gmail активен. Нажмите «Синхронизировать сейчас», чтобы проверить письма Booksy."
              : "Нажмите «Подключить Gmail», войдите в Google и разрешите чтение почты."}
          </p>
          {connection?.last_sync_at && (
            <small>
              Последняя синхронизация:{" "}
              {new Date(connection.last_sync_at).toLocaleString("ru-RU")}
            </small>
          )}
          {connection?.last_sync_error && (
            <b className="booksy-sync-error">{connection.last_sync_error}</b>
          )}
          {loadError && <b className="booksy-sync-error">{loadError}</b>}
        </div>
        <div className="import-setup-actions">
          {isConnected ? (
            <>
              <button
                className="add-visit-button"
                disabled={isSyncing}
                type="button"
                onClick={onSync}>
                <RefreshCw className={isSyncing ? "spin" : ""} size={15} />
                {isSyncing ? "Синхронизация" : "Синхронизировать сейчас"}
              </button>
              <button className="secondary-button" type="button" onClick={onRefresh}>
                Обновить список
              </button>
              {useServerSync ? (
                <button className="secondary-button" type="button" onClick={onDisconnect}>
                  <Unplug size={15} />
                  Отключить
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={onConnect}>
                  <MailCheck size={15} />
                  Обновить доступ
                </button>
              )}
            </>
          ) : (
            <button className="add-visit-button" type="button" onClick={onConnect}>
              <MailCheck size={15} />
              Подключить Gmail
            </button>
          )}
        </div>
      </section>

      <div className="import-summary">
        <span>
          <CalendarPlus size={15} />
          <small>Новые</small>
          <strong>{summary.newVisits}</strong>
        </span>
        <span>
          <Link2 size={15} />
          <small>Дубликаты</small>
          <strong>{summary.duplicates}</strong>
        </span>
        <span>
          <RefreshCw size={15} />
          <small>Изменения</small>
          <strong>{summary.updates}</strong>
        </span>
        <span>
          <X size={15} />
          <small>Отмены</small>
          <strong>{summary.cancellations}</strong>
        </span>
        <span>
          <AlertTriangle size={15} />
          <small>Проверка</small>
          <strong>{summary.needsReview}</strong>
        </span>
        <span>
          <AlertTriangle size={15} />
          <small>Ошибки парсинга</small>
          <strong>{summary.parseErrors}</strong>
        </span>
      </div>

      <div className="import-grid">
        <section className="panel import-panel">
          <div className="operations-panel-header">
            <div>
              <CalendarPlus size={18} />
              <div>
                <h2>Импорт из Booksy Gmail</h2>
                <p>{pendingEvents.length} событий ждут решения</p>
              </div>
            </div>
          </div>

          <div className="import-list">
            {isLoading && (
              <p className="operations-empty">Загружаем события Booksy Gmail…</p>
            )}

            {!isLoading &&
              pendingEvents.map((event) => {
                const missingText = (event.missing_fields ?? [])
                  .map((field) => missingFieldLabels[field] || field)
                  .join(", ");
                const recommendedMatch = event.sync_match_candidates?.find(
                  (item) => item.is_recommended,
                );

                return (
                  <article className="import-row booksy-sync-row" key={event.id}>
                    <span className={`import-kind import-kind-${event.review_kind}`}>
                      <CalendarPlus size={15} />
                    </span>
                    <span className="booksy-sync-row-body">
                      <strong>{reviewKindLabel(event.review_kind)}</strong>
                      <small>
                        {event.client_name || "Клиент не распознан"} ·{" "}
                        {event.appointment_date || "дата?"} {event.start_time || "время?"}
                      </small>
                      <em>
                        {event.service_name || "услуга?"} ·{" "}
                        {event.staff_name || "мастер?"}
                        {event.price ? ` · ${formatMoney(event.price)}` : ""}
                      </em>
                      {event.client_note && <i>{event.client_note}</i>}
                      {missingText && (
                        <b>
                          Найден визит из Booksy, но не хватает данных ({missingText}).
                          Внести его в график?
                        </b>
                      )}
                      {recommendedMatch && (
                        <small>
                          Совпадение {recommendedMatch.match_score}% · визит{" "}
                          {recommendedMatch.calendar_entry_id}
                        </small>
                      )}
                      <div className="booksy-sync-actions">
                        <button
                          className="add-visit-button"
                          type="button"
                          onClick={() => onApplyDecision(event, "create")}>
                          <Check size={14} />
                          Внести в график
                        </button>
                        {recommendedMatch && (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => onApplyDecision(event, "update")}>
                            Обновить существующий
                          </button>
                        )}
                        {event.review_kind === "visit_cancel" && (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => onApplyDecision(event, "cancel")}>
                            Отметить как отменённый
                          </button>
                        )}
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => onApplyDecision(event, "ignore")}>
                          Игнорировать
                        </button>
                        <select
                          value={linkTargetByEvent[event.id] ?? ""}
                          onChange={(changeEvent) =>
                            setLinkTargetByEvent((current) => ({
                              ...current,
                              [event.id]: changeEvent.target.value,
                            }))
                          }>
                          <option value="">Связать с визитом вручную</option>
                          {calendarEntries
                            .filter((entry) => entry.kind === "visit")
                            .slice(0, 50)
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.date} {entry.time} · {entry.client}
                              </option>
                            ))}
                        </select>
                        <button
                          className="secondary-button"
                          disabled={!linkTargetByEvent[event.id]}
                          type="button"
                          onClick={() =>
                            onApplyDecision(
                              event,
                              "link",
                              linkTargetByEvent[event.id],
                            )
                          }>
                          <Link2 size={14} />
                          Связать
                        </button>
                      </div>
                    </span>
                  </article>
                );
              })}

            {!isLoading && pendingEvents.length === 0 && (
              <p className="operations-empty">
                {isConnected
                  ? "Нажмите «Синхронизировать сейчас», чтобы проверить письма Booksy."
                  : "Подключите Gmail, чтобы начать импорт визитов."}
              </p>
            )}
          </div>
        </section>

        <section className="panel import-panel">
          <div className="operations-panel-header">
            <div>
              <AlertTriangle size={18} />
              <div>
                <h2>Ошибки парсинга</h2>
                <p>{parseErrors.length} писем</p>
              </div>
            </div>
          </div>
          <div className="import-list">
            {parseErrors.map((item) => (
              <article className="import-document-row" key={item.id}>
                <span>
                  <strong>{item.subject || "Без темы"}</strong>
                  <small>{item.from_address}</small>
                  <em>{item.parse_error}</em>
                </span>
              </article>
            ))}
            {parseErrors.length === 0 && (
              <p className="operations-empty">Ошибок парсинга пока нет.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default BooksyGmailSyncPanel;
