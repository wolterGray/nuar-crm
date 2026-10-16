/**
 * Shared Pagination Utilities for NUAR CRM
 * Used across ClientsPage, VisitsTable (Payments), and other data tables.
 */

export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

/**
 * Calculates how many table rows fit dynamically into the available container height.
 * Ensures zero vertical scrollbar when in 'auto' mode.
 *
 * @param {number} containerHeight - Height of table container in pixels
 * @param {number} headerHeight - Height of table header in pixels
 * @param {number} rowHeight - Height of each row in pixels
 * @param {number} minRows - Minimum number of rows to display (default 4)
 * @param {number} extraOffset - Buffer for borders, margins, scrollbars (default 6)
 * @returns {number} The calculated page size
 */
export const calculateDynamicPageSize = (
  containerHeight,
  headerHeight = 36,
  rowHeight = 44,
  minRows = 4,
  extraOffset = 6,
) => {
  if (!containerHeight || containerHeight <= 0) return minRows;
  const available = containerHeight - headerHeight - extraOffset;
  if (available <= 0) return minRows;
  return Math.max(minRows, Math.floor(available / rowHeight));
};

/**
 * Generates an array of page numbers and ellipsis objects for sliding-window pagination.
 * Handles forward and backward navigation with full visibility of neighboring pages.
 *
 * @param {number} currentPage - Currently active page (1-based)
 * @param {number} totalPages - Total number of pages
 * @returns {Array<number | {type: 'ellipsis', targetPage: number, key: string}>}
 */
export const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) return [1];

  if (totalPages <= 7) {
    return Array.from({length: totalPages}, (_, i) => i + 1);
  }

  // Sliding window showing numbers around currentPage (including forward pages)
  let start = Math.max(2, currentPage - 2);
  let end = Math.min(totalPages - 1, currentPage + 3);

  // Near start: show 1..6
  if (currentPage <= 4) {
    start = 2;
    end = Math.min(totalPages - 1, 6);
  }

  // Near end: show last 6
  if (currentPage >= totalPages - 3) {
    start = Math.max(2, totalPages - 5);
    end = totalPages - 1;
  }

  const items = [1];

  if (start > 2) {
    items.push({
      type: "ellipsis",
      targetPage: Math.max(1, currentPage - 5),
      key: "ellipsis-prev",
    });
  }

  for (let p = start; p <= end; p++) {
    items.push(p);
  }

  if (end < totalPages - 1) {
    items.push({
      type: "ellipsis",
      targetPage: Math.min(totalPages, currentPage + 5),
      key: "ellipsis-next",
    });
  }

  items.push(totalPages);

  return items;
};
