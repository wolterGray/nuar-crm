import {useEffect, useRef, useState} from "react";
import AppIcon from "../ui/AppIcon.jsx";
import {getCategoryColor, getRandomServiceColor, serviceColorPalette} from "../../utils/serviceColors.js";
import {getServiceAssignedEmployeeIds} from "../../utils/serviceAssignments.js";
import {normalizeSiteBookingBufferSettings} from "../../utils/siteBookingBuffers.js";

const STANDARD_DURATIONS = [30, 45, 60, 75, 90, 120];

export default function ServiceDrawer({
  isOpen,
  mode = "edit", // "edit" | "create"
  service,
  categories = [],
  employees = [],
  onClose,
  onSave,
}) {
  const scrollContainerRef = useRef(null);
  const infoSectionRef = useRef(null);
  const variantsSectionRef = useRef(null);
  const extraSectionRef = useRef(null);

  const [activeTab, setActiveTab] = useState("info"); // "info" | "variants" | "extra"
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Массаж");
  const [status, setStatus] = useState("Активна");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#c15555");
  const [variants, setVariants] = useState([]);
  const [assignedMode, setAssignedMode] = useState("all"); // "all" | "custom"
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState([]);
  const [bufferBeforeEnabled, setBufferBeforeEnabled] = useState(false);
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(15);
  const [bufferAfterEnabled, setBufferAfterEnabled] = useState(false);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(30);
  const [siteVisible, setSiteVisible] = useState(true);

  // Combo service support
  const [isCombo, setIsCombo] = useState(false);
  const [comboCustomPrice, setComboCustomPrice] = useState(false);
  const [comboItems, setComboItems] = useState([]);

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or reset form when service or isOpen changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && service) {
      setName(service.name ?? "");
      setCategory(service.category || (categories[0] ?? "Массаж"));
      setStatus(service.status || "Активна");
      setDescription(service.description ?? service.payload?.description ?? "");
      setColor(service.color || getRandomServiceColor());

      const rawVariants = Array.isArray(service.variants) && service.variants.length > 0
        ? service.variants.map((v, idx) => ({
            id: v.id || `${v.duration}-${idx}-${Date.now()}`,
            duration: Number(v.duration) || 60,
            price: Number(v.price) || 0,
          }))
        : [{id: `var-init-${Date.now()}`, duration: 60, price: Number(service.price) || 255}];
      setVariants(rawVariants);

      const assignedIds = getServiceAssignedEmployeeIds(service);
      if (assignedIds.length === 0) {
        setAssignedMode("all");
        setAssignedEmployeeIds([]);
      } else {
        setAssignedMode("custom");
        setAssignedEmployeeIds(assignedIds);
      }

      const buffers = normalizeSiteBookingBufferSettings(service);
      setBufferBeforeEnabled(buffers.beforeEnabled);
      setBufferBeforeMinutes(buffers.beforeMinutes || 15);
      setBufferAfterEnabled(buffers.afterEnabled);
      setBufferAfterMinutes(buffers.afterMinutes || 30);
      setSiteVisible(service.siteVisible !== false);

      const serviceType = service.serviceType ?? service.payload?.serviceType;
      setIsCombo(serviceType === "combo");
      setComboCustomPrice(Boolean(service.comboCustomPrice ?? service.payload?.comboCustomPrice));
      setComboItems(service.comboItems ?? service.payload?.comboItems ?? []);
    } else {
      // Create mode
      setName("");
      setCategory(categories[0] ?? "Массаж");
      setStatus("Активна");
      setDescription("");
      setColor(getRandomServiceColor());
      setVariants([
        {id: `var-1-${Date.now()}`, duration: 60, price: 255},
        {id: `var-2-${Date.now()}`, duration: 90, price: 360},
      ]);
      setAssignedMode("all");
      setAssignedEmployeeIds([]);
      setBufferBeforeEnabled(false);
      setBufferBeforeMinutes(15);
      setBufferAfterEnabled(false);
      setBufferAfterMinutes(30);
      setSiteVisible(true);
      setIsCombo(false);
      setComboCustomPrice(false);
      setComboItems([]);
    }

    setErrors({});
    setIsSaving(false);
    setActiveTab("info");
  }, [isOpen, mode, service, categories]);

  // Scroll to section when tab is clicked
  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    let target = null;
    if (tabKey === "info") target = infoSectionRef.current;
    if (tabKey === "variants") target = variantsSectionRef.current;
    if (tabKey === "extra") target = extraSectionRef.current;

    if (target && scrollContainerRef.current) {
      target.scrollIntoView({behavior: "smooth", block: "start"});
    }
  };

  // Variant operations
  const handleAddVariant = () => {
    // Pick the first standard duration that isn't already in variants
    const usedDurations = new Set(variants.map((v) => Number(v.duration)));
    const nextDuration = STANDARD_DURATIONS.find((d) => !usedDurations.has(d)) || 60;
    const newVariant = {
      id: `var-${Date.now()}-${Math.random()}`,
      duration: nextDuration,
      price: 250,
    };
    setVariants((curr) => [...curr, newVariant]);
    setErrors((curr) => ({...curr, variants: undefined}));
  };

  const handleUpdateVariant = (id, field, value) => {
    setVariants((curr) =>
      curr.map((item) => (item.id === id ? {...item, [field]: value} : item)),
    );
    setErrors((curr) => ({...curr, variants: undefined}));
  };

  const handleDeleteVariant = (id) => {
    if (variants.length <= 1) {
      setErrors((curr) => ({
        ...curr,
        variants: "Услуга должна содержать минимум один вариант длительности и цены",
      }));
      return;
    }
    setVariants((curr) => curr.filter((item) => item.id !== id));
  };

  // Specialist selection
  const handleToggleEmployee = (empId) => {
    const idStr = String(empId);
    setAssignedEmployeeIds((curr) =>
      curr.includes(idStr) ? curr.filter((id) => id !== idStr) : [...curr, idStr],
    );
  };

  const handleRemoveEmployee = (empId) => {
    const idStr = String(empId);
    setAssignedEmployeeIds((curr) => curr.filter((id) => id !== idStr));
  };

  // Validation
  const validateForm = () => {
    const nextErrors = {};
    if (!name.trim()) {
      nextErrors.name = "Название услуги обязательно для заполнения";
    }

    if (!isCombo) {
      if (variants.length === 0) {
        nextErrors.variants = "Добавьте минимум один вариант продолжительности";
      } else {
        const durations = variants.map((v) => Number(v.duration));
        const hasZero = durations.some((d) => d <= 0);
        if (hasZero) {
          nextErrors.variants = "Длительность должна быть больше нуля";
        }
        const hasDuplicates = new Set(durations).size !== durations.length;
        if (hasDuplicates) {
          nextErrors.variants = "Услуга не может содержать одинаковые длительности";
        }
        const hasInvalidPrice = variants.some((v) => Number(v.price) < 0 || isNaN(Number(v.price)));
        if (hasInvalidPrice) {
          nextErrors.variants = "Стоимость не может быть отрицательной";
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);

    const sortedVariants = [...variants]
      .map((v) => ({
        duration: Number(v.duration) || 60,
        price: Math.max(0, Number(v.price) || 0),
      }))
      .sort((a, b) => a.duration - b.duration);

    const assignedNames = employees
      .filter((emp) => assignedEmployeeIds.includes(String(emp.id)))
      .map((emp) => emp.name);

    const payload = {
      ...(service?.id ? {id: service.id} : {}),
      name: name.trim(),
      category: category.trim() || "Массаж",
      status: status.trim() || "Активна",
      description: description.trim(),
      color,
      variants: sortedVariants,
      price: sortedVariants[0]?.price ?? 0,
      durationMin: sortedVariants[0]?.duration ?? 60,
      siteVisible: siteVisible && status !== "Архив" && status !== "Скрыта",
      assignedEmployeeIds: assignedMode === "all" ? [] : assignedEmployeeIds,
      assignedEmployeeNames: assignedMode === "all" ? [] : assignedNames,
      siteBookingBufferBeforeEnabled: bufferBeforeEnabled,
      siteBookingBufferBeforeMinutes: Number(bufferBeforeMinutes) || 0,
      siteBookingBufferAfterEnabled: bufferAfterEnabled,
      siteBookingBufferAfterMinutes: Number(bufferAfterMinutes) || 0,
      buffers: {
        beforeEnabled: bufferBeforeEnabled,
        beforeMinutes: Number(bufferBeforeMinutes) || 0,
        afterEnabled: bufferAfterEnabled,
        afterMinutes: Number(bufferAfterMinutes) || 0,
      },
    };

    if (isCombo) {
      payload.serviceType = "combo";
      payload.isParallel = true;
      payload.comboCustomPrice = comboCustomPrice;
      payload.comboItems = comboItems;
    } else {
      payload.serviceType = "service";
      payload.isParallel = false;
    }

    try {
      await onSave?.(payload, mode === "edit" ? service : null);
      onClose();
    } catch (err) {
      setErrors((curr) => ({
        ...curr,
        form: err?.message || "Ошибка сохранения услуги",
      }));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className="services-drawer-root"
      aria-label={mode === "edit" ? "Редактирование услуги" : "Добавить услугу"}>
      <div className="services-drawer-panel">
        {/* Drawer Header */}
        <div className="services-drawer-header">
          <div className="services-drawer-title-wrap">
            <h2>{mode === "edit" ? "Редактирование услуги" : "Добавить услугу"}</h2>
            <span className="services-drawer-subtitle">
              {mode === "edit" ? (service?.name || "Услуга") : "Новая позиция в каталоге"}
            </span>
          </div>
          <button
            className="services-drawer-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель">
            <AppIcon name="close" size="sm" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="services-drawer-tabs" role="tablist">
          <button
            className={`services-drawer-tab ${activeTab === "info" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            onClick={() => handleTabClick("info")}>
            Основная информация
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "variants" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "variants"}
            onClick={() => handleTabClick("variants")}>
            Варианты и цены
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "extra" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "extra"}
            onClick={() => handleTabClick("extra")}>
            Дополнительно
          </button>
        </div>

        {errors.form ? <div className="services-drawer-error-banner">{errors.form}</div> : null}

        {/* Drawer Body (Scrollable form) */}
        <form
          className="services-drawer-body"
          ref={scrollContainerRef}
          onSubmit={handleSubmit}>
          {/* SECTION A: ОСНОВНАЯ ИНФОРМАЦИЯ */}
          <div className="services-drawer-section" ref={infoSectionRef} id="drawer-section-info">
            <div className="services-field-group">
              <label className="services-field-label" htmlFor="service-name-input">
                Название услуги <span className="services-required-star">*</span>
              </label>
              <input
                id="service-name-input"
                className={`services-text-input ${errors.name ? "has-error" : ""}`}
                placeholder="Например: Masaż klasyczny (Master)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((c) => ({...c, name: undefined}));
                }}
              />
              {errors.name ? <div className="services-field-error">{errors.name}</div> : null}
            </div>

            <div className="services-form-row-2col">
              {/* Category */}
              <div className="services-field-group">
                <label className="services-field-label" htmlFor="service-category-select">
                  Категория
                </label>
                <div className="services-select-wrap">
                  <span
                    className="services-category-preview-dot"
                    style={{backgroundColor: getCategoryColor(category)}}
                    aria-hidden="true"
                  />
                  <select
                    id="service-category-select"
                    className="services-select-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {!categories.includes("Без категории") ? (
                      <option value="Без категории">Без категории</option>
                    ) : null}
                  </select>
                  <AppIcon className="services-select-chevron" name="chevronDown" size="xs" />
                </div>
              </div>

              {/* Status */}
              <div className="services-field-group">
                <label className="services-field-label" htmlFor="service-status-select">
                  Статус
                </label>
                <div className="services-select-wrap">
                  <span
                    className={`services-status-preview-dot status-${
                      status === "Активна" ? "active" : status === "Скрыта" ? "hidden" : "archived"
                    }`}
                    aria-hidden="true"
                  />
                  <select
                    id="service-status-select"
                    className="services-select-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}>
                    <option value="Активна">Активна</option>
                    <option value="Скрыта">Скрыта</option>
                    <option value="Архив">Архив</option>
                  </select>
                  <AppIcon className="services-select-chevron" name="chevronDown" size="xs" />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="services-field-group">
              <div className="services-label-with-counter">
                <label className="services-field-label" htmlFor="service-desc-input">
                  Описание
                </label>
                <span className="services-char-counter">{description.length}/500</span>
              </div>
              <textarea
                id="service-desc-input"
                className="services-textarea"
                maxLength={500}
                rows={3}
                placeholder="Краткое описание процедуры для клиентов и администраторов..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Calendar Color */}
            <div className="services-field-group">
              <label className="services-field-label">Цвет в календаре</label>
              <div className="services-color-picker-row">
                {serviceColorPalette.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`services-color-dot-btn ${color === c ? "is-selected" : ""}`}
                    style={{backgroundColor: c}}
                    onClick={() => setColor(c)}
                    aria-label={`Выбрать цвет ${c}`}
                  />
                ))}
                <input
                  type="color"
                  className="services-color-custom-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  title="Выбрать свой цвет"
                />
              </div>
            </div>
          </div>

          {/* SECTION B: ВАРИАНТЫ И ЦЕНЫ */}
          <div className="services-drawer-section" ref={variantsSectionRef} id="drawer-section-variants">
            <div className="services-section-header">
              <div className="services-section-title-wrap">
                <h3 className="services-section-title">
                  Варианты и цены
                  <span className="services-info-tooltip-trigger" title="Длительность процедуры и стоимость в PLN">
                    <AppIcon name="info" size="xs" />
                  </span>
                </h3>
                <span className="services-section-desc">Настройте тарифы по продолжительности</span>
              </div>
              <button
                type="button"
                className="services-add-variant-btn"
                onClick={handleAddVariant}>
                <AppIcon name="plus" size="xs" />
                Добавить вариант
              </button>
            </div>

            {errors.variants ? (
              <div className="services-variants-error-msg">{errors.variants}</div>
            ) : null}

            {/* Variants table */}
            <div className="services-variants-table">
              <div className="services-variants-thead">
                <span className="services-var-th-duration">Длительность</span>
                <span className="services-var-th-price">Цена (PLN)</span>
                <span className="services-var-th-action" />
              </div>

              <div className="services-variants-tbody">
                {variants.map((v, index) => (
                  <div key={v.id || index} className="services-variant-row">
                    <div className="services-var-cell-duration">
                      <select
                        className="services-var-duration-select"
                        value={v.duration}
                        onChange={(e) =>
                          handleUpdateVariant(v.id, "duration", Number(e.target.value) || 60)
                        }>
                        {STANDARD_DURATIONS.map((dur) => (
                          <option key={dur} value={dur}>
                            {dur} мин
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="services-var-cell-price">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        className="services-var-price-input"
                        placeholder="0"
                        value={v.price}
                        onChange={(e) =>
                          handleUpdateVariant(v.id, "price", e.target.value)
                        }
                      />
                      <span className="services-var-price-unit">zł</span>
                    </div>

                    <div className="services-var-cell-action">
                      <button
                        type="button"
                        className="services-var-delete-btn"
                        onClick={() => handleDeleteVariant(v.id)}
                        disabled={variants.length <= 1}
                        title="Удалить вариант">
                        <AppIcon name="trash" size="xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION C: ДОПОЛНИТЕЛЬНО */}
          <div className="services-drawer-section" ref={extraSectionRef} id="drawer-section-extra">
            {/* Available specialists */}
            <div className="services-field-group">
              <label className="services-field-label">Доступные специалисты</label>
              <div className="services-toggles-row">
                <button
                  type="button"
                  className={`services-toggle-pill ${assignedMode === "all" ? "is-active" : ""}`}
                  onClick={() => {
                    setAssignedMode("all");
                    setAssignedEmployeeIds([]);
                  }}>
                  Все мастера
                </button>
                <button
                  type="button"
                  className={`services-toggle-pill ${assignedMode === "custom" ? "is-active" : ""}`}
                  onClick={() => setAssignedMode("custom")}>
                  Только выбранные
                </button>
              </div>

              {assignedMode === "custom" ? (
                <div className="services-specialists-selector-panel">
                  {/* Selected specialist chips */}
                  <div className="services-specialist-chips-wrap">
                    {employees.map((emp) => {
                      const isSelected = assignedEmployeeIds.includes(String(emp.id));
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          className={`services-specialist-chip ${isSelected ? "is-selected" : ""}`}
                          onClick={() => handleToggleEmployee(emp.id)}>
                          <span>{emp.name}</span>
                          {isSelected ? (
                            <span
                              className="services-chip-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveEmployee(emp.id);
                              }}>
                              ✕
                            </span>
                          ) : (
                            <span className="services-chip-add">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {assignedEmployeeIds.length === 0 ? (
                    <span className="services-field-hint">
                      Выберите хотя бы одного мастера или переключите на «Все мастера».
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Online booking buffers */}
            <div className="services-field-group">
              <label className="services-field-label">
                Буферы онлайн-записи
                <span className="services-info-tooltip-trigger" title="Время до и после услуги для подготовки кабинета">
                  <AppIcon name="info" size="xs" />
                </span>
              </label>

              <div className="services-buffers-container">
                <div className="services-buffer-row">
                  <label className="services-buffer-check-label">
                    <input
                      type="checkbox"
                      className="services-checkbox-input"
                      checked={bufferBeforeEnabled}
                      onChange={(e) => setBufferBeforeEnabled(e.target.checked)}
                    />
                    <span>Буфер до услуги</span>
                  </label>
                  {bufferBeforeEnabled ? (
                    <div className="services-buffer-input-wrap">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        className="services-buffer-number-input"
                        value={bufferBeforeMinutes}
                        onChange={(e) => setBufferBeforeMinutes(Number(e.target.value) || 0)}
                      />
                      <span>мин</span>
                    </div>
                  ) : null}
                </div>

                <div className="services-buffer-row">
                  <label className="services-buffer-check-label">
                    <input
                      type="checkbox"
                      className="services-checkbox-input"
                      checked={bufferAfterEnabled}
                      onChange={(e) => setBufferAfterEnabled(e.target.checked)}
                    />
                    <span>Буфер после услуги</span>
                  </label>
                  {bufferAfterEnabled ? (
                    <div className="services-buffer-input-wrap">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        className="services-buffer-number-input"
                        value={bufferAfterMinutes}
                        onChange={(e) => setBufferAfterMinutes(Number(e.target.value) || 0)}
                      />
                      <span>мин</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Online site visibility */}
            <div className="services-field-group">
              <label className="services-buffer-check-label services-site-visible-check">
                <input
                  type="checkbox"
                  className="services-checkbox-input"
                  checked={siteVisible}
                  onChange={(e) => setSiteVisible(e.target.checked)}
                />
                <div>
                  <span className="font-semibold text-zinc-200">Отображать на сайте nuarr.pl</span>
                  <p className="text-xs text-zinc-400 m-0">
                    Услуга будет доступна для онлайн-бронирования клиентами
                  </p>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Sticky Drawer Footer */}
        <div className="services-drawer-footer">
          <button
            type="button"
            className="services-drawer-btn-cancel"
            onClick={onClose}
            disabled={isSaving}>
            Отмена
          </button>
          <button
            type="button"
            className="services-drawer-btn-save"
            onClick={handleSubmit}
            disabled={isSaving}>
            {isSaving ? (
              <>
                <AppIcon name="loader" size="xs" className="services-spin-icon" />
                Сохранение...
              </>
            ) : mode === "edit" ? (
              "Сохранить изменения"
            ) : (
              "Создать услугу"
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
