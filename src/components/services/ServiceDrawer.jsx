import {useEffect, useMemo, useRef, useState} from "react";
import AppIcon from "../ui/AppIcon.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import Switch from "../ui/Switch.jsx";
import {getCategoryColor, getRandomServiceColor, serviceColorPalette} from "../../utils/serviceColors.js";
import {getServiceAssignedEmployeeIds} from "../../utils/serviceAssignments.js";
import {normalizeSiteBookingBufferSettings} from "../../utils/siteBookingBuffers.js";
import {
  CANONICAL_CATEGORIES,
  MASSAGE_SUBTYPES,
  inferMassageSubType,
  normalizeCategory,
} from "../../utils/serviceCategories.js";

const STANDARD_DURATIONS = [30, 45, 60, 75, 90, 120];

export default function ServiceDrawer({
  isOpen,
  mode = "edit", // "edit" | "create"
  service,
  categories = CANONICAL_CATEGORIES,
  employees = [],
  onClose,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState("info"); // "info" | "variants" | "booking"
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Массажи");
  const [subType, setSubType] = useState("");
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

  // Snapshot of initial values to detect unsaved modifications
  const initialSnapshotRef = useRef(null);

  // Categories list ensuring canonical categories are present
  const availableCategories = useMemo(() => {
    const list = Array.from(new Set([...CANONICAL_CATEGORIES, ...(categories || [])]));
    return list.map(normalizeCategory).filter((c, i, arr) => arr.indexOf(c) === i);
  }, [categories]);

  // Inferred massage sub-type based on current name or subType
  const inferredSubType = useMemo(() => {
    return inferMassageSubType({name, subType}) || "Классический";
  }, [name, subType]);

  // Initialize or reset form when service or isOpen changes
  useEffect(() => {
    if (!isOpen) {
      initialSnapshotRef.current = null;
      return;
    }

    if (mode === "edit" && service) {
      const initialName = service.name ?? "";
      const initialCategory = normalizeCategory(service.category || "Массажи");
      const initialSubType = service.subType || "";
      const initialStatus = service.status || "Активна";
      const initialDescription = service.description ?? service.payload?.description ?? "";
      const initialColor = service.color || getRandomServiceColor();

      const rawVariants = Array.isArray(service.variants) && service.variants.length > 0
        ? service.variants.map((v, idx) => ({
            id: v.id || `var-${v.duration}-${idx}-${Date.now()}`,
            duration: Number(v.duration) || 60,
            price: Number(v.price) || 0,
          }))
        : [{id: `var-init-${Date.now()}`, duration: 60, price: Number(service.price) || 255}];

      const assignedIds = getServiceAssignedEmployeeIds(service);
      const initialAssignedMode = assignedIds.length === 0 ? "all" : "custom";

      const buffers = normalizeSiteBookingBufferSettings(service);
      const initialBufferBeforeEnabled = buffers.beforeEnabled;
      const initialBufferBeforeMinutes = buffers.beforeMinutes || 15;
      const initialBufferAfterEnabled = buffers.afterEnabled;
      const initialBufferAfterMinutes = buffers.afterMinutes || 30;
      const initialSiteVisible = service.siteVisible !== false;

      const serviceType = service.serviceType ?? service.payload?.serviceType;
      const initialIsCombo = serviceType === "combo";
      const initialComboCustomPrice = Boolean(service.comboCustomPrice ?? service.payload?.comboCustomPrice);
      const initialComboItems = service.comboItems ?? service.payload?.comboItems ?? [];

      setName(initialName);
      setCategory(initialCategory);
      setSubType(initialSubType);
      setStatus(initialStatus);
      setDescription(initialDescription);
      setColor(initialColor);
      setVariants(rawVariants);
      setAssignedMode(initialAssignedMode);
      setAssignedEmployeeIds(assignedIds);
      setBufferBeforeEnabled(initialBufferBeforeEnabled);
      setBufferBeforeMinutes(initialBufferBeforeMinutes);
      setBufferAfterEnabled(initialBufferAfterEnabled);
      setBufferAfterMinutes(initialBufferAfterMinutes);
      setSiteVisible(initialSiteVisible);
      setIsCombo(initialIsCombo);
      setComboCustomPrice(initialComboCustomPrice);
      setComboItems(initialComboItems);

      initialSnapshotRef.current = {
        name: initialName,
        category: initialCategory,
        subType: initialSubType,
        status: initialStatus,
        description: initialDescription,
        color: initialColor,
        variants: rawVariants,
        assignedMode: initialAssignedMode,
        assignedEmployeeIds: assignedIds,
        bufferBeforeEnabled: initialBufferBeforeEnabled,
        bufferBeforeMinutes: initialBufferBeforeMinutes,
        bufferAfterEnabled: initialBufferAfterEnabled,
        bufferAfterMinutes: initialBufferAfterMinutes,
        siteVisible: initialSiteVisible,
      };
    } else {
      // Create mode
      const defaultCat = "Массажи";
      const defaultVariants = [
        {id: `var-1-${Date.now()}`, duration: 60, price: 255},
        {id: `var-2-${Date.now()}`, duration: 90, price: 360},
      ];
      const defaultColor = getRandomServiceColor();

      setName("");
      setCategory(defaultCat);
      setSubType("");
      setStatus("Активна");
      setDescription("");
      setColor(defaultColor);
      setVariants(defaultVariants);
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

      initialSnapshotRef.current = {
        name: "",
        category: defaultCat,
        subType: "",
        status: "Активна",
        description: "",
        color: defaultColor,
        variants: defaultVariants,
        assignedMode: "all",
        assignedEmployeeIds: [],
        bufferBeforeEnabled: false,
        bufferBeforeMinutes: 15,
        bufferAfterEnabled: false,
        bufferAfterMinutes: 30,
        siteVisible: true,
      };
    }

    setErrors({});
    setIsSaving(false);
    setActiveTab("info");
  }, [isOpen, mode, service, categories]);

  // Check if user has modified anything
  const isDirty = useMemo(() => {
    if (!initialSnapshotRef.current) return false;
    const init = initialStateRef(initialSnapshotRef.current);
    const curr = {
      name: name.trim(),
      category,
      subType,
      status,
      description: description.trim(),
      color,
      assignedMode,
      siteVisible,
      bufferBeforeEnabled,
      bufferBeforeMinutes: Number(bufferBeforeMinutes) || 0,
      bufferAfterEnabled,
      bufferAfterMinutes: Number(bufferAfterMinutes) || 0,
      assignedEmployeeIds: [...assignedEmployeeIds].sort(),
      variants: variants.map((v) => ({d: Number(v.duration), p: Number(v.price)})),
    };
    return JSON.stringify(curr) !== JSON.stringify(init);
  }, [
    name,
    category,
    subType,
    status,
    description,
    color,
    assignedMode,
    assignedEmployeeIds,
    siteVisible,
    bufferBeforeEnabled,
    bufferBeforeMinutes,
    bufferAfterEnabled,
    bufferAfterMinutes,
    variants,
  ]);

  function initialStateRef(init) {
    return {
      name: (init.name || "").trim(),
      category: init.category,
      subType: init.subType || "",
      status: init.status,
      description: (init.description || "").trim(),
      color: init.color,
      assignedMode: init.assignedMode,
      siteVisible: init.siteVisible,
      bufferBeforeEnabled: init.bufferBeforeEnabled,
      bufferBeforeMinutes: Number(init.bufferBeforeMinutes) || 0,
      bufferAfterEnabled: init.bufferAfterEnabled,
      bufferAfterMinutes: Number(init.bufferAfterMinutes) || 0,
      assignedEmployeeIds: [...(init.assignedEmployeeIds || [])].sort(),
      variants: (init.variants || []).map((v) => ({d: Number(v.duration), p: Number(v.price)})),
    };
  }

  // Safe close handler prompting if unsaved changes exist
  const handleSafeClose = () => {
    if (isDirty) {
      const ok = window.confirm("У вас есть несохранённые изменения. Закрыть без сохранения?");
      if (!ok) return;
    }
    onClose?.();
  };

  // Variant operations
  const handleAddVariant = () => {
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

  const handleSelectAllEmployees = () => {
    setAssignedEmployeeIds(employees.map((e) => String(e.id)));
  };

  const handleClearAllEmployees = () => {
    setAssignedEmployeeIds([]);
  };

  // Form Validation
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
    if (nextErrors.name && activeTab !== "info") {
      setActiveTab("info");
    } else if (nextErrors.variants && activeTab !== "variants") {
      setActiveTab("variants");
    }
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
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

    const finalCategory = normalizeCategory(category);
    const finalSubType = finalCategory === "Массажи" ? (subType || inferredSubType) : (subType || undefined);

    const payload = {
      ...(service?.id ? {id: service.id} : {}),
      name: name.trim(),
      category: finalCategory,
      subType: finalSubType,
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

  const isMassageCategory = normalizeCategory(category) === "Массажи";

  return (
    <aside
      className="services-drawer-root"
      aria-label={mode === "edit" ? "Редактирование услуги" : "Добавить услугу"}>
      <div className="services-drawer-panel">
        {/* 1. FIXED HEADER */}
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
            onClick={handleSafeClose}
            aria-label="Закрыть панель">
            <AppIcon name="x" size="sm" />
          </button>
        </div>

        {/* 2. REAL TABS NAVIGATION */}
        <div className="services-drawer-tabs" role="tablist">
          <button
            className={`services-drawer-tab ${activeTab === "info" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            onClick={() => setActiveTab("info")}>
            <span>Основное</span>
            {errors.name ? <span className="services-tab-error-dot" title="Ошибки в заполнении" /> : null}
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "variants" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "variants"}
            onClick={() => setActiveTab("variants")}>
            <span>Варианты и цены</span>
            <span className="services-tab-badge">{variants.length}</span>
            {errors.variants ? <span className="services-tab-error-dot" title="Ошибки в вариантах" /> : null}
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "booking" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "booking"}
            onClick={() => setActiveTab("booking")}>
            <span>Настройки записи</span>
          </button>
        </div>

        {errors.form ? <div className="services-drawer-error-banner">{errors.form}</div> : null}

        {/* 3. SCROLLABLE BODY RENDERING ACTIVE TAB ONLY */}
        <div className="services-drawer-body">
          {/* TAB 1: ОСНОВНОЕ */}
          {activeTab === "info" && (
            <div className="services-tab-pane services-tab-pane-info">
              {/* Service Name */}
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

              {/* 2-Column: Category & Massage Sub-type */}
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
                      value={normalizeCategory(category)}
                      onChange={(e) => setCategory(e.target.value)}>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
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

              {/* Massage Sub-type (Only for massages category or when applicable) */}
              {isMassageCategory && (
                <div className="services-field-group">
                  <div className="services-label-with-counter">
                    <label className="services-field-label" htmlFor="service-subtype-select">
                      Вид массажа
                    </label>
                    <span className="services-field-hint-inline">
                      Авто: {inferredSubType}
                    </span>
                  </div>
                  <div className="services-select-wrap">
                    <select
                      id="service-subtype-select"
                      className="services-select-input"
                      value={subType}
                      onChange={(e) => setSubType(e.target.value)}>
                      <option value="">Автоопределение ({inferredSubType})</option>
                      {MASSAGE_SUBTYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <AppIcon className="services-select-chevron" name="chevronDown" size="xs" />
                  </div>
                </div>
              )}

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

              {/* Calendar Color Swatches */}
              <div className="services-field-group">
                <div className="services-label-with-counter">
                  <label className="services-field-label">Цвет в календаре</label>
                  <span className="services-field-hint-inline">Для расписания</span>
                </div>
                <div className="services-color-picker-row">
                  {serviceColorPalette.slice(0, 8).map((c) => {
                    const isSelected = color.toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`services-color-dot-btn ${isSelected ? "is-selected" : ""}`}
                        style={{backgroundColor: c}}
                        onClick={() => setColor(c)}
                        aria-label={`Выбрать цвет ${c}`}>
                        {isSelected ? (
                          <AppIcon name="check" size="xs" className="services-color-check-icon" />
                        ) : null}
                      </button>
                    );
                  })}
                  {/* Round "Custom Color" button */}
                  {(() => {
                    const isCustomSelected = !serviceColorPalette
                      .slice(0, 8)
                      .some((c) => c.toLowerCase() === color.toLowerCase());
                    return (
                      <label
                        className={`services-color-custom-btn ${isCustomSelected ? "is-selected" : ""}`}
                        style={{
                          backgroundColor: isCustomSelected ? color : "transparent",
                        }}
                        title="Выбрать свой цвет">
                        <input
                          type="color"
                          className="services-color-native-hidden"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                        {isCustomSelected ? (
                          <AppIcon name="check" size="xs" className="services-color-check-icon" />
                        ) : (
                          <AppIcon name="palette" size="xs" className="services-color-palette-icon" />
                        )}
                      </label>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ВАРИАНТЫ И ЦЕНЫ */}
          {activeTab === "variants" && (
            <div className="services-tab-pane services-tab-pane-variants">
              <div className="services-section-header">
                <div className="services-section-title-wrap">
                  <h3 className="services-section-title">Варианты продолжительности</h3>
                  <span className="services-section-desc">Настройте тарифы по длительности сеанса</span>
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

              {/* Compact tabular variants editor */}
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
                        <div className="services-var-duration-wrap">
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
                          <AppIcon className="services-select-chevron" name="chevronDown" size="xs" />
                        </div>
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
                          title={variants.length <= 1 ? "Минимум один вариант" : "Удалить вариант"}>
                          <AppIcon name="trash" size="xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: НАСТРОЙКИ ЗАПИСИ */}
          {activeTab === "booking" && (
            <div className="services-tab-pane services-tab-pane-booking">
              {/* Available specialists */}
              <div className="services-booking-card">
                <div className="services-booking-card-header">
                  <div>
                    <h4 className="services-booking-card-title">Доступные специалисты</h4>
                    <span className="services-booking-card-desc">Кто из мастеров может выполнять услугу</span>
                  </div>
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
                      Выборочно
                    </button>
                  </div>
                </div>

                {assignedMode === "custom" && (
                  <div className="services-specialists-checklist-wrap">
                    <div className="services-specialists-bulk-bar">
                      <span className="services-specialists-count-label">
                        Выбрано: {assignedEmployeeIds.length} из {employees.length}
                      </span>
                      <div className="services-specialists-quick-actions">
                        <button
                          type="button"
                          className="services-quick-action-link"
                          onClick={handleSelectAllEmployees}>
                          Выбрать всех
                        </button>
                        <span className="services-quick-action-sep">·</span>
                        <button
                          type="button"
                          className="services-quick-action-link"
                          onClick={handleClearAllEmployees}>
                          Снять
                        </button>
                      </div>
                    </div>

                    <div className="services-specialists-checklist">
                      {employees.map((emp) => {
                        const isChecked = assignedEmployeeIds.includes(String(emp.id));
                        return (
                          <label key={emp.id} className="services-specialist-check-row">
                            <Checkbox
                              checked={isChecked}
                              onChange={() => handleToggleEmployee(emp.id)}
                            />
                            <div className="services-specialist-check-meta">
                              <span className="services-specialist-check-name">{emp.name}</span>
                              {emp.role ? (
                                <span className="services-specialist-check-role">{emp.role}</span>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Online booking buffers */}
              <div className="services-booking-card">
                <h4 className="services-booking-card-title">Буферы онлайн-записи</h4>
                <span className="services-booking-card-desc">
                  Технические паузы для подготовки кабинета и дезинфекции
                </span>

                <div className="services-buffers-container">
                  {/* Buffer Before */}
                  <div className="services-buffer-row">
                    <div className="services-buffer-meta">
                      <div className="services-buffer-switch-label">
                        <Switch
                          checked={bufferBeforeEnabled}
                          onChange={(e) => setBufferBeforeEnabled(e.target.checked)}
                          aria-label="Включить буфер до услуги"
                        />
                        <span className="services-buffer-title">Буфер перед услугой</span>
                      </div>
                      <span className="services-buffer-desc">Для подготовки кабинета к приходу клиента</span>
                    </div>
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
                        <span className="services-buffer-unit">мин</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Buffer After */}
                  <div className="services-buffer-row">
                    <div className="services-buffer-meta">
                      <div className="services-buffer-switch-label">
                        <Switch
                          checked={bufferAfterEnabled}
                          onChange={(e) => setBufferAfterEnabled(e.target.checked)}
                          aria-label="Включить буфер после услуги"
                        />
                        <span className="services-buffer-title">Буфер после услуги</span>
                      </div>
                      <span className="services-buffer-desc">Для уборки, проветривания и отдыха мастера</span>
                    </div>
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
                        <span className="services-buffer-unit">мин</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Website visibility */}
              <div className="services-booking-card services-site-visible-card">
                <div className="services-buffer-meta">
                  <div className="services-buffer-switch-label">
                    <Switch
                      checked={siteVisible}
                      onChange={(e) => setSiteVisible(e.target.checked)}
                      aria-label="Отображение на сайте nuarr.pl"
                    />
                    <span className="services-buffer-title">Отображать на сайте nuarr.pl</span>
                  </div>
                  <span className="services-buffer-desc">
                    Услуга будет доступна клиентам в форме онлайн-записи
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. FIXED FOOTER */}
        <div className="services-drawer-footer">
          <button
            type="button"
            className="services-drawer-btn-cancel"
            onClick={handleSafeClose}
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
