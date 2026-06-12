import {RefreshCw, Send} from "lucide-react";
import {
  BOOKSY_SYNC_STATUSES,
  canEnqueueBooksySync,
  canRetryBooksySync,
  getBooksySyncStatus,
  getBooksySyncStatusLabel,
} from "../utils/booksyOutbound/booksySyncStatus.js";
import {toDisplayDate} from "../utils/formatters.jsx";

function BooksyOutboundSyncPanel({
  entry,
  isSubmitting = false,
  onEnqueue,
  onRetry,
}) {
  if (!entry || entry.kind !== "visit") {
    return null;
  }

  const status = getBooksySyncStatus(entry);
  const statusClass = `booksy-outbound-status booksy-outbound-status-${status}`;

  return (
    <section className="booksy-outbound-panel">
      <div className="booksy-outbound-panel-header">
        <strong>Booksy</strong>
        <span className={statusClass}>{getBooksySyncStatusLabel(entry)}</span>
      </div>

      <p className="booksy-outbound-panel-copy">
        CRM создаёт задачу в Supabase. Отдельный worker на Node.js + Playwright заберёт её
        и попробует создать визит в Booksy.
      </p>

      <dl className="booksy-outbound-meta">
        {entry.booksySyncedAt && (
          <div>
            <dt>Синхронизировано</dt>
            <dd>{new Date(entry.booksySyncedAt).toLocaleString("ru-RU")}</dd>
          </div>
        )}
        {entry.booksyLastAttemptAt && (
          <div>
            <dt>Последняя попытка</dt>
            <dd>{new Date(entry.booksyLastAttemptAt).toLocaleString("ru-RU")}</dd>
          </div>
        )}
        {entry.booksyExternalId && (
          <div>
            <dt>ID Booksy</dt>
            <dd>{entry.booksyExternalId}</dd>
          </div>
        )}
        {entry.date && entry.time && (
          <div>
            <dt>Отправка</dt>
            <dd>
              {toDisplayDate(entry.date)} · {entry.time} · {entry.master}
            </dd>
          </div>
        )}
      </dl>

      {entry.booksySyncError && status === BOOKSY_SYNC_STATUSES.FAILED && (
        <p className="booksy-outbound-error">{entry.booksySyncError}</p>
      )}

      <div className="booksy-outbound-actions">
        {canEnqueueBooksySync(entry) && (
          <button
            className="secondary-button"
            disabled={isSubmitting}
            type="button"
            onClick={() => onEnqueue?.(entry)}>
            <Send size={15} />
            {isSubmitting ? "Отправка..." : "Отправить в Booksy"}
          </button>
        )}

        {canRetryBooksySync(entry) && (
          <button
            className="secondary-button"
            disabled={isSubmitting}
            type="button"
            onClick={() => onRetry?.(entry)}>
            <RefreshCw className={isSubmitting ? "spin" : ""} size={15} />
            Повторить
          </button>
        )}

        {status === BOOKSY_SYNC_STATUSES.PENDING && (
          <small className="booksy-outbound-hint">
            Задача в очереди. Запустите worker: <code>npm run booksy-worker</code>
          </small>
        )}

        {status === BOOKSY_SYNC_STATUSES.SYNCED && (
          <small className="booksy-outbound-hint">Визит уже отправлен в Booksy.</small>
        )}
      </div>
    </section>
  );
}

export default BooksyOutboundSyncPanel;
