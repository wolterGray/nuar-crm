import {useMemo} from "react";
import AppIcon from "./AppIcon.jsx";
import IconButton from "./IconButton.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {
  getPaginationItems,
  PAGE_SIZE_OPTIONS,
} from "../../utils/pagination.js";

/**
 * Reusable, high-density PaginationBar for NUAR CRM
 * Used across ClientsPage, VisitsTable (Payments), and other data tables.
 */
export default function PaginationBar({
  allowAll = false,
  autoPageSize = 10,
  className = "",
  currentPage = 1,
  itemLabel = "записей",
  onPageChange,
  onPageSizeChange,
  pageSize = 10,
  pageSizeMode = "auto",
  totalItems = 0,
  totalPages = 1,
}) {
  const {isMobile} = useBreakpoint();
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  const paginationItems = useMemo(
    () => getPaginationItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages],
  );

  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <footer
      className={`crm-pagination-bar payments-pagination-bar ${className}`}
      role="navigation"
      aria-label="Навигация по страницам"
    >
      <div className="crm-pagination-info payments-pagination-info">
        {totalItems > 0 ? (
          <>
            Показано <b>{startRecord}–{endRecord}</b> из <b>{totalItems}</b> {itemLabel}
          </>
        ) : (
          `0 ${itemLabel}`
        )}
      </div>

      <div className="crm-pagination-controls payments-pagination-controls">
        <div className="crm-pagesize-wrap payments-pagesize-wrap">
          <select
            aria-label="Количество записей на странице"
            className="crm-pagesize-select payments-pagesize-select"
            value={pageSizeMode}
            onChange={(e) => {
              const val = e.target.value;
              onPageSizeChange?.(val === "auto" ? "auto" : Number(val));
            }}
          >
            <option value="auto">Авто ({autoPageSize} на экране)</option>
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} на странице
              </option>
            ))}
            {allowAll ? <option value={999999}>Все записи</option> : null}
          </select>
          <AppIcon className="crm-pagesize-arrow payments-pagesize-arrow" name="chevronDown" size="xs" />
        </div>

        <div className="crm-page-buttons payments-page-buttons">
          <IconButton
            aria-label="Предыдущая страница"
            disabled={safeCurrentPage <= 1}
            icon="chevronLeft"
            size="sm"
            variant="ghost"
            onClick={() => onPageChange?.(safeCurrentPage - 1)}
          />

          {!isMobile ? (
            paginationItems.map((item) => {
              if (typeof item === "object" && item.type === "ellipsis") {
                return (
                  <button
                    key={item.key}
                    aria-label={`Перейти на страницу ${item.targetPage}`}
                    className="crm-page-ellipsis-btn payments-page-ellipsis-btn"
                    title={`Перейти на страницу ${item.targetPage}`}
                    type="button"
                    onClick={() => onPageChange?.(item.targetPage)}
                  >
                    …
                  </button>
                );
              }
              const pageNum = item;
              return (
                <button
                  key={pageNum}
                  aria-label={`Страница ${pageNum}`}
                  aria-current={safeCurrentPage === pageNum ? "page" : undefined}
                  className={`crm-page-num-btn payments-page-num-btn ${
                    safeCurrentPage === pageNum ? "is-active" : ""
                  }`}
                  type="button"
                  onClick={() => onPageChange?.(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })
          ) : (
            <span className="text-xs text-zinc-400 font-medium px-2">
              {safeCurrentPage} / {totalPages}
            </span>
          )}

          <IconButton
            aria-label="Следующая страница"
            disabled={safeCurrentPage >= totalPages}
            icon="chevronRight"
            size="sm"
            variant="ghost"
            onClick={() => onPageChange?.(safeCurrentPage + 1)}
          />
        </div>
      </div>
    </footer>
  );
}
