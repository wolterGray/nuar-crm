import { useState, useMemo, useEffect, useCallback } from "react";
import Button from "../ui/Button.jsx";
import IconButton from "../ui/IconButton.jsx";
import PriceListPreview from "./PriceListPreview.jsx";
import PriceListSettingsDrawer from "./PriceListSettingsDrawer.jsx";
import {
  loadPriceListSettings,
  savePriceListSettings,
  preparePriceListData,
} from "../../utils/priceListGenerator.js";
import { exportPriceListToPng, printPriceList } from "../../utils/priceListExporter.js";
import "./PriceList.css";

export default function PriceListModal({
  isOpen,
  onClose,
  services = [],
  serviceCategories: _serviceCategories = [],
  pushNotification,
}) {
  const [settings, setSettings] = useState(() => loadPriceListSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Synchronize settings with localStorage whenever they change
  const handleUpdateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    savePriceListSettings(newSettings);
  }, []);

  // Compute live price list data whenever services or settings change
  const priceListData = useMemo(() => {
    return preparePriceListData(services, settings);
  }, [services, settings]);

  // Unique category names for the settings tree
  const categoryNames = useMemo(() => {
    const raw = services
      .map((s) => s.category || "Без категории")
      .filter(Boolean);
    return Array.from(new Set(raw)).sort();
  }, [services]);

  // Auto-fit scale adjustment on window resize or initial mount
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        setIsSettingsOpen(false); // Mobile: settings collapsed by default for maximum preview area
        // Auto scale for mobile screens to fit 390px
        const screenW = window.innerWidth;
        if (screenW < 440) {
          setZoomScale(0.55);
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
      const result = await exportPriceListToPng(priceListData, settings);
      pushNotification?.({
        title: "Экспорт выполнен",
        message: `Прайс-лист сохранён (${result.filename}).`,
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
      message: "В окне печати выберите «Сохранить как PDF» для сохранения файла.",
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
    <div className="price-modal-overlay" role="dialog" aria-modal="true" aria-label="Генератор прайс-листа">
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
              </span>
            </div>
          </div>

          <div className="price-modal-center">
            {/* Zoom Controls */}
            <div className="price-zoom-group">
              <IconButton
                icon="minus"
                size="sm"
                variant="ghost"
                onClick={() => setZoomScale((s) => Math.max(0.4, Number((s - 0.1).toFixed(2))))}
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
                onClick={() => setZoomScale((s) => Math.min(1.5, Number((s + 0.1).toFixed(2))))}
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
          />
        </div>
      </div>
    </div>
  );
}
