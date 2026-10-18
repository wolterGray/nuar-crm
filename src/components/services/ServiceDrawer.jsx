import {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import AppIcon from "../ui/AppIcon.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import Switch from "../ui/Switch.jsx";
import {useModalScrollLock} from "../../hooks/useModalScrollLock.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {
  getCategoryColor,
  getRandomServiceColor,
  serviceColorPalette,
} from "../../utils/serviceColors.js";
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
  allServices = [],
  onClose,
  onSave,
}) {
  useModalScrollLock(isOpen);
  const {isMobile} = useBreakpoint();
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
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(15);
  const [siteVisible, setSiteVisible] = useState(true);

  // Service Type & Couple support
  const [isCombo, setIsCombo] = useState(false);
  const [isCouple, setIsCouple] = useState(false);
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
      const rawBeforeMin = Number(service.siteBookingBufferBeforeMinutes);
      const initialBufferBeforeMinutes =
        rawBeforeMin > 0 ? rawBeforeMin : buffers.beforeMinutes > 0 ? buffers.beforeMinutes : 15;
      const initialBufferAfterEnabled = buffers.afterEnabled;
      const rawAfterMin = Number(service.siteBookingBufferAfterMinutes);
      const initialBufferAfterMinutes =
        rawAfterMin > 0 ? rawAfterMin : buffers.afterMinutes > 0 ? buffers.afterMinutes : 15;
      const initialSiteVisible = service.siteVisible !== false;

      const serviceType = service.serviceType ?? service.payload?.serviceType;
      const initialIsCombo = serviceType === "combo";
      const initialIsCouple = Boolean(
        service.isCouple ||
        service.isParallel ||
        service.payload?.isCouple ||
        service.payload?.isParallel ||
        String(service.name || "").toLowerCase().includes("dwojga") ||
        String(service.name || "").toLowerCase().includes("парный")
      );
      const initialComboCustomPrice = Boolean(service.comboCustomPrice ?? service.payload?.comboCustomPrice);
      const rawComboItems = service.comboItems ?? service.payload?.comboItems;
      const initialComboItems = Array.isArray(rawComboItems) && rawComboItems.length > 0
        ? rawComboItems.map((item, idx) => ({
            id: item.id || `stage-${idx}-${Date.now()}`,
            name: item.name || item.title || "",
            duration: Number(item.duration) || 30,
          }))
        : [];

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
      setIsCouple(initialIsCouple);
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
        isCombo: initialIsCombo,
        isCouple: initialIsCouple,
        comboItems: initialComboItems,
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
      setIsCouple(false);
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
        isCombo: false,
        isCouple: false,
        comboItems: [],
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
      isCombo: Boolean(isCombo),
      isCouple: Boolean(isCouple),
      comboItems: comboItems.map((i) => ({n: (i.name || "").trim(), d: Number(i.duration)})),
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
    isCombo,
    isCouple,
    comboItems,
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
      isCombo: Boolean(init.isCombo),
      isCouple: Boolean(init.isCouple),
      comboItems: (init.comboItems || []).map((i) => ({n: (i.name || "").trim(), d: Number(i.duration)})),
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

  // Complex (Combo) stages operations
  const handleAddComboStage = () => {
    const newStage = {
      id: `stage-${Date.now()}-${Math.random()}`,
      name: "",
      duration: 30,
    };
    setComboItems((curr) => {
      const next = [...curr, newStage];
      const totalDur = next.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      if (variants.length === 1 && totalDur > 0) {
        setVariants([{ ...variants[0], duration: totalDur }]);
      }
      return next;
    });
    setErrors((curr) => ({...curr, combo: undefined}));
  };

  const handleUpdateComboStage = (id, field, value) => {
    setComboItems((curr) => {
      const next = curr.map((item) => (item.id === id ? {...item, [field]: value} : item));
      const totalDur = next.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      if (variants.length === 1 && totalDur > 0) {
        setVariants([{ ...variants[0], duration: totalDur }]);
      }
      return next;
    });
    setErrors((curr) => ({...curr, combo: undefined}));
  };

  const handleDeleteComboStage = (id) => {
    setComboItems((curr) => {
      const next = curr.filter((item) => item.id !== id);
      const totalDur = next.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      if (variants.length === 1 && totalDur > 0) {
        setVariants([{ ...variants[0], duration: totalDur }]);
      }
      return next;
    });
  };

  const comboTotalDuration = useMemo(() => {
    return comboItems.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  }, [comboItems]);

  // Proactive duplicate service warning (e.g. Masaż dla dwojga 60 min vs Masaż dla dwojga)
  const duplicateWarning = useMemo(() => {
    if (!name.trim() || !Array.isArray(allServices) || allServices.length === 0) return null;
    const currentId = service?.id;
    const cleanCurrent = name
      .toLowerCase()
      .replace(/[0-9]+\s*(min|мин|m)\b/gi, "")
      .replace(/[^a-zа-я0-9]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanCurrent.length < 3) return null;

    const match = allServices.find((s) => {
      if (s.id && currentId && String(s.id) === String(currentId)) return false;
      const cleanOther = (s.name || "")
        .toLowerCase()
        .replace(/[0-9]+\s*(min|мин|m)\b/gi, "")
        .replace(/[^a-zа-я0-9]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return cleanOther === cleanCurrent && normalizeCategory(s.category) === normalizeCategory(category);
    });

    if (match) {
      return `В категории «${normalizeCategory(category)}» уже есть похожая услуга: «${match.name}». Рекомендуется настроить разные варианты продолжительности в одной карточке услуги (вкладка «Варианты и цены»), вместо создания отдельной карточки-дубликата.`;
    }
    return null;
  }, [name, category, service?.id, allServices]);

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

    if (variants.length === 0) {
      nextErrors.variants = isCombo
        ? "Укажите длительность и стоимость комплекса"
        : "Добавьте минимум один вариант продолжительности";
    } else {
      const durations = variants.map((v) => Number(v.duration));
      const hasZero = durations.some((d) => d <= 0 || isNaN(d));
      if (hasZero) {
        nextErrors.variants = "Длительность должна быть больше нуля";
      }

      const seen = new Set();
      const duplicates = [];
      for (const d of durations) {
        if (seen.has(d)) duplicates.push(d);
        seen.add(d);
      }
      if (duplicates.length > 0) {
        nextErrors.variants = `Услуга не может содержать одинаковые длительности (${duplicates.join(", ")} мин). Объедините их в один тариф или задайте разное время.`;
      }

      const hasInvalidPrice = variants.some((v) => Number(v.price) < 0 || isNaN(Number(v.price)));
      if (hasInvalidPrice) {
        nextErrors.variants = "Стоимость не может быть отрицательной";
      }
    }

    if (isCombo && comboItems.length > 0) {
      const hasEmpty = comboItems.some((item) => !String(item.name || "").trim());
      if (hasEmpty) {
        nextErrors.combo = "Укажите название для каждого этапа комплекса";
      }
    }

    setErrors(nextErrors);
    if ((nextErrors.name || nextErrors.combo) && activeTab !== "info") {
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

    payload.serviceType = isCombo ? "combo" : "service";
    payload.isCouple = isCouple;
    payload.isParallel = isCouple;
    payload.parallelParticipants = isCouple ? 2 : 1;

    if (isCombo) {
      payload.comboCustomPrice = comboCustomPrice;
      payload.comboItems = comboItems.map((item) => ({
        id: item.id,
        name: (item.name || "").trim(),
        duration: Number(item.duration) || 30,
      }));
    } else {
      payload.comboItems = [];
      payload.comboCustomPrice = false;
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

  const drawerContent = (
    <aside
      className="services-drawer-root"
      aria-label={mode === "edit" ? "Редактирование услуги" : "Добавить услугу"}>
      <div className="services-drawer-panel">
        {/* 1. FIXED HEADER */}
        <div className="services-drawer-header">
          <div className="services-drawer-title-wrap">
            <h2>{mode === "edit" ? "Редактирование услуги" : "Новая услуга"}</h2>
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

        {/* 2. REAL TABS NAVIGATION: Основное | Цены | Запись */}
        <div className="services-drawer-tabs" role="tablist">
          <button
            className={`services-drawer-tab ${activeTab === "info" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            onClick={() => setActiveTab("info")}>
            <span className="services-drawer-tab-text">Основное</span>
            {errors.name || errors.combo ? (
              <span className="services-tab-error-dot" title="Ошибки в заполнении" />
            ) : null}
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "variants" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "variants"}
            onClick={() => setActiveTab("variants")}>
            <span className="services-drawer-tab-text">Цены</span>
            <span className="services-tab-badge">{variants.length}</span>
            {errors.variants ? (
              <span className="services-tab-error-dot" title="Ошибки в тарифах" />
            ) : null}
          </button>
          <button
            className={`services-drawer-tab ${activeTab === "booking" ? "is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "booking"}
            onClick={() => setActiveTab("booking")}>
            <span className="services-drawer-tab-text">Запись</span>
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

              {/* Proactive Duplicate Warning Banner */}
              {duplicateWarning ? (
                <div className="services-drawer-warning-banner" role="alert">
                  <AppIcon name="alertTriangle" size="xs" className="services-warning-banner-icon" />
                  <div className="services-warning-banner-text">{duplicateWarning}</div>
                </div>
              ) : null}

              {/* 2-Column: Category & Status */}
              <div className="services-form-row-2col">
                {/* Category */}
                <div className="services-field-group">
                  <label className="services-field-label" htmlFor="service-category-select">
                    Категория <span className="services-required-star">*</span>
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

              {/* Service Type: 3 Pills (Обычная / Комплекс / Парная) */}
              <div className="services-field-group">
                <label className="services-field-label">Тип услуги</label>
                <div className="services-type-pills-row" role="group" aria-label="Тип услуги">
                  <button
                    type="button"
                    className={`services-type-pill ${!isCombo && !isCouple ? "is-active" : ""}`}
                    onClick={() => {
                      setIsCombo(false);
                      setIsCouple(false);
                    }}>
                    <span className="services-type-pill-dot">{!isCombo && !isCouple ? "●" : "○"}</span>
                    <span>Обычная</span>
                  </button>
                  <button
                    type="button"
                    className={`services-type-pill ${isCombo ? "is-active" : ""}`}
                    onClick={() => {
                      const next = !isCombo;
                      setIsCombo(next);
                      if (next && comboItems.length === 0) {
                        setComboItems([
                          {id: `stage-1-${Date.now()}`, name: "Этап 1: Пилинг / Подготовка", duration: 30},
                          {id: `stage-2-${Date.now()}`, name: "Этап 2: Основной массаж", duration: 60},
                        ]);
                        if (variants.length === 1) {
                          setVariants([{ ...variants[0], duration: 90 }]);
                        }
                      }
                    }}>
                    <span className="services-type-pill-dot">{isCombo ? "●" : "○"}</span>
                    <span>Комплекс</span>
                  </button>
                  <button
                    type="button"
                    className={`services-type-pill ${isCouple ? "is-active" : ""}`}
                    onClick={() => setIsCouple(!isCouple)}>
                    <span className="services-type-pill-dot">{isCouple ? "●" : "○"}</span>
                    <span>Парная</span>
                  </button>
                </div>
              </div>

              {/* Complex constituent stages (shown if isCombo) */}
              {isCombo && (
                <div className="services-combo-stages-card">
                  <div className="services-section-header">
                    <div className="services-section-title-wrap">
                      <h4 className="services-section-title">
                        <AppIcon name="layers" size="xs" />
                        Состав комплекса
                      </h4>
                      <span className="services-section-desc">
                        Процедуры и этапы, входящие в программу
                      </span>
                    </div>
                    <button
                      type="button"
                      className="services-add-stage-btn"
                      onClick={handleAddComboStage}>
                      <AppIcon name="plus" size="xs" />
                      Добавить этап
                    </button>
                  </div>

                  {errors.combo ? (
                    <div className="services-field-error">{errors.combo}</div>
                  ) : null}

                  <div className="services-combo-stages-list">
                    {comboItems.map((item, idx) => (
                      <div key={item.id || idx} className="services-combo-stage-row">
                        <span className="services-combo-stage-num">{idx + 1}</span>
                        <input
                          type="text"
                          className="services-combo-stage-name-input"
                          placeholder="Название этапа (например: Скрабирование)"
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateComboStage(item.id, "name", e.target.value)
                          }
                        />
                        <div className="services-combo-stage-dur-wrap">
                          <select
                            className="services-combo-stage-dur-select"
                            value={item.duration}
                            onChange={(e) =>
                              handleUpdateComboStage(
                                item.id,
                                "duration",
                                Number(e.target.value) || 30
                              )
                            }>
                            {[15, 20, 30, 40, 45, 60, 75, 90].map((d) => (
                              <option key={d} value={d}>
                                {d} мин
                              </option>
                            ))}
                          </select>
                          <AppIcon className="services-select-chevron" name="chevronDown" size="xs" />
                        </div>
                        <button
                          type="button"
                          className="services-combo-stage-del-btn"
                          onClick={() => handleDeleteComboStage(item.id)}
                          aria-label="Удалить этап">
                          <AppIcon name="trash" size="xs" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="services-combo-stages-footer">
                    <span>Всего этапов: {comboItems.length}</span>
                    <span className="services-combo-total-dur">
                      Общая длительность: <strong>{comboTotalDuration} мин</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Massage Sub-type (Only for massages category when applicable) */}
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

              {/* Website Visibility Row */}
              <div className="services-site-visible-row">
                <div className="services-site-visible-meta">
                  <span className="services-site-visible-title">Отображать на сайте nuarr.pl</span>
                  <span className="services-site-visible-desc">
                    Услуга будет доступна клиентам в форме онлайн-записи
                  </span>
                </div>
                <div className="services-site-switch-wrap">
                  <Switch
                    checked={siteVisible}
                    onChange={(e) => setSiteVisible(e.target.checked)}
                    aria-label="Отображать на сайте nuarr.pl"
                    className="services-site-switch"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ЦЕНЫ (ВАРИАНТЫ И СТОИМОСТЬ) */}
          {activeTab === "variants" && (
            <div className="services-tab-pane services-tab-pane-variants">
              <div className="services-section-header">
                <div className="services-section-title-wrap">
                  <h3 className="services-section-title">Варианты продолжительности</h3>
                  <span className="services-section-desc">Стоимость каждого варианта услуги</span>
                </div>
                <button
                  type="button"
                  className="services-add-variant-btn"
                  onClick={handleAddVariant}>
                  <AppIcon name="plus" size="xs" />
                  <span>Добавить</span>
                </button>
              </div>

              {isCombo && comboTotalDuration > 0 ? (
                <div className="services-combo-variant-hint">
                  💡 Длительность этапов комплекса в сумме составляет {comboTotalDuration} мин. Рекомендуется использовать эту продолжительность для основного тарифа.
                </div>
              ) : null}

              {errors.variants ? (
                <div className="services-variants-error-msg">{errors.variants}</div>
              ) : null}

              {/* Compact tabular variants editor */}
              <div className="services-variants-table">
                <div className="services-variants-thead">
                  <span className="services-var-th-duration">Длительность</span>
                  <span className="services-var-th-price">Цена (zł)</span>
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
                        <div className="services-var-price-input-wrap">
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
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                          />
                          <span className="services-var-price-unit">zł</span>
                        </div>
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

          {/* TAB 3: ЗАПИСЬ (МАСТЕРА, БУФЕРЫ, ОНЛАЙН) */}
          {activeTab === "booking" && (
            <div className="services-tab-pane services-tab-pane-booking">
              {/* Секция 1: Доступные специалисты */}
              <div className="services-form-section">
                <div className="services-section-title-wrap">
                  <h4 className="services-section-title">Доступные специалисты</h4>
                  <span className="services-section-desc">Кто может выполнять эту услугу</span>
                </div>

                <div className="services-assigned-mode-segmented" role="radiogroup" aria-label="Доступные специалисты">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={assignedMode === "all"}
                    className={`services-segmented-btn ${assignedMode === "all" ? "is-active" : ""}`}
                    onClick={() => {
                      setAssignedMode("all");
                      setAssignedEmployeeIds([]);
                    }}>
                    Все мастера
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={assignedMode === "custom"}
                    className={`services-segmented-btn ${assignedMode === "custom" ? "is-active" : ""}`}
                    onClick={() => setAssignedMode("custom")}>
                    Выборочно
                  </button>
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

              {/* Секция 2: Буферы онлайн-записи */}
              <div className="services-form-section">
                <div className="services-section-title-wrap">
                  <h4 className="services-section-title">Буферы онлайн-записи</h4>
                  <span className="services-section-desc">
                    Технические паузы для подготовки кабинета и дезинфекции
                  </span>
                </div>

                <div className="services-buffers-container">
                  {/* Buffer Before */}
                  <div className="services-buffer-row">
                    <div className="services-buffer-info">
                      <span className="services-buffer-title">Буфер перед</span>
                      <span className="services-buffer-desc">Время на подготовку кабинета</span>
                    </div>
                    <div className="services-buffer-controls">
                      {bufferBeforeEnabled ? (
                        <div className="services-buffer-input-wrap">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            className="services-buffer-number-input"
                            value={bufferBeforeMinutes}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setBufferBeforeMinutes("");
                                return;
                              }
                              const parsed = parseInt(val, 10);
                              setBufferBeforeMinutes(isNaN(parsed) ? "" : Math.max(0, parsed));
                            }}
                            onBlur={() => {
                              if (bufferBeforeMinutes === "" || bufferBeforeMinutes === null) {
                                setBufferBeforeMinutes(0);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                          />
                          <span className="services-buffer-unit">мин</span>
                        </div>
                      ) : null}
                      <Switch
                        checked={bufferBeforeEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBufferBeforeEnabled(checked);
                          if (checked && (!bufferBeforeMinutes || Number(bufferBeforeMinutes) === 0)) {
                            setBufferBeforeMinutes(15);
                          }
                        }}
                        aria-label="Включить буфер перед услугой"
                        className="services-site-switch"
                      />
                    </div>
                  </div>

                  {/* Buffer After */}
                  <div className="services-buffer-row">
                    <div className="services-buffer-info">
                      <span className="services-buffer-title">Буфер после</span>
                      <span className="services-buffer-desc">Время на уборку и подготовку</span>
                    </div>
                    <div className="services-buffer-controls">
                      {bufferAfterEnabled ? (
                        <div className="services-buffer-input-wrap">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            className="services-buffer-number-input"
                            value={bufferAfterMinutes}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setBufferAfterMinutes("");
                                return;
                              }
                              const parsed = parseInt(val, 10);
                              setBufferAfterMinutes(isNaN(parsed) ? "" : Math.max(0, parsed));
                            }}
                            onBlur={() => {
                              if (bufferAfterMinutes === "" || bufferAfterMinutes === null) {
                                setBufferAfterMinutes(0);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                          />
                          <span className="services-buffer-unit">мин</span>
                        </div>
                      ) : null}
                      <Switch
                        checked={bufferAfterEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBufferAfterEnabled(checked);
                          if (checked && (!bufferAfterMinutes || Number(bufferAfterMinutes) === 0)) {
                            setBufferAfterMinutes(15);
                          }
                        }}
                        aria-label="Включить буфер после услуги"
                        className="services-site-switch"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Секция 3: Отображение на сайте */}
              <div className="services-form-section services-site-visible-row">
                <div className="services-site-visible-meta">
                  <span className="services-site-visible-title">Отображать на сайте nuarr.pl</span>
                  <span className="services-site-visible-desc">
                    Услуга будет доступна клиентам в форме онлайн-записи
                  </span>
                </div>
                <div className="services-site-switch-wrap">
                  <Switch
                    checked={siteVisible}
                    onChange={(e) => setSiteVisible(e.target.checked)}
                    aria-label="Отображение на сайте nuarr.pl"
                    className="services-site-switch"
                  />
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

  if (isMobile && typeof document !== "undefined") {
    return createPortal(drawerContent, document.body);
  }

  return drawerContent;
}
