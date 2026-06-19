import {
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Mail,
  MailCheck,
  Trash2,
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
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../PageHeader.jsx";
import SearchControl from "../ui/SearchControl.jsx";

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

function ImportDocumentCard({document, isMobile, onDelete}) {
  const title = getImportDocumentTitle(document);
  const sourceLabel = getImportDocumentSourceLabel(document);
  const metaRows = getImportDocumentMetaRows(document);

  const handleDelete = () => {
    if (!onDelete) {
      return;
    }

    if (
      !window.confirm(
        `Удалить документ «${title}» из CRM?\n\nПисьмо в Gmail останется. При следующей синхронизации его можно импортировать снова.`,
      )
    ) {
      return;
    }

    onDelete(document.id);
  };

  if (isMobile) {
    return (
      <article className="import-document-card import-document-mobile-card">
        <div className="import-document-mobile-head">
          <span className="import-kind import-kind-document">
            <FileText size={15} />
          </span>
          <div className="import-document-card-heading">
            <strong>{title}</strong>
            <small>{sourceLabel}</small>
          </div>
        </div>

        {document.subject && document.subject !== title ? (
          <p className="import-document-card-subject">{document.subject}</p>
        ) : null}

        {(document.summary || document.description) && (
          <p className="import-document-card-summary">
            {document.summary || document.description}
          </p>
        )}

        <dl className="import-document-meta import-document-meta-mobile">
          {metaRows.slice(0, 4).map((row) => (
            <div className="import-document-meta-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd className={row.highlight ? "is-highlight" : ""}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="import-document-mobile-actions">
          <a
            className="secondary-button"
            href={document.gmailUrl}
            rel="noreferrer"
            target="_blank">
            <ExternalLink size={15} />
            Gmail
          </a>
          <button
            className="danger-button"
            type="button"
            onClick={handleDelete}>
            <Trash2 size={15} />
            Удалить
          </button>
        </div>
      </article>
    );
  }

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
        <div className="import-document-card-actions">
          <a
            className="import-document-card-link"
            href={document.gmailUrl}
            rel="noreferrer"
            target="_blank"
            title="Открыть письмо в Gmail">
            <ExternalLink size={15} />
          </a>
          <button
            aria-label="Удалить документ"
            className="compact-icon-button danger import-document-delete"
            title="Удалить из CRM"
            type="button"
            onClick={handleDelete}>
            <Trash2 size={15} />
          </button>
        </div>
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

function ImportDocumentFilters({
  filters,
  sourceOptions,
  totalSummary,
  updateFilter,
}) {
  return (
    <div className="import-document-filters import-document-filters-mobile">
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
  );
}

function ImportPage({booksyGmailSync, calendarEntries, documents, onDeleteDocuments}) {
  const {isMobile} = useBreakpoint();
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

  const handleDeleteVisible = () => {
    if (!onDeleteDocuments || filteredDocuments.length === 0) {
      return;
    }

    const count = filteredDocuments.length;
    const message =
      count === 1
        ? `Удалить документ «${getImportDocumentTitle(filteredDocuments[0])}» из CRM?`
        : `Удалить ${count} документов из CRM?\n\nПисьма в Gmail останутся. При синхронизации их можно импортировать снова.`;

    if (!window.confirm(message)) {
      return;
    }

    onDeleteDocuments(filteredDocuments.map((document) => document.id));
  };

  const documentCards = filteredDocuments.map((document) => (
    <ImportDocumentCard
      document={document}
      isMobile={isMobile}
      key={document.id}
      onDelete={onDeleteDocuments}
    />
  ));

  const emptyDocumentsMessage = filtersActive
    ? "По текущим фильтрам документов не найдено. Измените поиск или сбросьте фильтры."
    : "Импортированные faktury Allegro, Booksy, iPOS и другие появятся здесь с датой, номером, отправителем и вложениями.";

  if (isMobile) {
    return (
      <section className="import-page import-page-mobile">
        <PageHeader
          collapsedMeta={`${visibleSummary.total} документов`}
          collapsible={false}
          actions={
            <>
              <SearchControl
                className="import-page-search-control"
                placeholder="Номер, тема, отправитель, PDF..."
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                onClear={() => updateFilter("search", "")}
              />
              <div className="import-page-summary">
                <article
                  className={`import-page-summary-card${
                    filtersActive ? "" : " is-active"
                  }`}>
                  <span>{filtersActive ? "Показано" : "Всего"}</span>
                  <strong>
                    {visibleSummary.total}
                    {filtersActive ? `/${totalSummary.total}` : ""}
                  </strong>
                </article>
                <article className="import-page-summary-card">
                  <span>С суммой</span>
                  <strong>{visibleSummary.withAmount}</strong>
                </article>
                <article className="import-page-summary-card">
                  <span>Расходы</span>
                  <strong>{formatMoney(visibleSummary.amountTotal)}</strong>
                </article>
                <article className="import-page-summary-card">
                  <span>Источники</span>
                  <strong>{visibleSummary.sources}</strong>
                </article>
              </div>
              <details className="import-page-filters-collapsible">
                <summary>Фильтры</summary>
                <ImportDocumentFilters
                  filters={filters}
                  sourceOptions={sourceOptions}
                  totalSummary={totalSummary}
                  updateFilter={updateFilter}
                />
              </details>
              {filtersActive ? (
                <button
                  className="secondary-button import-page-reset-button"
                  type="button"
                  onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              ) : null}
              {filteredDocuments.length > 0 && onDeleteDocuments ? (
                <button
                  className="danger-button import-page-delete-button"
                  type="button"
                  onClick={handleDeleteVisible}>
                  <Trash2 size={15} />
                  {filtersActive
                    ? `Удалить показанные (${filteredDocuments.length})`
                    : `Удалить все (${filteredDocuments.length})`}
                </button>
              ) : null}
            </>
          }
          description={`${visibleSummary.total} из ${totalSummary.total} документов`}
          title="Импорт"
        />

        {booksyGmailSync ? (
          <details className="import-page-booksy-collapsible">
            <summary>Gmail / Booksy</summary>
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
          </details>
        ) : null}

        <section className="import-documents-panel import-panel">
          <div className="import-scroll import-document-grid">
            {filteredDocuments.length === 0 ? (
              <div className="import-page-empty">
                <strong>Документы не найдены</strong>
                <span>{emptyDocumentsMessage}</span>
              </div>
            ) : (
              documentCards
            )}
          </div>
        </section>
      </section>
    );
  }

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
          <SearchControl
            className="import-document-search"
            placeholder="Номер, тема, отправитель, PDF..."
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            onClear={() => updateFilter("search", "")}
          />

          <ImportDocumentFilters
            filters={filters}
            sourceOptions={sourceOptions}
            totalSummary={totalSummary}
            updateFilter={updateFilter}
          />

          {filtersActive && (
            <button
              className="secondary-button import-document-reset"
              type="button"
              onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}

          {filteredDocuments.length > 0 && onDeleteDocuments && (
            <button
              className="danger-button import-document-delete-bulk"
              type="button"
              onClick={handleDeleteVisible}>
              <Trash2 size={15} />
              {filtersActive
                ? `Удалить показанные (${filteredDocuments.length})`
                : `Удалить все (${filteredDocuments.length})`}
            </button>
          )}
        </div>

        <div className="import-document-grid">
          {documentCards}
          {filteredDocuments.length === 0 && (
            <p className="operations-empty">{emptyDocumentsMessage}</p>
          )}
        </div>
      </section>
    </section>
  );
}

export default ImportPage;
