import { useState } from "react";
import AppIcon from "../ui/AppIcon.jsx";
import IconButton from "../ui/IconButton.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import { PRICE_LIST_LANGUAGES } from "../../utils/priceListTranslations.js";
import { DEFAULT_PRICE_LIST_SETTINGS } from "../../utils/priceListGenerator.js";

export default function PriceListSettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  services = [],
  categories = [],
  resolvedContacts = null,
}) {
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategoryExpand = (catId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleChange = (key, value) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  // Category toggle: include or exclude category
  const handleToggleCategory = (catName) => {
    const current = new Set(settings.excludedCategoryIds || []);
    if (current.has(catName)) {
      current.delete(catName);
    } else {
      current.add(catName);
    }
    handleChange("excludedCategoryIds", Array.from(current));
  };

  // Service toggle: include or exclude single service
  const handleToggleService = (svcId) => {
    const current = new Set(settings.excludedServiceIds || []);
    const strId = String(svcId);
    if (current.has(strId)) {
      current.delete(strId);
    } else {
      current.add(strId);
    }
    handleChange("excludedServiceIds", Array.from(current));
  };

  const handleReset = () => {
    onUpdateSettings({ ...DEFAULT_PRICE_LIST_SETTINGS });
  };

  if (!isOpen) return null;

  return (
    <aside className="price-settings-drawer" aria-label="Настройки прайс-листа">
      <div className="price-drawer-header">
        <div className="price-drawer-title-row">
          <AppIcon name="sliders" size="sm" />
          <h2 className="price-drawer-title">Настройки прайса</h2>
        </div>
        <div className="price-drawer-actions">
          <button
            type="button"
            className="price-btn-reset-link"
            onClick={handleReset}
            title="Сбросить к значениям по умолчанию"
          >
            Сброс
          </button>
          <IconButton
            icon="x"
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Закрыть панель настроек"
          />
        </div>
      </div>

      <div className="price-drawer-body">
        {/* 1. THEME SELECTION */}
        <div className="price-settings-group">
          <label className="price-group-label">Тема оформления</label>
          <div className="price-pill-selector">
            <button
              type="button"
              className={`price-pill-option ${settings.theme === "dark" ? "is-active" : ""}`}
              onClick={() => handleChange("theme", "dark")}
            >
              <span className="price-theme-dot price-theme-dark" />
              Nuar Dark
            </button>
            <button
              type="button"
              className={`price-pill-option ${settings.theme === "light" ? "is-active" : ""}`}
              onClick={() => handleChange("theme", "light")}
            >
              <span className="price-theme-dot price-theme-light" />
              Nuar Light
            </button>
          </div>
        </div>

        {/* 2. FORMAT SELECTION */}
        <div className="price-settings-group">
          <label className="price-group-label">Формат макета</label>
          <div className="price-grid-selector">
            <button
              type="button"
              className={`price-format-card ${settings.format === "a4" ? "is-active" : ""}`}
              onClick={() => handleChange("format", "a4")}
            >
              <AppIcon name="fileText" size="sm" />
              <div className="price-format-info">
                <span className="price-format-name">A4 Документ</span>
                <span className="price-format-hint">Печать & PDF</span>
              </div>
            </button>

            <button
              type="button"
              className={`price-format-card ${settings.format === "stories" ? "is-active" : ""}`}
              onClick={() => handleChange("format", "stories")}
            >
              <AppIcon name="layoutGrid" size="sm" />
              <div className="price-format-info">
                <span className="price-format-name">Stories</span>
                <span className="price-format-hint">1080 × 1920</span>
              </div>
            </button>

            <button
              type="button"
              className={`price-format-card ${settings.format === "post" ? "is-active" : ""}`}
              onClick={() => handleChange("format", "post")}
            >
              <AppIcon name="palette" size="sm" />
              <div className="price-format-info">
                <span className="price-format-name">Пост</span>
                <span className="price-format-hint">1080 × 1350</span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. PRICE MODE (Full vs Compact) */}
        <div className="price-settings-group">
          <label className="price-group-label">Отображение цен</label>
          <div className="price-pill-selector">
            <button
              type="button"
              className={`price-pill-option ${settings.priceMode === "full" ? "is-active" : ""}`}
              onClick={() => handleChange("priceMode", "full")}
            >
              <AppIcon name="list" size="xs" />
              Все длительности
            </button>
            <button
              type="button"
              className={`price-pill-option ${settings.priceMode === "compact" ? "is-active" : ""}`}
              onClick={() => handleChange("priceMode", "compact")}
            >
              <AppIcon name="banknote" size="xs" />
              Компактно («от»)
            </button>
          </div>
        </div>

        {/* 4. LANGUAGE SELECTION */}
        <div className="price-settings-group">
          <label className="price-group-label">Язык прайс-листа</label>
          <div className="price-lang-row">
            {PRICE_LIST_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`price-lang-btn ${settings.language === lang.code ? "is-active" : ""}`}
                onClick={() => handleChange("language", lang.code)}
              >
                <span className="price-lang-code">{lang.label}</span>
                <span className="price-lang-name">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 5. DISPLAY OPTIONS */}
        <div className="price-settings-group">
          <label className="price-group-label">Параметры отображения</label>
          <div className="price-options-list">
            <label className="price-toggle-row">
              <span className="price-toggle-text">Показывать скрытые услуги</span>
              <Checkbox
                checked={Boolean(settings.includeHidden)}
                onChange={(e) => handleChange("includeHidden", e.target.checked)}
              />
            </label>

            <label className="price-toggle-row">
              <span className="price-toggle-text">Краткие описания процедур</span>
              <Checkbox
                checked={Boolean(settings.showDescriptions)}
                onChange={(e) => handleChange("showDescriptions", e.target.checked)}
              />
            </label>

            <label className="price-toggle-row">
              <span className="price-toggle-text">Контакты и адрес в футере</span>
              <Checkbox
                checked={Boolean(settings.showContacts)}
                onChange={(e) => handleChange("showContacts", e.target.checked)}
              />
            </label>

            {settings.showContacts ? (
              <div className="price-contacts-custom-fields">
                <div className="price-custom-field">
                  <span className="price-custom-field-label">Адрес:</span>
                  <input
                    type="text"
                    className="price-custom-input"
                    placeholder={resolvedContacts?.address || "ul. Świętojerska 5/7, Warszawa"}
                    value={settings.studioAddress || ""}
                    onChange={(e) => handleChange("studioAddress", e.target.value)}
                  />
                </div>
                <div className="price-custom-field">
                  <span className="price-custom-field-label">Телефон:</span>
                  <input
                    type="text"
                    className="price-custom-input"
                    placeholder={resolvedContacts?.phone || "+48 572 201 114"}
                    value={settings.studioPhone || ""}
                    onChange={(e) => handleChange("studioPhone", e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 6. CATEGORIES & SERVICES SELECTION */}
        <div className="price-settings-group">
          <div className="price-group-label-row">
            <label className="price-group-label">Состав прайс-листа</label>
            <span className="price-count-hint">
              {categories.length} категорий
            </span>
          </div>

          <div className="price-tree-list">
            {categories.map((catName) => {
              const isCatExcluded = (settings.excludedCategoryIds || []).includes(catName);
              const catServices = services.filter((s) => (s.category || "Без категории") === catName);
              const isExpanded = Boolean(expandedCategories[catName]);

              return (
                <div key={catName} className={`price-tree-category ${isCatExcluded ? "is-excluded" : ""}`}>
                  <div className="price-tree-cat-header">
                    <label className="price-tree-check-label">
                      <Checkbox
                        checked={!isCatExcluded}
                        onChange={() => handleToggleCategory(catName)}
                      />
                      <span className="price-tree-cat-name">{catName}</span>
                      <span className="price-tree-cat-count">({catServices.length})</span>
                    </label>

                    {catServices.length > 0 ? (
                      <button
                        type="button"
                        className="price-tree-expand-btn"
                        onClick={() => toggleCategoryExpand(catName)}
                        aria-label="Показать услуги"
                      >
                        <AppIcon name={isExpanded ? "chevronUp" : "chevronDown"} size="xs" />
                      </button>
                    ) : null}
                  </div>

                  {isExpanded && !isCatExcluded ? (
                    <div className="price-tree-services-sub">
                      {catServices.map((svc) => {
                        const isSvcExcluded = (settings.excludedServiceIds || []).includes(String(svc.id));
                        return (
                          <label key={svc.id} className="price-tree-svc-item">
                            <Checkbox
                              checked={!isSvcExcluded}
                              onChange={() => handleToggleService(svc.id)}
                            />
                            <span className="price-tree-svc-name">{svc.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
