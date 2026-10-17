import { useState, useRef } from "react";
import AppIcon from "../ui/AppIcon.jsx";
import IconButton from "../ui/IconButton.jsx";
import Button from "../ui/Button.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import Switch from "../ui/Switch.jsx";
import Input from "../ui/Input.jsx";
import { Tabs, TabButton } from "../ui/Tabs.jsx";
import { PRICE_LIST_LANGUAGES } from "../../utils/priceListTranslations.js";
import { DEFAULT_PRICE_LIST_SETTINGS, BACKGROUND_PRESETS } from "../../utils/priceListGenerator.js";

export default function PriceListSettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  services = [],
  categories = [],
  resolvedContacts = null,
  totalPages = 1,
  totalServices = 0,
  onExportPng,
  onPrintPdf,
  isExportingPng = false,
}) {
  const [activeTab, setActiveTab] = useState("style"); // "style" | "content" | "export"
  const [expandedCategories, setExpandedCategories] = useState({});
  const [categorySearch, setCategorySearch] = useState("");

  const bgFileInputRef = useRef(null);
  const logoFileInputRef = useRef(null);

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

  // Background Image Upload
  const handleBgImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("Размер фонового изображения не должен превышать 8 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleChange("bgImage", reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Custom Logo Upload
  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Размер логотипа не должен превышать 5 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateSettings({
        ...settings,
        logoType: "custom",
        customLogoUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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

  // Filter categories by search
  const filteredCategories = categories.filter((catName) => {
    if (!categorySearch.trim()) return true;
    const query = categorySearch.toLowerCase();
    if (catName.toLowerCase().includes(query)) return true;
    const catServices = services.filter((s) => (s.category || "Без категории") === catName);
    return catServices.some((s) => s.name?.toLowerCase().includes(query));
  });

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
            title="Сбросить все параметры к значениям по умолчанию"
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

      {/* 3 LOGICAL TABS */}
      <div className="price-drawer-tabs-bar">
        <Tabs className="price-tabs-grid">
          <TabButton
            active={activeTab === "style"}
            onClick={() => setActiveTab("style")}
            icon="palette"
          >
            Оформление
          </TabButton>
          <TabButton
            active={activeTab === "content"}
            onClick={() => setActiveTab("content")}
            icon="listFilter"
          >
            Содержимое
          </TabButton>
          <TabButton
            active={activeTab === "export"}
            onClick={() => setActiveTab("export")}
            icon="fileDown"
          >
            Экспорт
          </TabButton>
        </Tabs>
      </div>

      <div className="price-drawer-body">
        {/* =========================================================================
            TAB 1: ОФОРМЛЕНИЕ (ФОН, ЛОГОТИП, ТИПОГРАФИКА)
            ========================================================================= */}
        {activeTab === "style" ? (
          <div className="price-tab-panel">
            {/* 1. ФОН ПРАЙСА */}
            <div className="price-settings-group">
              <label className="price-group-label">Фон документа</label>
              <div className="price-pill-selector price-presets-selector">
                {Object.values(BACKGROUND_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`price-pill-option ${
                      settings.bgPreset === preset.id ? "is-active" : ""
                    }`}
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        bgPreset: preset.id,
                        theme: preset.textMode === "light" ? "dark" : "light",
                      });
                    }}
                  >
                    <span
                      className="price-theme-dot"
                      style={{
                        backgroundColor: preset.bg,
                        border: preset.id === "white" ? "1px solid rgba(0,0,0,0.2)" : "none",
                      }}
                    />
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`price-pill-option ${
                    settings.bgPreset === "custom" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("bgPreset", "custom")}
                >
                  <span
                    className="price-theme-dot"
                    style={{ backgroundColor: settings.customBgColor || "#0d0d0f" }}
                  />
                  Свой цвет
                </button>
              </div>

              {/* Custom Color Picker if "custom" selected */}
              {settings.bgPreset === "custom" ? (
                <div className="price-custom-color-row">
                  <input
                    type="color"
                    className="price-color-input"
                    value={settings.customBgColor || "#0d0d0f"}
                    onChange={(e) => handleChange("customBgColor", e.target.value)}
                    title="Выбрать цвет"
                  />
                  <Input
                    type="text"
                    value={settings.customBgColor || "#0d0d0f"}
                    onChange={(e) => handleChange("customBgColor", e.target.value)}
                    placeholder="#0d0d0f"
                    className="price-hex-input"
                  />
                </div>
              ) : null}

              {/* Background Photo Section */}
              <div className="price-subfield-block">
                <div className="price-subfield-label">Фоновое изображение</div>
                <input
                  type="file"
                  ref={bgFileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={handleBgImageFile}
                />

                {settings.bgImage ? (
                  <div className="price-image-preview-card">
                    <img
                      src={settings.bgImage}
                      alt="Фон"
                      className="price-bg-thumb"
                    />
                    <div className="price-thumb-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => bgFileInputRef.current?.click()}
                      >
                        Заменить
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChange("bgImage", null)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon="image"
                    onClick={() => bgFileInputRef.current?.click()}
                    fullWidth
                  >
                    Загрузить фото фона
                  </Button>
                )}

                {/* Background image overlay opacity slider */}
                {settings.bgImage ? (
                  <div className="price-slider-group">
                    <div className="price-slider-header">
                      <span>Затемнение фона для читаемости</span>
                      <span className="price-slider-val">{settings.bgImageOpacity ?? 40}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="5"
                      value={settings.bgImageOpacity ?? 40}
                      onChange={(e) => handleChange("bgImageOpacity", Number(e.target.value))}
                      className="price-range-slider"
                    />
                  </div>
                ) : null}
              </div>

              {/* Text Contrast Scheme */}
              <div className="price-subfield-block">
                <div className="price-subfield-label">Цвет текста документа</div>
                <div className="price-pill-selector">
                  <button
                    type="button"
                    className={`price-pill-option ${
                      (settings.textColorMode || "auto") === "auto" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("textColorMode", "auto")}
                  >
                    Авто (по фону)
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.textColorMode === "light" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("textColorMode", "light")}
                  >
                    Светлый
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.textColorMode === "dark" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("textColorMode", "dark")}
                  >
                    Тёмный
                  </button>
                </div>
              </div>
            </div>

            {/* 2. ЛОГОТИП */}
            <div className="price-settings-group">
              <div className="price-group-header-with-switch">
                <label className="price-group-label" style={{ margin: 0 }}>
                  Логотип
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-textMuted">
                    {settings.showLogo !== false ? "Включён" : "Скрыт"}
                  </span>
                  <Switch
                    checked={settings.showLogo !== false}
                    onChange={(e) => handleChange("showLogo", e.target.checked)}
                  />
                </div>
              </div>

              {settings.showLogo !== false ? (
                <div className="price-subgroup-content">
                  {/* Logo Source Type */}
                  <div className="price-pill-selector">
                    <button
                      type="button"
                      className={`price-pill-option ${
                        (settings.logoType || "default") === "default" ? "is-active" : ""
                      }`}
                      onClick={() => handleChange("logoType", "default")}
                    >
                      NUAR знак
                    </button>
                    <button
                      type="button"
                      className={`price-pill-option ${
                        settings.logoType === "custom" ? "is-active" : ""
                      }`}
                      onClick={() => handleChange("logoType", "custom")}
                    >
                      Свой файл
                    </button>
                    <button
                      type="button"
                      className={`price-pill-option ${
                        settings.logoType === "text" ? "is-active" : ""
                      }`}
                      onClick={() => handleChange("logoType", "text")}
                    >
                      Текст
                    </button>
                  </div>

                  {/* Custom Logo File Uploader */}
                  {settings.logoType === "custom" ? (
                    <div className="price-subfield-block">
                      <input
                        type="file"
                        ref={logoFileInputRef}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        style={{ display: "none" }}
                        onChange={handleLogoFile}
                      />

                      {settings.customLogoUrl ? (
                        <div className="price-image-preview-card">
                          <img
                            src={settings.customLogoUrl}
                            alt="Логотип"
                            className="price-logo-thumb"
                          />
                          <div className="price-thumb-actions">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => logoFileInputRef.current?.click()}
                            >
                              Заменить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleChange("customLogoUrl", null)}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon="uploadCloud"
                          onClick={() => logoFileInputRef.current?.click()}
                          fullWidth
                        >
                          Загрузить логотип (PNG/WebP/SVG)
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {/* Logo Size and Alignment */}
                  <div className="price-subfield-block">
                    <div className="price-subfield-label">Размер логотипа</div>
                    <div className="price-pill-selector">
                      <button
                        type="button"
                        className={`price-pill-option ${
                          settings.logoSize === "sm" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoSize", "sm")}
                      >
                        Маленький
                      </button>
                      <button
                        type="button"
                        className={`price-pill-option ${
                          (settings.logoSize || "md") === "md" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoSize", "md")}
                      >
                        Средний
                      </button>
                      <button
                        type="button"
                        className={`price-pill-option ${
                          settings.logoSize === "lg" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoSize", "lg")}
                      >
                        Большой
                      </button>
                    </div>
                  </div>

                  <div className="price-subfield-block">
                    <div className="price-subfield-label">Расположение</div>
                    <div className="price-pill-selector">
                      <button
                        type="button"
                        className={`price-pill-option ${
                          settings.logoAlign === "left" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoAlign", "left")}
                      >
                        Слева
                      </button>
                      <button
                        type="button"
                        className={`price-pill-option ${
                          (settings.logoAlign || "center") === "center" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoAlign", "center")}
                      >
                        По центру
                      </button>
                      <button
                        type="button"
                        className={`price-pill-option ${
                          settings.logoAlign === "right" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("logoAlign", "right")}
                      >
                        Справа
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 3. ТИПОГРАФИКА */}
            <div className="price-settings-group">
              <label className="price-group-label">Типографика</label>

              {/* Font Family Selection */}
              <div className="price-subfield-block">
                <div className="price-subfield-label">Шрифт прайса</div>
                <div className="price-font-cards-stack">
                  <button
                    type="button"
                    className={`price-font-card ${
                      (settings.typographyFamily || "editorial") === "editorial"
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() => handleChange("typographyFamily", "editorial")}
                  >
                    <span className="price-font-sample font-editorial-sample">
                      Editorial Luxury
                    </span>
                    <span className="price-font-desc">Playfair Display + Inter</span>
                  </button>

                  <button
                    type="button"
                    className={`price-font-card ${
                      settings.typographyFamily === "modern" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("typographyFamily", "modern")}
                  >
                    <span className="price-font-sample font-modern-sample">Modern Sans</span>
                    <span className="price-font-desc">Inter / Apple Minimalist</span>
                  </button>

                  <button
                    type="button"
                    className={`price-font-card ${
                      settings.typographyFamily === "classic" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("typographyFamily", "classic")}
                  >
                    <span className="price-font-sample font-classic-sample">
                      Classic Serif
                    </span>
                    <span className="price-font-desc">Playfair Display / Georgia</span>
                  </button>
                </div>
              </div>

              {/* Text Size Scale */}
              <div className="price-subfield-block">
                <div className="price-subfield-label">Размер текста услуг</div>
                <div className="price-pill-selector">
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.typographyFontSize === "sm" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("typographyFontSize", "sm")}
                  >
                    Компактный
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      (settings.typographyFontSize || "md") === "md" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("typographyFontSize", "md")}
                  >
                    Стандартный
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.typographyFontSize === "lg" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("typographyFontSize", "lg")}
                  >
                    Крупный
                  </button>
                </div>
              </div>

              {/* Layout Density */}
              <div className="price-subfield-block">
                <div className="price-subfield-label">Плотность компоновки</div>
                <div className="price-pill-selector">
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.density === "compact" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("density", "compact")}
                  >
                    Компактная
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      (settings.density || "normal") === "normal" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("density", "normal")}
                  >
                    Стандартная
                  </button>
                  <button
                    type="button"
                    className={`price-pill-option ${
                      settings.density === "spacious" ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("density", "spacious")}
                  >
                    Просторная
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* =========================================================================
            TAB 2: СОДЕРЖИМОЕ (ЯЗЫК, ЦЕНЫ, КОНТАКТЫ, ФИЛЬТРЫ)
            ========================================================================= */}
        {activeTab === "content" ? (
          <div className="price-tab-panel">
            {/* 1. LANGUAGE */}
            <div className="price-settings-group">
              <label className="price-group-label">Язык документа</label>
              <div className="price-pill-selector">
                {PRICE_LIST_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    className={`price-pill-option ${
                      (settings.language || "pl") === lang.code ? "is-active" : ""
                    }`}
                    onClick={() => handleChange("language", lang.code)}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. PRICE MODE */}
            <div className="price-settings-group">
              <label className="price-group-label">Режим отображения цен</label>
              <div className="price-pill-selector">
                <button
                  type="button"
                  className={`price-pill-option ${
                    (settings.priceMode || "full") === "full" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("priceMode", "full")}
                >
                  Все варианты (сетка)
                </button>
                <button
                  type="button"
                  className={`price-pill-option ${
                    settings.priceMode === "compact" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("priceMode", "compact")}
                >
                  От мин. цены
                </button>
              </div>
            </div>

            {/* 3. SWITCHES: DESCRIPTIONS, CONTACTS, HIDDEN */}
            <div className="price-settings-group price-switches-group">
              <div className="price-switch-row">
                <span className="price-switch-title">Описания услуг</span>
                <Switch
                  checked={Boolean(settings.showDescriptions)}
                  onChange={(e) => handleChange("showDescriptions", e.target.checked)}
                />
              </div>

              <div className="price-switch-row">
                <span className="price-switch-title">Контакты студии</span>
                <Switch
                  checked={settings.showContacts !== false}
                  onChange={(e) => handleChange("showContacts", e.target.checked)}
                />
              </div>

              <div className="price-switch-row">
                <span className="price-switch-title">Включать скрытые услуги CRM</span>
                <Switch
                  checked={Boolean(settings.includeHidden)}
                  onChange={(e) => handleChange("includeHidden", e.target.checked)}
                />
              </div>
            </div>

            {/* 4. STUDIO CONTACTS */}
            {settings.showContacts !== false ? (
              <div className="price-settings-group">
                <label className="price-group-label">Контакты в документе</label>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-textMuted mb-1 block">Адрес студии</span>
                    <Input
                      type="text"
                      value={settings.studioAddress || ""}
                      onChange={(e) => handleChange("studioAddress", e.target.value)}
                      placeholder={resolvedContacts?.address || "ul. Świętojerska 5/7, Warszawa"}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-textMuted mb-1 block">Телефон студии</span>
                    <Input
                      type="text"
                      value={settings.studioPhone || ""}
                      onChange={(e) => handleChange("studioPhone", e.target.value)}
                      placeholder={resolvedContacts?.phone || "+48 572 201 114"}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* 5. CATEGORIES & SERVICES SELECTION */}
            <div className="price-settings-group">
              <div className="flex items-center justify-between mb-2">
                <label className="price-group-label" style={{ margin: 0 }}>
                  Категории и услуги
                </label>
                <span className="text-xs text-textMuted">
                  {categories.length - (settings.excludedCategoryIds?.length || 0)} из{" "}
                  {categories.length}
                </span>
              </div>

              <div className="mb-2">
                <Input
                  type="search"
                  placeholder="Поиск по категориям..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                />
              </div>

              <div className="price-categories-tree">
                {filteredCategories.map((catName) => {
                  const catServices = services.filter(
                    (s) => (s.category || "Без категории") === catName
                  );
                  const isCatExcluded = (settings.excludedCategoryIds || []).includes(catName);
                  const isExpanded = Boolean(expandedCategories[catName]);

                  return (
                    <div key={catName} className="price-tree-category-item">
                      <div className="price-tree-category-header">
                        <Checkbox
                          checked={!isCatExcluded}
                          onChange={() => handleToggleCategory(catName)}
                        />
                        <button
                          type="button"
                          className="price-tree-expand-btn"
                          onClick={() => toggleCategoryExpand(catName)}
                        >
                          <span className="price-tree-cat-name">{catName}</span>
                          <span className="price-tree-cat-count">({catServices.length})</span>
                          <AppIcon
                            name={isExpanded ? "chevronUp" : "chevronDown"}
                            size="xs"
                            className="price-tree-arrow"
                          />
                        </button>
                      </div>

                      {isExpanded && !isCatExcluded ? (
                        <div className="price-tree-services-list">
                          {catServices.map((svc) => {
                            const isSvcExcluded = (settings.excludedServiceIds || []).includes(
                              String(svc.id)
                            );
                            return (
                              <label key={svc.id} className="price-tree-service-row">
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
        ) : null}

        {/* =========================================================================
            TAB 3: ЭКСПОРТ (ФОРМАТ, КОМПОНОВКА СТРАНИЦ, СКАЧИВАНИЕ)
            ========================================================================= */}
        {activeTab === "export" ? (
          <div className="price-tab-panel">
            {/* 1. FORMAT SELECTION */}
            <div className="price-settings-group">
              <label className="price-group-label">Формат макета</label>
              <div className="price-grid-selector">
                <button
                  type="button"
                  className={`price-format-card ${
                    (settings.format || "a4") === "a4" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("format", "a4")}
                >
                  <AppIcon name="fileText" size="md" />
                  <span className="price-format-name">A4</span>
                  <span className="price-format-meta">Печать & PDF</span>
                </button>

                <button
                  type="button"
                  className={`price-format-card ${
                    settings.format === "stories" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("format", "stories")}
                >
                  <AppIcon name="smartphone" size="md" />
                  <span className="price-format-name">Stories</span>
                  <span className="price-format-meta">1080×1920</span>
                </button>

                <button
                  type="button"
                  className={`price-format-card ${settings.format === "post" ? "is-active" : ""}`}
                  onClick={() => handleChange("format", "post")}
                >
                  <AppIcon name="square" size="md" />
                  <span className="price-format-name">Post</span>
                  <span className="price-format-meta">1080×1350</span>
                </button>
              </div>
            </div>

            {/* 2. PAGE LAYOUT COMPACTION */}
            <div className="price-settings-group">
              <label className="price-group-label">Компоновка страниц</label>
              <div className="price-pill-selector">
                <button
                  type="button"
                  className={`price-pill-option ${
                    (settings.pageLayoutMode || "auto") === "auto" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("pageLayoutMode", "auto")}
                >
                  Автоматически
                </button>
                <button
                  type="button"
                  className={`price-pill-option ${
                    settings.pageLayoutMode === "compact" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("pageLayoutMode", "compact")}
                >
                  Компактно
                </button>
                <button
                  type="button"
                  className={`price-pill-option ${
                    settings.pageLayoutMode === "spacious" ? "is-active" : ""
                  }`}
                  onClick={() => handleChange("pageLayoutMode", "spacious")}
                >
                  Просторно
                </button>
              </div>
            </div>

            {/* 3. DOCUMENT STATUS SUMMARY */}
            <div className="price-export-status-card">
              <div className="price-status-row">
                <span className="price-status-label">Сформировано страниц:</span>
                <span className="price-status-val price-status-highlight">
                  {totalPages} {totalPages === 1 ? "страница" : "стр."}
                </span>
              </div>
              <div className="price-status-row">
                <span className="price-status-label">Услуг в прайсе:</span>
                <span className="price-status-val">{totalServices}</span>
              </div>
              <div className="price-status-row">
                <span className="price-status-label">Разрешение PNG:</span>
                <span className="price-status-val">
                  {settings.format === "stories"
                    ? "1080×1920 px"
                    : settings.format === "post"
                      ? "1080×1350 px"
                      : "1240×1754 px (300 DPI)"}
                </span>
              </div>
            </div>

            {/* 4. DIRECT ACTION BUTTONS */}
            <div className="price-export-buttons-stack">
              <Button
                variant="primary"
                size="md"
                leftIcon="printer"
                onClick={onPrintPdf}
                fullWidth
              >
                Печать / Сохранить в PDF
              </Button>

              <Button
                variant="secondary"
                size="md"
                leftIcon="download"
                loading={isExportingPng}
                onClick={onExportPng}
                fullWidth
              >
                Экспорт в PNG
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
