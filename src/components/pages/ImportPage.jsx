import {
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Mail,
  MailCheck,
  Search,
  X,
} from "lucide-react";
import {useMemo, useState} from "react";
import BooksyGmailSyncPanel from "../BooksyGmailSyncPanel.jsx";
import {
  DEFAULT_IMPORT_DOCUMENT_FILTERS,
  filterImportDocuments,
  getImportDocumentMetaRows,
  getImportDocumentSourceLabel,
  getImportDocumentSourceOptions,
  getImportDocumentTitle,
  hasActiveImportDocumentFilters,
  IMPORT_DOCUMENT_AMOUNT_FILTERS,
  IMPORT_DOCUMENT_PERIOD_FILTERS,
  summarizeImportDocuments,
} from "../../utils/booksySync/importDocumentDisplay.js";
import {formatMoney} from "../../utils/formatters.jsx";
import PageHeader from "../PageHeader.jsx";

const amountFilterOptions = [
  {value: IMPORT_DOCUMENT_AMOUNT_FILTERS.all, label: "Все"},
  {value: IMPORT_DOCUMENT_AMOUNT_FILTERS.withAmount, label: "С суммой"},
  {
    value: IMPORT_DOCUMENT_AMOUNT_FILTERS.withoutAmount,
    label: "Без суммы",
  },
];

const periodFilterOptions = [
  {value: IMPORT_DOCUMENT_PERIOD_FILTERS.all, label: "Все"},
  {value: IMPORT_DOCUMENT_PERIOD_FILTERS.month, label: "Месяц"},
  {value: IMPORT_DOCUMENT_PERIOD_FILTERS.quarter, label: "3 мес"},
  {value: IMPORT_DOCUMENT_PERIOD_FILTERS.year, label: "Год"},
];

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
  const [filters, setFilters] = useState(DEFAULT_IMPORT_DOCUMENT_FILTERS);
  const sourceOptions = useMemo(
    () => getImportDocumentSourceOptions(documents),
    [documents],
  );
  const filteredDocuments = useMemo(
    () => filterImportDocuments(documents, filters),
    [documents, filters],
  );
  const totalSummary = useMemo(() => summarizeImportDocuments(documents), [documents]);
  const visibleSummary = useMemo(
    () => summarizeImportDocuments(filteredDocuments),
    [filteredDocuments],
  );
  const filtersActive = hasActiveImportDocumentFilters(filters);

  const updateFilter = (key, value) => {
    setFilters((current) => ({...current, [key]: value}));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_IMPORT_DOCUMENT_FILTERS);
  };

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
          <small>{filtersActive ? "Показано" : "Документы"}</small>
          <strong>
            {visibleSummary.total}
            {filtersActive ? ` / ${totalSummary.total}` : ""}
          </strong>
        </span>
        <span>
          <CircleDollarSign size={15} />
          <small>С суммой в письме</small>
          <strong>{visibleSummary.withAmount}</strong>
        </span>
        <span>
          <CalendarDays size={15} />
          <small>Распознано расходов</small>
          <strong>{formatMoney(visibleSummary.amountTotal)}</strong>
        </span>
        <span>
          <MailCheck size={15} />
          <small>Источники</small>
          <strong>{visibleSummary.sources}</strong>
        </span>
      </div>

      <section className="panel import-panel import-documents-panel">
        <div className="operations-panel-header">
          <div>
            <Mail size={18} />
            <div>
              <h2>Документы расходов</h2>
              <p>
                {filtersActive
                  ? `Показано ${visibleSummary.total} из ${totalSummary.total}`
                  : `${totalSummary.total} сохранено`}{" "}
                · сортировка по дате faktury, новые сверху
              </p>
            </div>
          </div>
        </div>

        <div className="import-document-toolbar">
          <label className="clients-search import-document-search">
            <Search size={16} />
            <input
              placeholder="Номер, тема, отправитель, PDF..."
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
            {filters.search && (
              <button
                aria-label="Очистить поиск"
                type="button"
                onClick={() => updateFilter("search", "")}>
                <X size={15} />
              </button>
            )}
          </label>

          <div className="import-document-filters">
            <div className="import-document-filter-group">
              <small>Источник</small>
              <div className="client-alert-filter-chips">
                <button
                  className={filters.source === "all" ? "active" : ""}
                  type="button"
                  onClick={() => updateFilter("source", "all")}>
                  Все · {totalSummary.total}
                </button>
                {sourceOptions.map((option) => (
                  <button
                    className={filters.source === option.value ? "active" : ""}
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter("source", option.value)}>
                    {option.label} · {option.count}
                  </button>
                ))}
              </div>
            </div>

            <div className="import-document-filter-group">
              <small>Сумма</small>
              <div className="client-alert-filter-chips">
                {amountFilterOptions.map((option) => (
                  <button
                    className={filters.amount === option.value ? "active" : ""}
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter("amount", option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="import-document-filter-group">
              <small>Период</small>
              <div className="client-alert-filter-chips">
                {periodFilterOptions.map((option) => (
                  <button
                    className={filters.period === option.value ? "active" : ""}
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter("period", option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtersActive && (
            <button
              className="secondary-button import-document-reset"
              type="button"
              onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>

        <div className="import-document-grid">
          {filteredDocuments.map((document) => (
            <ImportDocumentCard document={document} key={document.id} />
          ))}
          {filteredDocuments.length === 0 && (
            <p className="operations-empty">
              {filtersActive
                ? "По текущим фильтрам документов не найдено. Измените поиск или сбросьте фильтры."
                : "Импортированные faktury Allegro, Booksy, iPOS и другие появятся здесь с датой, номером, отправителем и вложениями."}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

export default ImportPage;
