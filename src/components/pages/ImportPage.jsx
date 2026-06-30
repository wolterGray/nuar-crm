import {
  ExternalLink,
  FileText,
  Mail,
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

import PageHeader from "../ui/PageHeader.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import Button from "../ui/Button.jsx";

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

function ImportDocumentCard({document, onDelete}) {
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

  return (
    <article className="crm-card import-document-card border border-border rounded-card bg-surface shadow-sm p-4 flex flex-col gap-3.5 min-w-0 transition-colors duration-200">
      <div className="import-document-main flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="import-document-icon flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent shrink-0">
            <FileText size={16} />
          </span>
          <div className="grid gap-0.5 min-w-0">
            <strong className="text-text-main text-sm font-semibold truncate block">{title}</strong>
            <span className="text-accent text-[10px] font-bold tracking-wider uppercase truncate block">{sourceLabel}</span>
          </div>
        </div>
      </div>

      <div className="import-document-description">
        {document.subject && document.subject !== title ? (
          <p className="m-0 text-text-muted text-xs leading-relaxed">{document.subject}</p>
        ) : null}

        {(document.summary || document.description) && (
          <p className="m-0 text-text-muted text-xs leading-relaxed opacity-85">
            {document.summary || document.description}
          </p>
        )}
      </div>

      <dl className="import-document-meta grid grid-cols-2 gap-3 mt-1.5 p-3 rounded-lg bg-field border border-border-soft">
        {metaRows.map((row) => (
          <div className="grid gap-0.5 min-w-0" key={row.label}>
            <dt className="text-text-faint text-[9px] font-semibold tracking-wider uppercase">{row.label}</dt>
            <dd className={`m-0 text-xs truncate ${row.highlight ? "text-accent font-semibold" : "text-text-main"}`}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="import-document-actions flex items-center gap-1.5 shrink-0">
        <a
          className="import-document-action"
          href={document.gmailUrl}
          rel="noreferrer"
          target="_blank"
          title="Открыть письмо в Gmail">
          <ExternalLink size={15} />
        </a>
        <button
          aria-label="Удалить документ"
          className="import-document-action import-document-delete"
          title="Удалить из CRM"
          type="button"
          onClick={handleDelete}>
          <Trash2 size={15} />
        </button>
      </div>
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
    <div className="import-document-filters flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <label className="import-filter-field">
        <small className="text-text-faint text-[10px] font-bold tracking-wider uppercase">Источник</small>
        <select
          className="import-filter-select"
          value={filters.source}
          onChange={(event) => updateFilter("source", event.target.value)}>
          <option value="all">Все · {totalSummary.total}</option>
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {option.count}
            </option>
          ))}
        </select>
      </label>

      <label className="import-filter-field">
        <small className="text-text-faint text-[10px] font-bold tracking-wider uppercase">Сумма</small>
        <select
          className="import-filter-select"
          value={filters.amount}
          onChange={(event) => updateFilter("amount", event.target.value)}>
          {amountFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="import-filter-field">
        <small className="text-text-faint text-[10px] font-bold tracking-wider uppercase">Период</small>
        <select
          className="import-filter-select"
          value={filters.period}
          onChange={(event) => updateFilter("period", event.target.value)}>
          {periodFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ImportPage({booksyGmailSync, calendarEntries, documents, onDeleteDocuments}) {

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

      key={document.id}
      onDelete={onDeleteDocuments}
    />
  ));

  const emptyDocumentsMessage = filtersActive
    ? "По текущим фильтрам документов не найдено. Измените поиск или сбросьте фильтры."
    : "Импортированные faktury Allegro, Booksy, iPOS и другие появятся здесь с датой, номером, отправителем и вложениями.";

  return (
    <div className="import-page flex flex-col gap-6 p-4 md:p-6 w-full">
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

      {/* Summary Cards */}
      <div className="import-summary-grid grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="import-summary-card flex flex-col gap-1 p-3.5 rounded-card border border-border bg-surface shadow-sm">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {filtersActive ? "Показано" : "Документы"}
          </span>
          <strong className="text-xl font-bold text-text-main mt-0.5">
            {visibleSummary.total}
            {filtersActive ? ` / ${totalSummary.total}` : ""}
          </strong>
        </div>

        <div className="import-summary-card flex flex-col gap-1 p-3.5 rounded-card border border-border bg-surface shadow-sm">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            С суммой в письме
          </span>
          <strong className="text-xl font-bold text-text-main mt-0.5">
            {visibleSummary.withAmount}
          </strong>
        </div>

        <div className="import-summary-card flex flex-col gap-1 p-3.5 rounded-card border border-border bg-surface shadow-sm">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Распознано расходов
          </span>
          <strong className="text-xl font-bold text-text-main mt-0.5">
            {formatMoney(visibleSummary.amountTotal)}
          </strong>
        </div>

        <div className="import-summary-card flex flex-col gap-1 p-3.5 rounded-card border border-border bg-surface shadow-sm">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Источники
          </span>
          <strong className="text-xl font-bold text-text-main mt-0.5">
            {visibleSummary.sources}
          </strong>
        </div>
      </div>

      {/* Main Section */}
      <section className="crm-card import-documents-panel border border-border rounded-card bg-surface shadow-sm flex flex-col">
        {/* Panel Header */}
        <div className="p-4 md:p-5 border-b border-border-soft flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-text-muted shrink-0">
              <Mail size={20} />
            </span>
            <div className="grid gap-0.5">
              <h2 className="m-0 text-text-main text-base font-semibold leading-snug">Документы расходов</h2>
              <p className="m-0 text-text-muted text-xs">
                {filtersActive
                  ? `Показано ${visibleSummary.total} из ${totalSummary.total}`
                  : `${totalSummary.total} сохранено`}{" "}
                · сортировка по дате, новые сверху
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 md:p-5 border-b border-border-soft flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchControl
              className="import-search-control w-full lg:max-w-md"
              placeholder="Номер, тема, отправитель, PDF..."
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              onClear={() => updateFilter("search", "")}
            />

            <div className="flex items-center gap-2 self-start lg:self-auto">
              {filtersActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              )}

              {filteredDocuments.length > 0 && onDeleteDocuments && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteVisible}>
                  <Trash2 size={15} />
                  {filtersActive
                    ? `Удалить показанные (${filteredDocuments.length})`
                    : `Удалить все (${filteredDocuments.length})`}
                </Button>
              )}
            </div>
          </div>

          <ImportDocumentFilters
            filters={filters}
            sourceOptions={sourceOptions}
            totalSummary={totalSummary}
            updateFilter={updateFilter}
          />
        </div>

        {/* Documents Grid */}
        <div className="p-4 md:p-5">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-10 text-text-muted max-w-md mx-auto flex flex-col items-center gap-2">
              <p className="font-semibold text-sm m-0 text-text-main">Документы не найдены</p>
              <p className="text-xs m-0 leading-relaxed">{emptyDocumentsMessage}</p>
            </div>
          ) : (
            <div className="import-documents-grid grid grid-cols-1 gap-4">
              {documentCards}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ImportPage;
