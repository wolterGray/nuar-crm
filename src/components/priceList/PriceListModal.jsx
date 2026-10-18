import { useEffect, useMemo } from "react";
import Button from "../ui/Button.jsx";
import PriceListPreview from "./PriceListPreview.jsx";
import { preparePriceListData } from "../../utils/priceListGenerator.js";
import { downloadPriceListPdf } from "../../utils/priceListExporter.js";
import "./PriceList.css";

export default function PriceListModal({
  isOpen,
  onClose,
  services = [],
  appSettings = null,
}) {
  // Automatically prepare price list data from live CRM services
  const priceListData = useMemo(() => {
    return preparePriceListData(services, appSettings);
  }, [services, appSettings]);

  // Handler to download / print vector A4 PDF
  const handleDownloadPdf = () => {
    downloadPriceListPdf();
  };

  // Keyboard shortcut: Escape to return to services
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="price-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Прайс-лист"
    >
      <div className="price-modal-container">
        {/* Minimal Navigation Bar */}
        <header className="price-modal-navbar">
          <div className="price-modal-left">
            <Button
              variant="secondary"
              size="sm"
              leftIcon="arrowLeft"
              onClick={onClose}
              className="price-btn-back"
            >
              К услугам
            </Button>

            <div className="price-modal-title-group">
              <h1 className="price-modal-title">Прайс-лист</h1>
              <span className="price-modal-count">
                {priceListData.totalServices} услуг
                {priceListData.totalPages > 1 ? ` · ${priceListData.totalPages} стр.` : ""}
              </span>
            </div>
          </div>

          <div className="price-modal-right">
            <Button
              variant="primary"
              size="sm"
              leftIcon="download"
              onClick={handleDownloadPdf}
              className="price-btn-download-pdf"
            >
              Скачать PDF
            </Button>
          </div>
        </header>

        {/* Scrollable Preview Area */}
        <main className="price-viewport-area">
          <PriceListPreview priceListData={priceListData} />
        </main>
      </div>
    </div>
  );
}
