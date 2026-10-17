import { useState, useEffect, useMemo } from "react";
import Button from "../ui/Button.jsx";
import IconButton from "../ui/IconButton.jsx";
import PriceListPreview from "./PriceListPreview.jsx";
import PriceListSettingsDrawer from "./PriceListSettingsDrawer.jsx";
import {
  preparePriceListData,
  loadPriceListSettings,
  savePriceListSettings,
} from "../../utils/priceListGenerator.js";
import { exportPriceListToPng, printPriceList } from "../../utils/priceListExporter.js";
import "./PriceList.css";

export default function PriceListModal({
  isOpen,
  onClose,
  services = [],
  appSettings = null,
  pushNotification,
}) {
  const [settings, setSettings] = useState(() => loadPriceListSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [activePageNumber, setActivePageNumber] = useState(null);

  // Sync settings changes to localStorage
  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    savePriceListSettings(newSettings);
  };

  // Prepare price list data with automatic responsive pagination
  const priceListData = useMemo(() => {
    return preparePriceListData(services, settings, appSettings);
  }, [services, settings, appSettings]);

  // Unique sorted category names from CRM services
  const categoryNames = useMemo(() => {
    const raw = services
      .map((s) => s.category || "Без категории")
      .filter(Boolean);
    return Array.from(new Set(raw)).sort();
  }, [services]);

  // Derived effective page number clamped to totalPages
  const effectiveActivePage =
    activePageNumber && activePageNumber <= priceListData.totalPages
      ? activePageNumber
      : null;

  // Auto-fit scale adjustment on window resize or initial mount
  const handleFitWidth = () => {
    const sheetWidth =
      settings.format === "stories" ? 540 : settings.format === "post" ? 600 : 700;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const availableWidth = isMobile
      ? window.innerWidth - 32
      : window.innerWidth - (isSettingsOpen ? 420 : 80);
    const scale = Math.min(1.4, Math.max(0.38, Number((availableWidth / sheetWidth).toFixed(2))));
    setZoomScale(scale);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        setIsSettingsOpen(false); // Mobile: settings collapsed by default for maximum preview area
        const screenW = window.innerWidth;
        if (screenW < 440) {
          setZoomScale(0.52);
        } else if (screenW < 600) {
          setZoomScale(0.68);
        } else {
          setZoomScale(0.85);
        }
      } else {
        setZoomScale(1);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Export to PNG handler
  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      const result = await exportPriceListToPng(priceListData, settings, activePageNumber);
      pushNotification?.({
        title: "Экспорт PNG выполнен",
        message:
          result.count > 1
            ? `Экспортировано страниц: ${result.count}. Файлы сохранены.`
            : `Прайс-лист сохранён (${result.filename}).`,
      });
    } catch (err) {
      console.error("PNG export error:", err);
      pushNotification?.({
        title: "Ошибка экспорта",
        message: "Не удалось сохранить PNG изображение. Попробуйте еще раз.",
      });
    } finally {
      setIsExportingPng(false);
    }
  };

  // Print / PDF handler
  const handlePrint = () => {
    pushNotification?.({
      title: "Печать / Экспорт в PDF",
      message: "В окне печати выберите «Сохранить как PDF» для сохранения векторного документа.",
    });
    setTimeout(() => {
      printPriceList();
    }, 150);
  };

  // Keyboard shortcut: Escape to close
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
      aria-label="Генератор прайс-листа"
    >
      <div className="price-modal-container">
        {/* TOP WORKSPACE NAVIGATION */}
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

            <div className="price-modal-meta">
              <h1 className="price-modal-title">Прайс-лист</h1>
              <span className="price-modal-badge">
                {priceListData.totalServices} услуг · {priceListData.totalCategories} кат.
                {priceListData.totalPages > 1 ? ` · ${priceListData.totalPages} стр.` : ""}
              </span>

              {priceListData.unusualPricingServices?.length > 0 ? (
                <span
                  className="price-modal-pricing-notice"
                  title={`Обратите внимание: у ${priceListData.unusualPricingServices.length} услуг в CRM цена за большую длительность меньше меньшей. Отображается без изменений.`}
                >
                  ⚠️ Цены в CRM
                </span>
              ) : null}
            </div>
          </div>

          <div className="price-modal-center">
            {/* Multi-page switcher tabs */}
            {priceListData.totalPages > 1 ? (
              <div className="price-page-tabs" role="tablist" aria-label="Выбор страницы">
                <button
                  type="button"
                  className={`price-page-tab ${effectiveActivePage === null ? "is-active" : ""}`}
                  onClick={() => setActivePageNumber(null)}
                >
                  Все ({priceListData.totalPages})
                </button>
                {Array.from({ length: priceListData.totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`price-page-tab ${
                        effectiveActivePage === pNum ? "is-active" : ""
                      }`}
                      onClick={() => setActivePageNumber(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Responsive Zoom Controls with Fit-Width */}
            <div className="price-zoom-group">
              <button
                type="button"
                className="price-zoom-fit-btn"
                onClick={handleFitWidth}
                title="Подогнать под ширину экрана"
              >
                По ширине
              </button>
              <IconButton
                icon="minus"
                size="sm"
                variant="ghost"
                onClick={() => setZoomScale((s) => Math.max(0.35, Number((s - 0.1).toFixed(2))))}
                aria-label="Уменьшить масштаб"
              />
              <button
                type="button"
                className="price-zoom-label"
                onClick={() => setZoomScale(1)}
                title="Сбросить масштаб к 100%"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <IconButton
                icon="plus"
                size="sm"
                variant="ghost"
                onClick={() => setZoomScale((s) => Math.min(1.8, Number((s + 0.1).toFixed(2))))}
                aria-label="Увеличить масштаб"
              />
            </div>
          </div>

          <div className="price-modal-right">
            {/* Toggle Settings Sidebar */}
            <Button
              variant={isSettingsOpen ? "primary" : "secondary"}
              size="sm"
              leftIcon="sliders"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="price-btn-settings"
            >
              Настройки
            </Button>

            {/* Export PNG */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon="download"
              loading={isExportingPng}
              onClick={handleExportPng}
              className="price-btn-export-png"
            >
              PNG
            </Button>

            {/* Print / Save PDF */}
            <Button
              variant="primary"
              size="sm"
              leftIcon="printer"
              onClick={handlePrint}
              className="price-btn-print"
            >
              Печать / PDF
            </Button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <div className="price-modal-workspace">
          {/* CENTER VIEWPORT (Scrollable Artboard) */}
          <main className="price-viewport-area">
            <PriceListPreview
              priceListData={priceListData}
              settings={settings}
              scale={zoomScale}
              activePageNumber={effectiveActivePage}
            />
          </main>

          {/* RIGHT SETTINGS DRAWER / SIDEBAR */}
          <PriceListSettingsDrawer
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            services={services}
            categories={categoryNames}
            resolvedContacts={priceListData.labels}
            totalPages={priceListData.totalPages}
            totalServices={priceListData.totalServices}
            onExportPng={handleExportPng}
            onPrintPdf={handlePrint}
            isExportingPng={isExportingPng}
          />
        </div>
      </div>
    </div>
  );
}
