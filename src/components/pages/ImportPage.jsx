import {
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Mail,
  MailCheck,
} from "lucide-react";
import {useMemo} from "react";
import BooksyGmailSyncPanel from "../BooksyGmailSyncPanel.jsx";
import {
  getImportDocumentMetaRows,
  getImportDocumentSourceLabel,
  getImportDocumentTitle,
  sortImportDocuments,
} from "../../utils/booksySync/importDocumentDisplay.js";
import {formatMoney} from "../../utils/formatters.jsx";
import PageHeader from "../PageHeader.jsx";

function ImportDocumentCard({document}) {
  const title = getImportDocumentTitle(document);
  const sourceLabel = getImportDocumentSourceLabel(document);
  const metaRows = getImportDocumentMetaRows(document);

  return (
    <article className="import-document-card">
      <div className="import-document-card-header">
        <span className="import-kind import-kind-document">
          <FileText size={15} />
        </span>
        <div className="import-document-card-heading">
          <strong>{title}</strong>
          <small>{sourceLabel}</small>
        </div>
        <a
          className="import-document-card-link"
          href={document.gmailUrl}
          rel="noreferrer"
          target="_blank"
          title="Открыть письмо в Gmail">
          <ExternalLink size={15} />
        </a>
      </div>

      {document.subject && document.subject !== title && (
        <p className="import-document-card-subject">{document.subject}</p>
      )}

      {(document.summary || document.description) && (
        <p className="import-document-card-summary">
          {document.summary || document.description}
        </p>
      )}

      <dl className="import-document-meta">
        {metaRows.map((row) => (
          <div className="import-document-meta-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.highlight ? "is-highlight" : ""}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ImportPage({booksyGmailSync, calendarEntries, documents}) {
  const sortedDocuments = useMemo(() => sortImportDocuments(documents), [documents]);
  const documentsTotal = sortedDocuments.reduce(
    (total, document) => total + (Number(document.amount) || 0),
    0,
  );
  const documentsWithAmount = sortedDocuments.filter(
    (document) => Number(document.amount) > 0,
  ).length;
  const documentSources = new Set(sortedDocuments.map((document) => document.source)).size;

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

      <div className="import-summary import-summary-documents">
        <span>
          <FileText size={15} />
          <small>Документы</small>
          <strong>{sortedDocuments.length}</strong>
        </span>
        <span>
          <CircleDollarSign size={15} />
          <small>С суммой в письме</small>
          <strong>{documentsWithAmount}</strong>
        </span>
        <span>
          <CalendarDays size={15} />
          <small>Распознано расходов</small>
          <strong>{formatMoney(documentsTotal)}</strong>
        </span>
        <span>
          <MailCheck size={15} />
          <small>Источники</small>
          <strong>{documentSources}</strong>
        </span>
      </div>

      <section className="panel import-panel import-documents-panel">
        <div className="operations-panel-header">
          <div>
            <Mail size={18} />
            <div>
              <h2>Документы расходов</h2>
              <p>
                {sortedDocuments.length} сохранено · сортировка по дате фактуры, новые сверху
              </p>
            </div>
          </div>
        </div>
        <div className="import-document-grid">
          {sortedDocuments.map((document) => (
            <ImportDocumentCard document={document} key={document.id} />
          ))}
          {sortedDocuments.length === 0 && (
            <p className="operations-empty">
              Импортированные фактуры Allegro, Booksy, iPOS и другие появятся здесь с датой,
              номером, отправителем и вложениями.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

export default ImportPage;
