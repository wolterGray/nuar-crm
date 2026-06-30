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
import Button from "./ui/Button.jsx";
import Select from "./ui/Select.jsx";

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
      <section className="crm-card import-sync-panel import-sync-panel-error border border-red-500/20 bg-red-500/5 rounded-card p-4 flex items-center gap-3.5">
        <MailCheck className="text-red-400 shrink-0" size={20} />
        <div className="grid gap-0.5">
          <h2 className="m-0 text-red-200 text-sm font-semibold">Booksy Gmail Sync</h2>
          <p className="m-0 text-red-300 text-xs">
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
    <section className="import-sync-section flex flex-col gap-5 w-full">
      <section className="crm-card import-sync-panel border border-border bg-surface rounded-card p-4 md:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="import-sync-icon flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5">
            <MailCheck size={20} />
          </span>
          <div className="grid gap-0.5 min-w-0">
            <h2 className="m-0 text-text-main text-base font-semibold leading-snug">{connectionLabel}</h2>
            <p className="m-0 text-text-muted text-xs leading-relaxed max-w-xl">
              {isConnected
                ? "Доступ к Gmail активен. Синхронизация подтягивает визиты Booksy и фактуры с PDF."
                : "Нажмите «Подключить Gmail», войдите в Google и разрешите чтение почты."}
            </p>
            {connection?.last_sync_at && (
              <small className="text-text-faint text-[10px] mt-1 block">
                Последняя синхронизация:{" "}
                {new Date(connection.last_sync_at).toLocaleString("ru-RU")}
              </small>
            )}
            {connection?.last_sync_error && (
              <b className="text-red-400 text-[11px] font-semibold mt-1 block">{connection.last_sync_error}</b>
            )}
            {loadError && <b className="text-red-400 text-[11px] font-semibold mt-1 block">{loadError}</b>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isConnected ? (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={isSyncing}
                onClick={onSync}>
                <RefreshCw className={isSyncing ? "animate-spin" : ""} size={15} />
                {isSyncing ? "Синхронизация" : "Синхронизировать сейчас"}
              </Button>
              <Button variant="secondary" size="sm" onClick={onRefresh}>
                Обновить список
              </Button>
              {useServerSync ? (
                <Button variant="secondary" size="sm" onClick={onDisconnect}>
                  <Unplug size={15} />
                  Отключить
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={onConnect}>
                  <MailCheck size={15} />
                  Обновить доступ
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={onConnect}>
              <MailCheck size={15} />
              Подключить Gmail
            </Button>
          )}
        </div>
      </section>

      {/* Sync Status Cards */}
      <div className="import-sync-summary grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          {icon: <CalendarPlus size={15} />, label: "Новые", value: summary.newVisits},
          {icon: <Link2 size={15} />, label: "Дубликаты", value: summary.duplicates},
          {icon: <RefreshCw size={15} />, label: "Изменения", value: summary.updates},
          {icon: <X size={15} />, label: "Отмены", value: summary.cancellations},
          {icon: <AlertTriangle size={15} />, label: "Проверка", value: summary.needsReview},
          {icon: <AlertTriangle size={15} />, label: "Ошибки", value: summary.parseErrors},
        ].map((item, idx) => (
          <div key={idx} className="import-sync-summary-card flex flex-col gap-1 p-3 rounded-card border border-border bg-surface shadow-xs">
            <span className="flex items-center gap-1.5 text-accent">
              {item.icon}
              <small className="text-text-muted text-[10px] font-bold tracking-wider uppercase">{item.label}</small>
            </span>
            <strong className="text-lg font-bold text-text-main mt-0.5">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="import-sync-columns grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Events */}
        <section className="crm-card import-sync-list-panel border border-border bg-surface rounded-card shadow-sm flex flex-col">
          <div className="p-4 md:p-5 border-b border-border-soft flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-text-muted">
                <CalendarPlus size={18} />
              </span>
              <div className="grid gap-0.5">
                <h2 className="m-0 text-text-main text-base font-semibold">Импорт из Booksy Gmail</h2>
                <p className="m-0 text-text-muted text-xs">{pendingEvents.length} событий ждут решения</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 flex flex-col gap-3 max-h-[480px] overflow-y-auto">
            {isLoading && (
              <p className="text-center py-8 text-text-muted text-sm m-0">Загружаем события Booksy Gmail…</p>
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
                  <article className="import-sync-event-card p-3.5 border border-border rounded-lg bg-field flex flex-col gap-3 min-w-0 transition-colors" key={event.id}>
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-7.5 h-7.5 rounded-lg bg-accent/10 text-accent shrink-0">
                        <CalendarPlus size={14} />
                      </span>
                      <div className="grid gap-1 min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <strong className="text-text-main text-sm font-semibold truncate">
                            {reviewKindLabel(event.review_kind)}
                          </strong>
                          <span className="text-text-faint text-[10px]">
                            {event.appointment_date || "дата?"} {event.start_time || "время?"}
                          </span>
                        </div>
                        <small className="text-text-muted text-xs block font-medium">
                          {event.client_name || "Клиент не распознан"}
                        </small>
                        <em className="text-text-muted text-xs not-italic opacity-85 block leading-normal">
                          {event.service_name || "услуга?"} · {event.staff_name || "мастер?"}
                          {event.price ? ` · ${formatMoney(event.price)}` : ""}
                        </em>
                        {event.client_note && (
                          <i className="text-text-faint text-[11px] block mt-1 leading-relaxed border-l-2 border-border/60 pl-2">
                            {event.client_note}
                          </i>
                        )}
                        {missingText && (
                          <span className="text-red-400 text-[11px] font-semibold mt-1 block leading-normal">
                            Найден визит из Booksy, но не хватает данных ({missingText}). Внести его в график?
                          </span>
                        )}
                        {recommendedMatch && (
                          <span className="text-accent text-[11px] font-medium mt-1 block">
                            Совпадение {recommendedMatch.match_score}% · визит {recommendedMatch.calendar_entry_id}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-soft/60">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onApplyDecision(event, "create")}>
                        <Check size={14} />
                        Внести в график
                      </Button>
                      {recommendedMatch && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onApplyDecision(event, "update")}>
                          Обновить
                        </Button>
                      )}
                      {event.review_kind === "visit_cancel" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onApplyDecision(event, "cancel")}>
                          Отменить визит
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onApplyDecision(event, "ignore")}>
                        Игнорировать
                      </Button>

                      <div className="flex items-center gap-1.5 w-full mt-1.5">
                        <Select
                          value={linkTargetByEvent[event.id] ?? ""}
                          className="h-8.5 text-xs py-1"
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
                        </Select>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8.5"
                          disabled={!linkTargetByEvent[event.id]}
                          onClick={() =>
                            onApplyDecision(
                              event,
                              "link",
                              linkTargetByEvent[event.id],
                            )
                          }>
                          <Link2 size={14} />
                          Связать
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}

            {!isLoading && pendingEvents.length === 0 && (
              <p className="text-center py-8 text-text-muted text-sm m-0">
                {isConnected
                  ? "Нажмите «Синхронизировать сейчас», чтобы проверить письма Booksy."
                  : "Подключите Gmail, чтобы начать импорт визитов."}
              </p>
            )}
          </div>
        </section>

        {/* Parse Errors */}
        <section className="crm-card import-sync-list-panel border border-border bg-surface rounded-card shadow-sm flex flex-col">
          <div className="p-4 md:p-5 border-b border-border-soft flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-text-muted">
                <AlertTriangle size={18} />
              </span>
              <div className="grid gap-0.5">
                <h2 className="m-0 text-text-main text-base font-semibold">Ошибки парсинга</h2>
                <p className="m-0 text-text-muted text-xs">{parseErrors.length} писем</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 flex flex-col gap-3 max-h-[480px] overflow-y-auto">
            {parseErrors.map((item) => (
              <article className="import-sync-error-card p-3.5 border border-border rounded-lg bg-field flex flex-col gap-1 min-w-0" key={item.id}>
                <strong className="text-text-main text-sm font-semibold truncate block">{item.subject || "Без темы"}</strong>
                <span className="text-text-muted text-xs block">{item.from_address}</span>
                <span className="text-red-400 text-xs font-medium block mt-1 leading-relaxed">{item.parse_error}</span>
              </article>
            ))}
            {parseErrors.length === 0 && (
              <p className="text-center py-8 text-text-muted text-sm m-0">Ошибок парсинга пока нет.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default BooksyGmailSyncPanel;
