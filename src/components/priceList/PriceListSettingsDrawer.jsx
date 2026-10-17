import { useState, useRef } from "react";
import AppIcon from "../ui/AppIcon.jsx";
import IconButton from "../ui/IconButton.jsx";
import Button from "../ui/Button.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import Switch from "../ui/Switch.jsx";
import Input from "../ui/Input.jsx";
import { Tabs, TabButton } from "../ui/Tabs.jsx";
import { PRICE_LIST_LANGUAGES } from "../../utils/priceListTranslations.js";
import {
  DEFAULT_PRICE_LIST_SETTINGS,
  BACKGROUND_PRESETS,
  DESIGN_TEMPLATES,
  loadUserPresets,
  saveUserPresets,
  createPresetFromSettings,
  applyPresetToSettings,
} from "../../utils/priceListGenerator.js";

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

  // Accordion open/collapse states for Tab 1 "Оформление"
  const [openSections, setOpenSections] = useState({
    style: true,
    brand: true,
    typography: true,
    colors: false,
  });

  // User Presets State
  const [userPresets, setUserPresets] = useState(() => loadUserPresets());
  const [activePresetId, setActivePresetId] = useState(null);
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [renamingPresetId, setRenamingPresetId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const bgFileInputRef = useRef(null);
  const logoFileInputRef = useRef(null);

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

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

  // Change Design Template
  const handleSelectTemplate = (templateId) => {
    const templateDef = DESIGN_TEMPLATES[templateId];
    if (!templateDef) return;
    onUpdateSettings({
      ...settings,
      designTemplate: templateId,
      typographyFamily: templateDef.defaultTypography || settings.typographyFamily,
    });
    setActivePresetId(templateId);
  };

  // User Presets Handlers
  const handleSaveNewPreset = (e) => {
    e?.preventDefault();
    if (!newPresetName.trim()) return;
    const newPreset = createPresetFromSettings(newPresetName.trim(), settings);
    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    saveUserPresets(updated);
    setActivePresetId(newPreset.id);
    setIsCreatingPreset(false);
    setNewPresetName("");
  };

  const handleApplyPreset = (presetId) => {
    setActivePresetId(presetId);
    if (DESIGN_TEMPLATES[presetId]) {
      handleSelectTemplate(presetId);
      return;
    }
    const found = userPresets.find((p) => p.id === presetId);
    if (found) {
      const merged = applyPresetToSettings(found, settings);
      onUpdateSettings(merged);
    }
  };

  const handleUpdateCurrentPreset = () => {
    if (!activePresetId || DESIGN_TEMPLATES[activePresetId]) return;
    const updated = userPresets.map((p) => {
      if (p.id === activePresetId) {
        return createPresetFromSettings(p.name, settings);
      }
      return p;
    });
    setUserPresets(updated);
    saveUserPresets(updated);
  };

  const handleStartRename = (preset) => {
    setRenamingPresetId(preset.id);
    setRenameValue(preset.name);
  };

  const handleSaveRename = (presetId) => {
    if (!renameValue.trim()) return;
    const updated = userPresets.map((p) => {
      if (p.id === presetId) {
        return { ...p, name: renameValue.trim() };
      }
      return p;
    });
    setUserPresets(updated);
    saveUserPresets(updated);
    setRenamingPresetId(null);
  };

  const handleDeletePreset = (presetId) => {
    const updated = userPresets.filter((p) => p.id !== presetId);
    setUserPresets(updated);
    saveUserPresets(updated);
    if (activePresetId === presetId) {
      setActivePresetId("editorial");
      onUpdateSettings({
        ...settings,
        designTemplate: "editorial",
      });
    }
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
    setActivePresetId("editorial");
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

  const isUserPresetActive =
    activePresetId && !DESIGN_TEMPLATES[activePresetId] && userPresets.some((p) => p.id === activePresetId);

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
            title="Сбросить все параметры оформления к исходным"
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

      {/* PRESETS MANAGEMENT BAR */}
      <div className="price-preset-bar">
        <div className="price-preset-header-row">
          <div className="price-preset-label">
            <AppIcon name="bookmark" size="xs" />
            <span>Стиль:</span>
          </div>

          <div className="price-preset-select-wrap">
            <select
              className="price-preset-select"
              value={activePresetId || settings.designTemplate || "editorial"}
              onChange={(e) => handleApplyPreset(e.target.value)}
              aria-label="Выбрать шаблон или стиль"
            >
              <optgroup label="Базовые шаблоны NUAR">
                <option value="minimal">NUAR Minimal (Apple / Linear)</option>
                <option value="editorial">NUAR Editorial (Журнальный)</option>
                <option value="luxury">NUAR Luxury (Wellness Studio)</option>
              </optgroup>
              {userPresets.length > 0 ? (
                <optgroup label="Мои сохранённые пресеты">
                  {userPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          {!isCreatingPreset ? (
            <button
              type="button"
              className="price-btn-save-preset"
              onClick={() => setIsCreatingPreset(true)}
              title="Сохранить текущие параметры оформления как собственный пресет"
            >
              <AppIcon name="plus" size="xs" />
              <span>Сохранить</span>
            </button>
          ) : null}
        </div>

        {/* User Preset Quick Actions Bar (Update, Rename, Delete) */}
        {isUserPresetActive ? (
          <div className="price-preset-user-actions">
            <span className="price-preset-user-hint">Пользовательский стиль</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="price-preset-action-link"
                onClick={handleUpdateCurrentPreset}
                title="Перезаписать пресет текущими настройками оформления"
              >
                Обновить
              </button>
              <span className="text-textFaint">·</span>
              <button
                type="button"
                className="price-preset-action-link"
                onClick={() => {
                  const curr = userPresets.find((p) => p.id === activePresetId);
                  if (curr) handleStartRename(curr);
                }}
              >
                Переименовать
              </button>
              <span className="text-textFaint">·</span>
              <button
                type="button"
                className="price-preset-action-link is-danger"
                onClick={() => handleDeletePreset(activePresetId)}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}

        {/* Create new preset inline input */}
        {isCreatingPreset ? (
          <form className="price-preset-create-form" onSubmit={handleSaveNewPreset}>
            <Input
              type="text"
              placeholder="Название стиля (напр. Instagram Stories)..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              autoFocus
              className="price-preset-input"
            />
            <div className="price-preset-form-btns">
              <Button type="submit" variant="primary" size="sm" disabled={!newPresetName.trim()}>
                ОК
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingPreset(false);
                  setNewPresetName("");
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : null}

        {/* Rename preset inline modal */}
        {renamingPresetId ? (
          <form
            className="price-preset-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveRename(renamingPresetId);
            }}
          >
            <Input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="price-preset-input"
            />
            <div className="price-preset-form-btns">
              <Button type="submit" variant="primary" size="sm" disabled={!renameValue.trim()}>
                Сохранить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRenamingPresetId(null)}
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : null}
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
            TAB 1: ОФОРМЛЕНИЕ (РАЗБИТО НА 4 КОМПАКТНЫЕ АККОРДЕОН-ГРУППЫ: СТИЛЬ, БРЕНД, ТИПОГРАФИКА, ЦВЕТА)
            ========================================================================= */}
        {activeTab === "style" ? (
          <div className="price-tab-panel price-style-accordion-stack">
            {/* -------------------------------------------------------------
                GROUP A: СТИЛЬ (ШАБЛОН & ТЕМА)
                ------------------------------------------------------------- */}
            <div className="price-accordion-group">
              <button
                type="button"
                className="price-accordion-header"
                onClick={() => toggleSection("style")}
              >
                <div className="price-accordion-title">
                  <AppIcon name="layout" size="sm" />
                  <span>A. Стиль и шаблон</span>
                </div>
                <AppIcon
                  name={openSections.style ? "chevronUp" : "chevronDown"}
                  size="xs"
                  className="price-accordion-arrow"
                />
              </button>

              {openSections.style ? (
                <div className="price-accordion-content">
                  {/* 3 Distinct Design Templates Cards */}
                  <div className="price-template-cards-grid">
                    {Object.values(DESIGN_TEMPLATES).map((tmpl) => {
                      const isSelected =
                        (settings.designTemplate || "editorial") === tmpl.id;
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          className={`price-template-card ${isSelected ? "is-active" : ""}`}
                          onClick={() => handleSelectTemplate(tmpl.id)}
                        >
                          <div className="price-template-card-header">
                            <span className="price-template-name">{tmpl.name}</span>
                            <span className="price-template-tag">{tmpl.tagline}</span>
                          </div>
                          <p className="price-template-desc">{tmpl.description}</p>
                          <div className={`price-template-mini-preview tmpl-mini-${tmpl.id}`} aria-hidden="true">
                            <div className="tmpl-mini-line-brand" />
                            <div className="tmpl-mini-line-cat" />
                            <div className="tmpl-mini-line-svc" />
                            <div className="tmpl-mini-matrix-row">
                              <span className="tmpl-mini-cell" />
                              <span className="tmpl-mini-cell" />
                              <span className="tmpl-mini-cell" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dark / Light Scheme Switcher */}
                  <div className="price-subfield-block mt-3">
                    <div className="price-subfield-label">Базовая тема</div>
                    <div className="price-pill-selector">
                      <button
                        type="button"
                        className={`price-pill-option ${
                          (settings.theme || "dark") === "dark" ? "is-active" : ""
                        }`}
                        onClick={() => {
                          onUpdateSettings({
                            ...settings,
                            theme: "dark",
                            bgPreset: settings.bgPreset === "white" || settings.bgPreset === "cream" ? "nuar-dark" : settings.bgPreset,
                          });
                        }}
                      >
                        <span className="price-theme-dot" style={{ backgroundColor: "#0d0d0f" }} />
                        Тёмная
                      </button>
                      <button
                        type="button"
                        className={`price-pill-option ${
                          settings.theme === "light" ? "is-active" : ""
                        }`}
                        onClick={() => {
                          onUpdateSettings({
                            ...settings,
                            theme: "light",
                            bgPreset: settings.bgPreset === "nuar-dark" || settings.bgPreset === "warm-graphite" ? "cream" : settings.bgPreset,
                          });
                        }}
                      >
                        <span className="price-theme-dot" style={{ backgroundColor: "#f7f5f0" }} />
                        Светлая
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* -------------------------------------------------------------
                GROUP B: БРЕНД (ЛОГОТИП, РАЗМЕР, ПОЗИЦИЯ)
                ------------------------------------------------------------- */}
            <div className="price-accordion-group">
              <button
                type="button"
                className="price-accordion-header"
                onClick={() => toggleSection("brand")}
              >
                <div className="price-accordion-title">
                  <AppIcon name="award" size="sm" />
                  <span>B. Бренд и логотип</span>
                </div>
                <AppIcon
                  name={openSections.brand ? "chevronUp" : "chevronDown"}
                  size="xs"
                  className="price-accordion-arrow"
                />
              </button>

              {openSections.brand ? (
                <div className="price-accordion-content">
                  <div className="price-group-header-with-switch mb-3">
                    <span className="text-sm font-medium text-textPrimary">Отображать логотип</span>
                    <Switch
                      checked={settings.showLogo !== false}
                      onChange={(e) => handleChange("showLogo", e.target.checked)}
                    />
                  </div>

                  {settings.showLogo !== false ? (
                    <div className="space-y-3">
                      {/* Logo Source Type */}
                      <div className="price-subfield-block">
                        <div className="price-subfield-label">Тип логотипа</div>
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
                            Только текст
                          </button>
                        </div>
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
                              Загрузить логотип (PNG / SVG)
                            </Button>
                          )}
                        </div>
                      ) : null}

                      {/* Logo Size and Alignment */}
                      <div className="price-subfield-block">
                        <div className="price-subfield-label">Размер и выравнивание</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="price-pill-selector">
                            <button
                              type="button"
                              className={`price-pill-option ${
                                settings.logoSize === "sm" ? "is-active" : ""
                              }`}
                              onClick={() => handleChange("logoSize", "sm")}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              className={`price-pill-option ${
                                (settings.logoSize || "md") === "md" ? "is-active" : ""
                              }`}
                              onClick={() => handleChange("logoSize", "md")}
                            >
                              M
                            </button>
                            <button
                              type="button"
                              className={`price-pill-option ${
                                settings.logoSize === "lg" ? "is-active" : ""
                              }`}
                              onClick={() => handleChange("logoSize", "lg")}
                            >
                              L
                            </button>
                          </div>

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
                              Центр
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
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* -------------------------------------------------------------
                GROUP C: ТИПОГРАФИКА (ШРИФТ, РАЗМЕР, ПЛОТНОСТЬ)
                ------------------------------------------------------------- */}
            <div className="price-accordion-group">
              <button
                type="button"
                className="price-accordion-header"
                onClick={() => toggleSection("typography")}
              >
                <div className="price-accordion-title">
                  <AppIcon name="type" size="sm" />
                  <span>C. Типографика</span>
                </div>
                <AppIcon
                  name={openSections.typography ? "chevronUp" : "chevronDown"}
                  size="xs"
                  className="price-accordion-arrow"
                />
              </button>

              {openSections.typography ? (
                <div className="price-accordion-content space-y-3">
                  {/* Compact Font Selection */}
                  <div className="price-subfield-block">
                    <div className="price-subfield-label">Гарнитура шрифта</div>
                    <div className="price-font-compact-grid">
                      <button
                        type="button"
                        className={`price-font-compact-btn ${
                          (settings.typographyFamily || "editorial") === "editorial"
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() => handleChange("typographyFamily", "editorial")}
                      >
                        <span className="font-editorial-sample text-sm font-semibold">
                          Editorial Serif
                        </span>
                        <span className="text-[10px] text-textMuted block">Playfair + Inter</span>
                      </button>

                      <button
                        type="button"
                        className={`price-font-compact-btn ${
                          settings.typographyFamily === "modern" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("typographyFamily", "modern")}
                      >
                        <span className="font-modern-sample text-sm font-semibold">
                          Modern Sans
                        </span>
                        <span className="text-[10px] text-textMuted block">Inter Minimalist</span>
                      </button>

                      <button
                        type="button"
                        className={`price-font-compact-btn ${
                          settings.typographyFamily === "luxury" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("typographyFamily", "luxury")}
                      >
                        <span className="font-luxury-sample text-sm font-semibold">
                          Luxury Cinzel
                        </span>
                        <span className="text-[10px] text-textMuted block">Cinzel + Playfair</span>
                      </button>

                      <button
                        type="button"
                        className={`price-font-compact-btn ${
                          settings.typographyFamily === "classic" ? "is-active" : ""
                        }`}
                        onClick={() => handleChange("typographyFamily", "classic")}
                      >
                        <span className="font-classic-sample text-sm font-semibold">
                          Classic Georgia
                        </span>
                        <span className="text-[10px] text-textMuted block">Georgia Book</span>
                      </button>
                    </div>
                  </div>

                  {/* Text Size Scale */}
                  <div className="price-subfield-block">
                    <div className="price-subfield-label">Размер основного текста</div>
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
              ) : null}
            </div>

            {/* -------------------------------------------------------------
                GROUP D: ЦВЕТА И ФОН (ПРЕСЕТЫ, КАСТОМНЫЙ ЦВЕТ, ФОТО)
                ------------------------------------------------------------- */}
            <div className="price-accordion-group">
              <button
                type="button"
                className="price-accordion-header"
                onClick={() => toggleSection("colors")}
              >
                <div className="price-accordion-title">
                  <AppIcon name="paintBucket" size="sm" />
                  <span>D. Цвета и фон</span>
                </div>
                <AppIcon
                  name={openSections.colors ? "chevronUp" : "chevronDown"}
                  size="xs"
                  className="price-accordion-arrow"
                />
              </button>

              {openSections.colors ? (
                <div className="price-accordion-content space-y-3">
                  {/* Background Presets */}
                  <div className="price-subfield-block">
                    <div className="price-subfield-label">Фон документа</div>
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
                      <div className="price-custom-color-row mt-2">
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
                  </div>

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

                    {/* Opacity slider */}
                    {settings.bgImage ? (
                      <div className="price-slider-group mt-2">
                        <div className="price-slider-header">
                          <span>Затемнение фона</span>
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

                  {/* Text Contrast Mode */}
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
              ) : null}
            </div>
          </div>
        ) : null}

        {/* =========================================================================
            TAB 2: СОДЕРЖИМОЕ (ЯЗЫК, РЕЖИМ ЦЕН, КОНТАКТЫ, КАТЕГОРИИ И УСЛУГИ)
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
