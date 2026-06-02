import {
  CalendarPlus,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileText,
  MailCheck,
  RefreshCw,
  Settings,
  UserPlus,
} from "lucide-react";
import {useState} from "react";
import {parseImportedEmail} from "../../utils/emailImport.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {syncGmailMessages} from "../../utils/gmail.js";
import {PageNotificationsSlot} from "../PageNotifications.jsx";

const typeLabels = {
  "booksy-booking": "Новая запись",
  "booksy-reschedule": "Перенос записи",
  "booksy-confirmation": "Подтверждение",
  document: "Документ",
};

const isReadyToImport = (item) =>
  item.type === "document" ||
  Boolean(
    item.client.name &&
    item.booking.date &&
    item.booking.time &&
    item.booking.master &&
    item.booking.service,
  );

function ImportPage({
  documents,
  employees,
  gmailAccessToken,
  gmailClientId,
  importedMailIds,
  onApply,
  onNotify,
  onOpenSettings,
  services,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const gmailConnected = Boolean(gmailAccessToken || gmailClientId);
  const documentsTotal = documents.reduce(
    (total, document) => total + (Number(document.amount) || 0),
    0,
  );
  const documentSources = new Set(documents.map((document) => document.source))
    .size;

  const synchronize = async () => {
    setIsLoading(true);

    try {
      const emails = await syncGmailMessages(gmailClientId, gmailAccessToken);
      const parsedItems = emails
        .filter((email) => !importedMailIds.includes(email.id))
        .map((email) => parseImportedEmail(email, services, employees))
        .filter(Boolean);

      setPendingItems(parsedItems);
      setSelectedIds(
        parsedItems.filter(isReadyToImport).map((item) => item.id),
      );
      onNotify({
        title: "Gmail проверен",
        message: parsedItems.length
          ? `Найдено новых событий: ${parsedItems.length}`
          : "Новых записей и документов нет",
        persist: false,
      });
    } catch (error) {
      onNotify({
        title: "Не удалось подключить Gmail",
        message: error.message,
        persist: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applySelected = () => {
    const selectedItems = pendingItems.filter((item) =>
      selectedIds.includes(item.id),
    );
    onApply(selectedItems);
    setPendingItems((current) =>
      current.filter((item) => !selectedIds.includes(item.id)),
    );
    setSelectedIds([]);
  };

  return (
    <section className="import-page">
      <div className="employees-toolbar">
        <div className="title-notifications-flex">
          <div>
            <h2>Импорт из Gmail</h2>
            <p>
              Записи Booksy и документы расходов с предварительной проверкой
            </p>
          </div>
          <PageNotificationsSlot />
        </div>
        <div className="import-toolbar-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onOpenSettings}>
            <Settings size={15} />
            Gmail
          </button>
          <button
            className="add-visit-button"
            disabled={isLoading || !gmailConnected}
            type="button"
            onClick={synchronize}>
            <RefreshCw className={isLoading ? "spin" : ""} size={16} />
            {isLoading ? "Проверяем" : "Синхронизировать"}
          </button>
        </div>
      </div>

      {!gmailConnected && (
        <section className="panel import-setup">
          <MailCheck size={20} />
          <div>
            <h2>Подключите Gmail</h2>
            <p>
              Войдите в CRM через Google или добавьте OAuth Client ID в
              настройках интеграции.
            </p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={onOpenSettings}>
            Открыть настройки
          </button>
        </section>
      )}

      <div className="import-summary">
        <span>
          <FileText size={15} />
          <small>Документы</small>
          <strong>{documents.length}</strong>
        </span>
        <span>
          <CircleDollarSign size={15} />
          <small>Распознано расходов</small>
          <strong>{formatMoney(documentsTotal)}</strong>
        </span>
        <span>
          <MailCheck size={15} />
          <small>Источники</small>
          <strong>{documentSources}</strong>
        </span>
      </div>

      <div className="import-grid">
        <section className="panel import-panel">
          <div className="operations-panel-header">
            <div>
              <CalendarPlus size={18} />
              <div>
                <h2>Найдено в почте</h2>
                <p>{pendingItems.length} новых событий</p>
              </div>
            </div>
            {selectedIds.length > 0 && (
              <button
                className="add-visit-button"
                type="button"
                onClick={applySelected}>
                <Check size={15} />
                Применить {selectedIds.length}
              </button>
            )}
          </div>
          <div className="import-list">
            {pendingItems.map((item) => (
              <label className="import-row" key={item.id}>
                <input
                  checked={selectedIds.includes(item.id)}
                  disabled={!isReadyToImport(item)}
                  type="checkbox"
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                />
                <span className={`import-kind import-kind-${item.type}`}>
                  {item.type === "document" ? (
                    <FileText size={15} />
                  ) : (
                    <UserPlus size={15} />
                  )}
                </span>
                <span>
                  <strong>{typeLabels[item.type]}</strong>
                  <small>
                    {item.type === "document"
                      ? `${item.source} · ${item.attachments.map((file) => file.filename).join(", ") || item.subject}`
                      : `${item.client.name || "Клиент не распознан"} · ${item.booking.date || "дата?"} ${item.booking.time || "время?"}`}
                  </small>
                  {item.type !== "document" && (
                    <em>
                      {item.booking.service || "Проверьте услугу"} ·{" "}
                      {item.booking.master || "проверьте мастера"}
                    </em>
                  )}
                  {!isReadyToImport(item) && (
                    <b>Нужно проверить письмо вручную</b>
                  )}
                </span>
              </label>
            ))}
            {pendingItems.length === 0 && (
              <p className="operations-empty">
                Нажмите «Синхронизировать», чтобы проверить новые письма.
              </p>
            )}
          </div>
        </section>

        <section className="panel import-panel">
          <div className="operations-panel-header">
            <div>
              <FileText size={18} />
              <div>
                <h2>Документы расходов</h2>
                <p>{documents.length} сохранено</p>
              </div>
            </div>
          </div>
          <div className="import-list">
            {documents.map((document) => (
              <article className="import-document-row" key={document.id}>
                <span>
                  <strong>{document.source}</strong>
                  <small>
                    {document.attachments
                      .map((file) => file.filename)
                      .join(", ") || document.subject}
                  </small>
                  {document.amount > 0 && (
                    <em>{formatMoney(document.amount)}</em>
                  )}
                </span>
                <a
                  href={document.gmailUrl}
                  rel="noreferrer"
                  target="_blank"
                  title="Открыть письмо Gmail">
                  <ExternalLink size={15} />
                </a>
              </article>
            ))}
            {documents.length === 0 && (
              <p className="operations-empty">
                Фактуры Allegro, Booksy и iPOS появятся здесь после импорта.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default ImportPage;
