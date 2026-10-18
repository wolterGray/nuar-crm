/**
 * High-quality A4 PDF export using the browser's native print engine.
 * Renders pure vector text, supports all Polish diacritics, and respects exact CSS page margins.
 */

export function downloadPriceListPdf() {
  if (typeof window === "undefined") return;

  const originalTitle = document.title;
  try {
    document.title = "NUAR-Cennik";
    window.print();
  } finally {
    // Restore original window title after print dialog triggers
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
}

/**
 * Backward-compatible alias
 */
export const printPriceList = downloadPriceListPdf;
