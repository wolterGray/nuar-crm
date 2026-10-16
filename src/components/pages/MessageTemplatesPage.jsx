import {useMemo, useRef, useState} from "react";
import "./MessageTemplatesPage.css";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {AppIcon, Button, IconButton} from "../ui/index.js";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  updateMessageTemplate,
} from "../../api/operations.js";
import {
  buildClientContext,
  DEFAULT_DEMO_CONTEXT,
  DYNAMIC_VARIABLES,
  findClientAppointments,
  normalizeTemplateList,
  substituteVariables,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
} from "../../utils/templateManager.js";

function MessageTemplatesPage({
  appSettings = {},
  calendarEntries = [],
  clients = [],
  employees = [],
  masters = [],
  onClearPreferredClient,
  onMessageSent,
  onNotify,
  preferredClientId = "",
  setMessageTemplates,
  templates = [],
}) {
  const {isMobile} = useBreakpoint();

  // Normalized template list with NUAR starter templates fallback
  const normalizedTemplates = useMemo(
    () => normalizeTemplateList(templates),
    [templates],
  );

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active"); // 'active' | 'all' | 'archived'

  // Selected template & language state
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    const firstActive = normalizedTemplates.find((t) => !t.archived) || normalizedTemplates[0];
    return firstActive ? String(firstActive.id) : "";
  });
  const [activeLanguage, setActiveLanguage] = useState("pl"); // 'pl' | 'ru' | 'ua' | 'en'
  const [mobilePane, setMobilePane] = useState(preferredClientId ? "workspace" : "list"); // 'list' | 'workspace'

  // Editable local draft state for selected template
  const selectedTemplate = useMemo(
    () => normalizedTemplates.find((t) => String(t.id) === String(selectedTemplateId)) || null,
    [normalizedTemplates, selectedTemplateId],
  );

  const [prevTemplateId, setPrevTemplateId] = useState(() => selectedTemplate?.id);
  const [draftName, setDraftName] = useState(() => selectedTemplate?.name || "");
  const [draftCategory, setDraftCategory] = useState(() => selectedTemplate?.category || "booking_confirmation");
  const [draftTranslations, setDraftTranslations] = useState(() => ({
    pl: selectedTemplate?.translations?.pl || "",
    ru: selectedTemplate?.translations?.ru || "",
    ua: selectedTemplate?.translations?.ua || "",
    en: selectedTemplate?.translations?.en || "",
  }));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preview context state (Demo vs Real Client)
  const [prevPreferredId, setPrevPreferredId] = useState(preferredClientId);
  const [contextMode, setContextMode] = useState(preferredClientId ? "client" : "demo");
  const [selectedClientId, setSelectedClientId] = useState(preferredClientId ? String(preferredClientId) : "");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [variableOverrides, setVariableOverrides] = useState({});
  const [copySuccess, setCopySuccess] = useState(false);

  // Textarea reference for inserting variables at cursor
  const textareaRef = useRef(null);

  // Sync draft whenever selected template changes (render-time adjustment)
  if (selectedTemplate && selectedTemplate.id !== prevTemplateId) {
    setPrevTemplateId(selectedTemplate.id);
    setDraftName(selectedTemplate.name || "");
    setDraftCategory(selectedTemplate.category || "booking_confirmation");
    setDraftTranslations({
      pl: selectedTemplate.translations?.pl || "",
      ru: selectedTemplate.translations?.ru || "",
      ua: selectedTemplate.translations?.ua || "",
      en: selectedTemplate.translations?.en || "",
    });
    setIsDirty(false);
  }

  // Handle preferred client from navigation (render-time adjustment)
  if (preferredClientId && preferredClientId !== prevPreferredId) {
    setPrevPreferredId(preferredClientId);
    setSelectedClientId(String(preferredClientId));
    setContextMode("client");
    setMobilePane("workspace");
    setVariableOverrides({});
  }

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return normalizedTemplates.filter((item) => {
      // Status filter
      if (statusFilter === "active" && item.archived) return false;
      if (statusFilter === "archived" && !item.archived) return false;

      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

      // Search query across name and all translations
      if (query) {
        const texts = [
          item.name,
          item.translations?.pl,
          item.translations?.ru,
          item.translations?.ua,
          item.translations?.en,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!texts.includes(query)) return false;
      }

      return true;
    });
  }, [normalizedTemplates, searchQuery, selectedCategory, statusFilter]);

  // Client preview data calculation
  const targetClient = useMemo(
    () => clients.find((c) => String(c.id) === String(selectedClientId)) || null,
    [clients, selectedClientId],
  );

  const clientAppointments = useMemo(
    () => findClientAppointments(targetClient, calendarEntries),
    [targetClient, calendarEntries],
  );

  const effectiveAppointmentId =
    selectedAppointmentId && clientAppointments.some((a) => String(a.id) === String(selectedAppointmentId))
      ? selectedAppointmentId
      : clientAppointments[0]?.id
        ? String(clientAppointments[0].id)
        : "";

  const activeAppointment = useMemo(
    () =>
      clientAppointments.find((a) => String(a.id) === String(effectiveAppointmentId)) ||
      clientAppointments[0] ||
      null,
    [clientAppointments, effectiveAppointmentId],
  );

  // Masters available for selection
  const mastersList = useMemo(() => {
    let raw = [];
    if (Array.isArray(masters) && masters.length > 0) {
      raw = masters;
    } else if (Array.isArray(employees) && employees.length > 0) {
      raw = employees
        .filter((emp) => String(emp.status ?? "").trim() !== "Архив")
        .map((emp) => emp.name)
        .filter(Boolean);
    }
    const set = [...new Set(raw.filter(Boolean))];
    return set.length > 0 ? set : ["Natali"];
  }, [masters, employees]);

  // Base context from client visit or studio settings defaults
  const baseContext = useMemo(() => {
    if (contextMode === "client" && targetClient) {
      return buildClientContext(targetClient, activeAppointment, appSettings);
    }
    return {
      ...DEFAULT_DEMO_CONTEXT,
      studio_address: appSettings?.studioAddress || DEFAULT_DEMO_CONTEXT.studio_address,
      studio_name: appSettings?.studioName || DEFAULT_DEMO_CONTEXT.studio_name,
    };
  }, [contextMode, targetClient, activeAppointment, appSettings]);

  // Build current context for substitution: base + any user overrides
  const effectiveContext = useMemo(() => {
    const merged = {...baseContext};
    for (const [key, val] of Object.entries(variableOverrides)) {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        merged[key] = String(val).trim();
      }
    }
    return merged;
  }, [baseContext, variableOverrides]);

  const activeOverridesCount = useMemo(() => {
    return Object.entries(variableOverrides).filter(([key, val]) => {
      if (val === undefined || val === null || String(val).trim() === "") return false;
      return String(val).trim() !== String(baseContext[key] ?? "").trim();
    }).length;
  }, [variableOverrides, baseContext]);

  const handleOverrideChange = (key, value) => {
    setVariableOverrides((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetOverrides = () => {
    setVariableOverrides({});
  };

  // Active template text for the selected language
  const currentLanguageText = draftTranslations[activeLanguage] || "";

  // Rendered text with variables substituted
  const {text: renderedPreviewText, missing: missingVariables} = useMemo(
    () => substituteVariables(currentLanguageText, effectiveContext),
    [currentLanguageText, effectiveContext],
  );

  // Navigation / Template Switcher with unsaved changes guard
  const handleSelectTemplate = (templateId) => {
    if (isDirty) {
      const confirmLeave = window.confirm("У вас есть несохранённые изменения в текущем шаблоне. Переключиться без сохранения?");
      if (!confirmLeave) return;
    }
    setSelectedTemplateId(templateId);
    if (isMobile) {
      setMobilePane("workspace");
    }
  };

  // Draft change helpers
  const handleNameChange = (e) => {
    setDraftName(e.target.value);
    setIsDirty(true);
  };

  const handleCategoryChange = (e) => {
    setDraftCategory(e.target.value);
    setIsDirty(true);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setDraftTranslations((prev) => ({
      ...prev,
      [activeLanguage]: val,
    }));
    setIsDirty(true);
  };

  // Insert variable into cursor position
  const handleInsertVariable = (varKey) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraftTranslations((prev) => ({
        ...prev,
        [activeLanguage]: (prev[activeLanguage] || "") + varKey,
      }));
      setIsDirty(true);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentText = draftTranslations[activeLanguage] || "";
    const updated = currentText.substring(0, start) + varKey + currentText.substring(end);

    setDraftTranslations((prev) => ({
      ...prev,
      [activeLanguage]: updated,
    }));
    setIsDirty(true);

    // Reposition cursor right after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + varKey.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 10);
  };

  // Save changes
  const handleSave = async () => {
    if (!draftName.trim()) {
      onNotify?.({title: "Ошибка", message: "Укажите название шаблона"});
      return;
    }

    setIsSaving(true);
    const updatedPayload = {
      ...(selectedTemplate || {}),
      name: draftName.trim(),
      category: draftCategory,
      purpose: draftCategory,
      archived: selectedTemplate?.archived || false,
      channel: selectedTemplate?.channel || "SMS",
      language: activeLanguage === "pl" ? "Польский" : activeLanguage === "ru" ? "Русский" : activeLanguage === "ua" ? "Украинский" : "Английский",
      body: draftTranslations[activeLanguage] || draftTranslations.pl || draftTranslations.ru || "",
      translations: draftTranslations,
      payload: {
        ...(selectedTemplate?.payload || {}),
        category: draftCategory,
        archived: selectedTemplate?.archived || false,
        translations: draftTranslations,
      },
    };

    try {
      const isNew = String(selectedTemplate?.id || "").startsWith("new-") || !selectedTemplate?.id;
      let saved;

      if (isNew) {
        const response = await createMessageTemplate(updatedPayload);
        saved = response?.data || {...updatedPayload, id: Date.now()};
      } else {
        const response = await updateMessageTemplate(selectedTemplate.id, updatedPayload);
        saved = response?.data || updatedPayload;
      }

      setMessageTemplates?.((current = []) => {
        const existing = current.find((item) => String(item.id) === String(saved.id));
        if (existing) {
          return current.map((item) => (String(item.id) === String(saved.id) ? saved : item));
        }
        return [saved, ...current];
      });

      setSelectedTemplateId(String(saved.id));
      setIsDirty(false);
      onNotify?.({
        title: "Шаблон сохранён",
        message: `«${saved.name}» успешно обновлен`,
      });
    } catch (err) {
      onNotify?.({
        title: "Не удалось сохранить",
        message: err?.message || "Проверьте соединение с сервером",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Create new template draft
  const handleCreateNew = () => {
    if (isDirty) {
      const confirmLeave = window.confirm("У вас есть несохранённые изменения. Создать новый шаблон?");
      if (!confirmLeave) return;
    }

    const newId = `new-${Date.now()}`;
    const newTemplate = {
      id: newId,
      name: "Новый шаблон",
      category: selectedCategory !== "all" ? selectedCategory : "booking_confirmation",
      channel: "SMS",
      archived: false,
      translations: {
        pl: "",
        ru: "",
        ua: "",
        en: "",
      },
      body: "",
      language: "Польский",
    };

    setMessageTemplates?.((current = []) => [newTemplate, ...current]);
    setSelectedTemplateId(newId);
    setIsDirty(true);
    if (isMobile) {
      setMobilePane("workspace");
    }
  };

  // Duplicate current template
  const handleDuplicate = async () => {
    if (!selectedTemplate) return;
    const duplicatedName = `${draftName.trim() || selectedTemplate.name} (копия)`;
    const newPayload = {
      ...selectedTemplate,
      id: undefined,
      name: duplicatedName,
      category: draftCategory,
      translations: draftTranslations,
      body: draftTranslations[activeLanguage] || selectedTemplate.body || "",
      payload: {
        ...(selectedTemplate.payload || {}),
        category: draftCategory,
        translations: draftTranslations,
      },
    };

    try {
      const response = await createMessageTemplate(newPayload);
      const saved = response?.data || {...newPayload, id: Date.now()};

      setMessageTemplates?.((current = []) => [saved, ...current]);
      setSelectedTemplateId(String(saved.id));
      onNotify?.({
        title: "Шаблон продублирован",
        message: `Создана копия: «${duplicatedName}»`,
      });
    } catch {
      const fallback = {...newPayload, id: Date.now()};
      setMessageTemplates?.((current = []) => [fallback, ...current]);
      setSelectedTemplateId(String(fallback.id));
    }
  };

  // Toggle archive
  const handleToggleArchive = async () => {
    if (!selectedTemplate) return;
    const nextArchived = !selectedTemplate.archived;
    const updated = {
      ...selectedTemplate,
      archived: nextArchived,
      payload: {
        ...(selectedTemplate.payload || {}),
        archived: nextArchived,
      },
    };

    try {
      await updateMessageTemplate(selectedTemplate.id, updated);
      setMessageTemplates?.((current = []) =>
        current.map((item) => (String(item.id) === String(selectedTemplate.id) ? updated : item)),
      );
      onNotify?.({
        title: nextArchived ? "В архиве" : "Восстановлен",
        message: nextArchived ? `«${selectedTemplate.name}» перемещён в архив` : `«${selectedTemplate.name}» восстановлен`,
      });
    } catch {
      setMessageTemplates?.((current = []) =>
        current.map((item) => (String(item.id) === String(selectedTemplate.id) ? updated : item)),
      );
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!selectedTemplate) return;
    const confirmDelete = window.confirm(`Удалить шаблон «${selectedTemplate.name}» безвозвратно?`);
    if (!confirmDelete) return;

    try {
      await deleteMessageTemplate(selectedTemplate.id);
      setMessageTemplates?.((current = []) =>
        current.filter((item) => String(item.id) !== String(selectedTemplate.id)),
      );
      onNotify?.({
        title: "Шаблон удалён",
        message: `«${selectedTemplate.name}» удалён`,
      });
      // Select another template
      const remaining = normalizedTemplates.filter((t) => String(t.id) !== String(selectedTemplate.id));
      if (remaining.length > 0) {
        setSelectedTemplateId(String(remaining[0].id));
      }
    } catch (err) {
      onNotify?.({
        title: "Ошибка удаления",
        message: err?.message || "Не удалось удалить шаблон",
      });
    }
  };

  // Copy rendered message text to clipboard
  const handleCopyMessage = async () => {
    if (!renderedPreviewText.trim()) return;

    try {
      await navigator.clipboard.writeText(renderedPreviewText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2400);

      onNotify?.({
        title: "Текст скопирован",
        message: targetClient ? `Сообщение для ${targetClient.name} готово к отправке` : "Текст скопирован в буфер обмена",
      });

      if (targetClient && onMessageSent) {
        onMessageSent({
          client: targetClient,
          channel: "Копирование",
          template: selectedTemplate,
          body: renderedPreviewText,
        });
      }
    } catch {
      onNotify?.({
        title: "Ошибка",
        message: "Разрешите доступ к буферу обмена браузера",
      });
    }
  };

  // Quick copy directly from template list card
  const handleQuickCopyTemplate = async (template, e) => {
    e.stopPropagation();
    const rawText =
      template.translations?.[activeLanguage] ||
      template.translations?.pl ||
      template.translations?.ru ||
      template.body ||
      "";
    if (!rawText.trim()) return;
    const {text: rendered} = substituteVariables(rawText, effectiveContext);
    try {
      await navigator.clipboard.writeText(rendered);
      onNotify?.({
        title: "Текст скопирован",
        message: `Шаблон «${template.name}» скопирован в буфер обмена`,
      });
    } catch {
      onNotify?.({
        title: "Ошибка",
        message: "Разрешите доступ к буферу обмена браузера",
      });
    }
  };

  // Open external channel
  const handleOpenChannel = (channel) => {
    if (!renderedPreviewText.trim()) return;

    void handleCopyMessage();

    if (channel === "whatsapp") {
      const phone = String(targetClient?.phone || "").replace(/\D/g, "");
      if (phone.length >= 7) {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(renderedPreviewText)}`, "_blank", "noopener,noreferrer");
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(renderedPreviewText)}`, "_blank", "noopener,noreferrer");
      }
    } else if (channel === "telegram") {
      const tg = String(targetClient?.telegram || "").trim().replace(/^@/, "");
      if (tg) {
        window.open(`https://t.me/${tg}`, "_blank", "noopener,noreferrer");
      }
    } else if (channel === "sms") {
      const phone = String(targetClient?.phone || "").replace(/[^\d+]/g, "");
      window.open(`sms:${phone}?body=${encodeURIComponent(renderedPreviewText)}`, "_self");
    } else if (channel === "instagram") {
      const insta = String(targetClient?.instagram || "").trim().replace(/^@/, "");
      if (insta) {
        window.open(`https://www.instagram.com/${insta}/`, "_blank", "noopener,noreferrer");
      }
    }
  };

  // SMS length calculation
  const currentCharsCount = currentLanguageText.length;
  const isCyrillic = /[а-яёіїє]/i.test(currentLanguageText);
  const smsMaxFirst = isCyrillic ? 70 : 160;
  const smsMaxNext = isCyrillic ? 67 : 153;
  const smsSegments = currentCharsCount <= smsMaxFirst ? (currentCharsCount > 0 ? 1 : 0) : Math.ceil(currentCharsCount / smsMaxNext);

  return (
    <section className="templates-workspace nuar-templates" aria-label="Шаблоны сообщений">
      {/* 1. Header Bar */}
      <header className="templates-top-bar">
        <div className="templates-top-title-wrap">
          <div className="templates-top-title-row">
            <h1 className="templates-top-title">Шаблоны</h1>
            {isMobile && mobilePane === "workspace" ? (
              <Button size="xs" variant="ghost" onClick={() => setMobilePane("list")}>
                ← К списку
              </Button>
            ) : null}
          </div>
          <p className="templates-top-subtitle">
            Быстрые ответы и шаблоны сообщений для массажной студии Nuar
          </p>
        </div>

        <div className="templates-top-actions">
          {/* Search */}
          <div className="templates-search-wrap">
            <AppIcon className="templates-search-icon" name="search" size="xs" />
            <input
              className="templates-search-input"
              placeholder="Поиск по названию или тексту..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button aria-label="Очистить" className="templates-search-clear" type="button" onClick={() => setSearchQuery("")}>
                <AppIcon name="x" size="xs" />
              </button>
            ) : null}
          </div>

          {/* Status filter: Active / All / Archive */}
          <div className="templates-filter-segmented" role="radiogroup" aria-label="Статус шаблонов">
            <button
              className={`templates-filter-seg-btn ${statusFilter === "active" ? "is-active" : ""}`}
              type="button"
              onClick={() => setStatusFilter("active")}
            >
              Активные
            </button>
            <button
              className={`templates-filter-seg-btn ${statusFilter === "all" ? "is-active" : ""}`}
              type="button"
              onClick={() => setStatusFilter("all")}
            >
              Все
            </button>
            <button
              className={`templates-filter-seg-btn ${statusFilter === "archived" ? "is-active" : ""}`}
              type="button"
              onClick={() => setStatusFilter("archived")}
            >
              Архив
            </button>
          </div>

          {/* Create Template CTA Button */}
          <Button
            className="templates-create-btn"
            leftIcon="plus"
            size="sm"
            variant="primary"
            onClick={handleCreateNew}
          >
            Создать шаблон
          </Button>
        </div>
      </header>

      {/* 2. Main Workspace Layout (Two-column) */}
      <div className="templates-main-grid">
        {/* Left Column: Template Library */}
        <aside className={`templates-sidebar ${isMobile && mobilePane !== "list" ? "is-mobile-hidden" : ""}`}>
          {/* Categories Horizontal Pills Bar */}
          <div className="templates-categories-bar" role="tablist" aria-label="Категории шаблонов">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`templates-cat-chip ${selectedCategory === cat.id ? "is-active" : ""}`}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <AppIcon name={cat.icon} size="xs" />
                <span>{cat.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Templates List */}
          <div className="templates-list-scroll">
            {filteredTemplates.map((template) => {
              const isSelected = String(template.id) === String(selectedTemplateId);
              const previewSnippet =
                template.translations?.[activeLanguage] ||
                template.translations?.pl ||
                template.translations?.ru ||
                template.body ||
                "Нет текста";

              const categoryMeta =
                TEMPLATE_CATEGORIES.find((c) => c.id === template.category) ||
                TEMPLATE_CATEGORIES.find((c) => c.id === "other");

              return (
                <div
                  key={template.id}
                  className={`template-item-card ${isSelected ? "is-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTemplate(String(template.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTemplate(String(template.id));
                    }
                  }}
                >
                  <div className="template-item-head">
                    <h3 className="template-item-title">{template.name}</h3>
                    {template.archived ? (
                      <span className="template-archived-tag">Архив</span>
                    ) : (
                      <span className="template-item-cat-badge">
                        <AppIcon name={categoryMeta.icon} size="xs" />
                        {categoryMeta.shortLabel}
                      </span>
                    )}
                  </div>

                  <p className="template-item-snippet">{previewSnippet}</p>

                  <div className="template-item-footer">
                    <div className="template-lang-dots">
                      {TEMPLATE_LANGUAGES.map((lang) => {
                        const hasText = Boolean(template.translations?.[lang.code]?.trim());
                        return (
                          <span
                            key={lang.code}
                            className={`template-lang-pill ${hasText ? "has-translation" : "no-translation"}`}
                            title={`${lang.name}: ${hasText ? "заполнено" : "нет перевода"}`}
                          >
                            {lang.label}
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="template-item-quick-copy-btn"
                      onClick={(e) => handleQuickCopyTemplate(template, e)}
                      aria-label={`Скопировать шаблон ${template.name}`}
                    >
                      <AppIcon name="copy" size="xs" />
                      <span>Копировать</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTemplates.length === 0 ? (
              <div className="templates-empty-library">
                <AppIcon name="message" size="lg" />
                <strong>Шаблоны не найдены</strong>
                <span>Попробуйте изменить категорию или поисковый запрос.</span>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Right Column: Active Workspace (Editor & Preview) */}
        <main className={`templates-workspace-area ${isMobile && mobilePane !== "workspace" ? "is-mobile-hidden" : ""}`}>
          {selectedTemplate ? (
            <>
              {/* Workspace Header */}
              <div className="templates-workspace-header">
                <div className="templates-workspace-meta-row">
                  <input
                    aria-label="Название шаблона"
                    className="templates-workspace-title-input"
                    placeholder="Название шаблона..."
                    type="text"
                    value={draftName}
                    onChange={handleNameChange}
                  />

                  <select
                    aria-label="Категория"
                    className="templates-category-select"
                    value={draftCategory}
                    onChange={handleCategoryChange}
                  >
                    {TEMPLATE_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-language Selector */}
                <div className="templates-lang-selector" role="tablist" aria-label="Язык шаблона">
                  {TEMPLATE_LANGUAGES.map((lang) => {
                    const hasText = Boolean(draftTranslations[lang.code]?.trim());
                    const isActive = activeLanguage === lang.code;

                    return (
                      <button
                        key={lang.code}
                        className={`templates-lang-btn ${isActive ? "is-active" : ""}`}
                        title={`${lang.name} ${hasText ? "(есть перевод)" : "(нет перевода)"}`}
                        type="button"
                        onClick={() => setActiveLanguage(lang.code)}
                      >
                        <span className={`templates-lang-status-dot ${hasText ? "is-present" : "is-empty"}`} />
                        <span>{lang.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Workspace Top Actions */}
                <div className="templates-workspace-actions">
                  <Button
                    disabled={!isDirty || isSaving}
                    leftIcon="save"
                    size="xs"
                    variant={isDirty ? "primary" : "secondary"}
                    onClick={handleSave}
                  >
                    {isSaving ? "Сохраняем..." : "Сохранить"}
                  </Button>
                  <IconButton
                    icon="copy"
                    label="Дублировать шаблон"
                    size="xs"
                    title="Дублировать шаблон"
                    variant="ghost"
                    onClick={handleDuplicate}
                  />
                  <IconButton
                    icon={selectedTemplate.archived ? "rotateCcw" : "package"}
                    label={selectedTemplate.archived ? "Восстановить из архива" : "В архив"}
                    size="xs"
                    title={selectedTemplate.archived ? "Восстановить из архива" : "В архив"}
                    variant="ghost"
                    onClick={handleToggleArchive}
                  />
                  <IconButton
                    icon="trash"
                    label="Удалить шаблон"
                    size="xs"
                    title="Удалить шаблон"
                    variant="danger"
                    onClick={handleDelete}
                  />
                </div>
              </div>

              {/* Unified Workspace: Compact Editor + Live Preview & Quick Send */}
              <div className="templates-unified-workspace">
                {/* 1. Compact Editor Card */}
                <div className="templates-editor-card">
                  {/* Variables Bar */}
                  <div className="templates-variables-bar">
                    <div className="templates-variables-header">
                      <div className="templates-variables-title-group">
                        <AppIcon name="sparkles" size="xs" />
                        <span className="templates-variables-title">Переменные автоподстановки</span>
                      </div>
                      <span className="templates-variables-hint">
                        Подставят реальные данные клиента при копировании
                      </span>
                    </div>
                    <div className="templates-variables-chips">
                      {DYNAMIC_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          className="templates-var-chip-btn"
                          title={`Вставить «${v.label}» (пример: ${v.sample})`}
                          type="button"
                          onClick={() => handleInsertVariable(v.key)}
                        >
                          <span className="templates-var-chip-label">{v.label}</span>
                          <code className="templates-var-chip-code">{v.key}</code>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message Textarea */}
                  <div className="templates-textarea-wrap">
                    <textarea
                      ref={textareaRef}
                      aria-label={`Текст сообщения на ${activeLanguage.toUpperCase()}`}
                      className="templates-textarea"
                      placeholder={`Напишите текст сообщения на ${activeLanguage.toUpperCase()}...`}
                      rows={4}
                      value={draftTranslations[activeLanguage] || ""}
                      onChange={handleTextChange}
                    />
                    <div className="templates-textarea-meta">
                      <span className="templates-char-counter">
                        {currentCharsCount} символов • {smsSegments} SMS {isCyrillic ? "(кириллица)" : "(латиница)"}
                      </span>
                      {isDirty ? (
                        <span className="templates-dirty-indicator">
                          ● Есть несохранённые изменения
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 2. Live Preview & Quick Send Card */}
                <div className="templates-preview-card">
                  {/* Context selector panel */}
                  <div className="templates-context-panel">
                    <div className="templates-context-header">
                      <div className="templates-preview-title-group">
                        <AppIcon name="eye" size="xs" />
                        <span className="templates-preview-title">Готовое сообщение для отправки</span>
                      </div>
                      <div className="templates-context-mode-switch" role="radiogroup">
                        <button
                          className={`templates-context-mode-btn ${contextMode === "demo" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => {
                            setContextMode("demo");
                            setVariableOverrides({});
                            onClearPreferredClient?.();
                          }}
                        >
                          Демо-данные
                        </button>
                        <button
                          className={`templates-context-mode-btn ${contextMode === "client" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => {
                            setContextMode("client");
                            setVariableOverrides({});
                          }}
                        >
                          Клиент из CRM
                        </button>
                      </div>
                    </div>

                    {/* Client & Appointment Selector (when in Client mode) */}
                    {contextMode === "client" ? (
                      <div className="templates-client-select-wrap">
                        <select
                          aria-label="Выбрать клиента"
                          className="templates-client-select"
                          value={selectedClientId}
                          onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setSelectedAppointmentId("");
                            setVariableOverrides({});
                          }}
                        >
                          <option value="">— Выберите клиента —</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ""}
                            </option>
                          ))}
                        </select>

                        {targetClient ? (
                          <select
                            aria-label="Запись клиента"
                            className="templates-appointment-select"
                            value={effectiveAppointmentId}
                            onChange={(e) => {
                              setSelectedAppointmentId(e.target.value);
                              setVariableOverrides({});
                            }}
                          >
                            {clientAppointments.length === 0 ? (
                              <option value="">У клиента нет визитов в календаре</option>
                            ) : (
                              clientAppointments.map((app) => (
                                <option key={app.id} value={app.id}>
                                  {app.date} {app.time} — {app.service || "Услуга"} ({app.master || "Мастер"})
                                </option>
                              ))
                            )}
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Quick Variables Override Panel */}
                  <div className="templates-quick-vars-panel">
                    <div className="templates-quick-vars-head">
                      <div className="templates-quick-vars-title">
                        <AppIcon name="sliders" size="xs" />
                        <span>Значения для автоподстановки</span>
                        <span className="templates-quick-vars-hint">
                          (измените прямо здесь перед отправкой — не нужно править в телефоне)
                        </span>
                      </div>
                      {activeOverridesCount > 0 ? (
                        <button
                          type="button"
                          className="templates-quick-vars-reset-btn"
                          onClick={handleResetOverrides}
                          title="Сбросить к значениям CRM"
                        >
                          <AppIcon name="rotateCcw" size="xs" />
                          <span>Сбросить замену ({activeOverridesCount})</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="templates-quick-vars-grid">
                      {/* Client Name */}
                      <div className="templates-quick-field">
                        <label className="templates-quick-field-label">Клиент</label>
                        <input
                          type="text"
                          className={`templates-quick-field-input ${variableOverrides.client_name ? "is-overridden" : ""}`}
                          placeholder={baseContext.client_name || "Имя клиента"}
                          value={variableOverrides.client_name ?? ""}
                          onChange={(e) => handleOverrideChange("client_name", e.target.value)}
                        />
                      </div>

                      {/* Master Name with datalist of real masters */}
                      <div className="templates-quick-field">
                        <label className="templates-quick-field-label">Мастер</label>
                        <input
                          type="text"
                          list="nuar-masters-datalist"
                          className={`templates-quick-field-input ${variableOverrides.master_name ? "is-overridden" : ""}`}
                          placeholder={baseContext.master_name || "Имя мастера"}
                          value={variableOverrides.master_name ?? ""}
                          onChange={(e) => handleOverrideChange("master_name", e.target.value)}
                        />
                        <datalist id="nuar-masters-datalist">
                          {mastersList.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>

                      {/* Date */}
                      <div className="templates-quick-field templates-quick-field-sm">
                        <label className="templates-quick-field-label">Дата</label>
                        <input
                          type="text"
                          className={`templates-quick-field-input ${variableOverrides.appointment_date ? "is-overridden" : ""}`}
                          placeholder={baseContext.appointment_date || "ДД.ММ.ГГГГ"}
                          value={variableOverrides.appointment_date ?? ""}
                          onChange={(e) => handleOverrideChange("appointment_date", e.target.value)}
                        />
                      </div>

                      {/* Time */}
                      <div className="templates-quick-field templates-quick-field-xs">
                        <label className="templates-quick-field-label">Время</label>
                        <input
                          type="text"
                          className={`templates-quick-field-input ${variableOverrides.appointment_time ? "is-overridden" : ""}`}
                          placeholder={baseContext.appointment_time || "14:30"}
                          value={variableOverrides.appointment_time ?? ""}
                          onChange={(e) => handleOverrideChange("appointment_time", e.target.value)}
                        />
                      </div>

                      {/* Service */}
                      <div className="templates-quick-field templates-quick-field-wide">
                        <label className="templates-quick-field-label">Услуга</label>
                        <input
                          type="text"
                          className={`templates-quick-field-input ${variableOverrides.service_name ? "is-overridden" : ""}`}
                          placeholder={baseContext.service_name || "Название услуги"}
                          value={variableOverrides.service_name ?? ""}
                          onChange={(e) => handleOverrideChange("service_name", e.target.value)}
                        />
                      </div>

                      {/* Studio Address */}
                      <div className="templates-quick-field templates-quick-field-wide">
                        <label className="templates-quick-field-label">Адрес студии</label>
                        <input
                          type="text"
                          className={`templates-quick-field-input ${variableOverrides.studio_address ? "is-overridden" : ""}`}
                          placeholder={baseContext.studio_address || "Адрес студии"}
                          value={variableOverrides.studio_address ?? ""}
                          onChange={(e) => handleOverrideChange("studio_address", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Missing Variables Warning & Inline Quick-fill */}
                  {missingVariables.length > 0 ? (
                    <div className="templates-missing-alert">
                      <div className="templates-missing-alert-head">
                        <AppIcon name="alert" size="xs" />
                        <span>Внимание: не хватает данных для {missingVariables.join(", ")}</span>
                      </div>
                      <div className="templates-missing-inputs">
                        {missingVariables.map((vKey) => {
                          const cleanKey = vKey.replace(/[{}]/g, "");
                          const def = DYNAMIC_VARIABLES.find((d) => d.key === vKey);
                          return (
                            <div key={vKey} className="templates-missing-input-item">
                              <span className="templates-missing-input-label">{def?.label || cleanKey}:</span>
                              <input
                                className="templates-missing-field"
                                placeholder={def?.sample || "Значение..."}
                                type="text"
                                value={variableOverrides[cleanKey] || ""}
                                onChange={(e) => handleOverrideChange(cleanKey, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Messenger Chat Bubble Mockup */}
                  <div className="templates-chat-mockup">
                    <div className="templates-chat-head">
                      <div className="templates-chat-avatar-wrap">
                        <div className="templates-chat-avatar">N</div>
                        <div>
                          <div className="templates-chat-sender">{appSettings.studioName || "NUAR Massage Studio"}</div>
                          <span className="text-[10.5px] text-zinc-500">
                            {contextMode === "client" && targetClient ? `Для: ${targetClient.name}` : "Демонстрационный предпросмотр"}
                          </span>
                        </div>
                      </div>
                      <span className="templates-chat-demo-badge">
                        {activeLanguage.toUpperCase()} • Мессенджеры и SMS
                      </span>
                    </div>

                    <div className="templates-chat-bubble-wrap">
                      <div className="templates-chat-bubble">
                        {renderedPreviewText || <span className="text-zinc-500 italic">Текст сообщения отсутствует на выбранном языке.</span>}
                        <div className="templates-chat-bubble-meta">
                          <span>{new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span>
                          <span>✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Actions Footer */}
                  <div className="templates-preview-actions">
                    <button
                      className={`templates-copy-main-btn ${copySuccess ? "is-copied" : ""}`}
                      type="button"
                      onClick={handleCopyMessage}
                    >
                      <AppIcon name={copySuccess ? "check" : "copy"} size="sm" />
                      <span>{copySuccess ? "Скопировано в буфер!" : "Скопировать готовое сообщение"}</span>
                    </button>

                    <div className="templates-channels-row">
                      <button
                        className="templates-channel-btn"
                        title="Открыть в WhatsApp с подставленным текстом"
                        type="button"
                        onClick={() => handleOpenChannel("whatsapp")}
                      >
                        <AppIcon name="message" size="xs" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        className="templates-channel-btn"
                        title="Открыть Telegram"
                        type="button"
                        onClick={() => handleOpenChannel("telegram")}
                      >
                        <AppIcon name="at" size="xs" />
                        <span>Telegram</span>
                      </button>
                      <button
                        className="templates-channel-btn"
                        title="Открыть SMS"
                        type="button"
                        onClick={() => handleOpenChannel("sms")}
                      >
                        <AppIcon name="phone" size="xs" />
                        <span>SMS</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="templates-empty-workspace">
              <div className="templates-empty-workspace-icon">
                <AppIcon name="message" size="lg" />
              </div>
              <strong>Шаблон не выбран</strong>
              <span>Выберите существующий шаблон из библиотеки слева или создайте новый для клиентов студии.</span>
              <Button leftIcon="plus" size="sm" variant="primary" onClick={handleCreateNew}>
                Создать шаблон
              </Button>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

export default MessageTemplatesPage;
