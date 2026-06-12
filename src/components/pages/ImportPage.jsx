import {CircleDollarSign, ExternalLink, FileText, MailCheck} from "lucide-react";
import BooksyGmailSyncPanel from "../BooksyGmailSyncPanel.jsx";
import {formatMoney} from "../../utils/formatters.jsx";
import PageHeader from "../PageHeader.jsx";

function ImportPage({booksyGmailSync, calendarEntries, documents}) {
  const documentsTotal = documents.reduce(
    (total, document) => total + (Number(document.amount) || 0),
    0,
  );
  const documentSources = new Set(documents.map((document) => document.source))
    .size;

  return (
    <section className="import-page">
      <PageHeader
        description="Импорт визитов Booksy и фактур Allegro, Booksy, iPOS из Gmail"
        title="Импорт из Gmail"
      />

      {booksyGmailSync && (
        <BooksyGmailSyncPanel
          calendarEntries={calendarEntries}
          connection={booksyGmailSync.connection}
          isConfigured={booksyGmailSync.isConfigured}
          isGmailConnected={booksyGmailSync.isGmailConnected}
          isLoading={booksyGmailSync.isLoading}
          isSyncing={booksyGmailSync.isSyncing}
          loadError={booksyGmailSync.loadError}
          parseErrors={booksyGmailSync.parseErrors}
          pendingEvents={booksyGmailSync.pendingEvents}
          reviewKindLabel={booksyGmailSync.reviewKindLabel}
          summary={booksyGmailSync.summary}
          useServerSync={booksyGmailSync.useServerSync}
          onApplyDecision={booksyGmailSync.applyDecision}
          onConnect={booksyGmailSync.connectGmail}
          onDisconnect={booksyGmailSync.disconnectGmail}
          onRefresh={booksyGmailSync.refreshDashboard}
          onSync={booksyGmailSync.syncNow}
        />
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
                {document.amount > 0 && <em>{formatMoney(document.amount)}</em>}
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
              Импортированные фактуры Allegro, Booksy и iPOS появятся здесь.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

export default ImportPage;
