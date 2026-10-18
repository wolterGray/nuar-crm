import {useCallback, useMemo, useState} from "react";
import AppIcon from "../ui/AppIcon.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import Switch from "../ui/Switch.jsx";
import {formatMoney} from "../../utils/formatters.jsx";
import {
  getBadgeColor,
  getCategoryColor,
  getServiceBadgeStyle,
  getServiceColor,
} from "../../utils/serviceColors.js";
import {
  CANONICAL_CATEGORIES,
  inferMassageSubType,
  normalizeCategory,
} from "../../utils/serviceCategories.js";
import ServiceDrawer from "../services/ServiceDrawer.jsx";
import CategoryManagerModal from "../services/CategoryManagerModal.jsx";
import PriceListModal from "../priceList/PriceListModal.jsx";
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";
import "./ServicesPage.css";

const ALL_CATEGORIES = "__all__";

const PREFERRED_CATEGORY_ORDER = [
  "Массажи",
  "Комплексы",
  "Body Wrapping",
  "Массажи (Master)",
  "Массажи (Top-Master)",
];

const getMinPrice = (service) => {
  if (Array.isArray(service.variants) && service.variants.length > 0) {
    const validPrices = service.variants
      .map((v) => Number(v.price))
      .filter((p) => !isNaN(p) && p > 0);
    if (validPrices.length > 0) {
      return Math.min(...validPrices);
    }
  }
  return Number(service.price) || 0;
};

const getDurationsSummary = (service) => {
  if (Array.isArray(service.variants) && service.variants.length > 0) {
    const sortedDurations = [...service.variants]
      .map((v) => Number(v.duration))
      .filter((d) => !isNaN(d) && d > 0)
      .sort((a, b) => a - b);

    if (sortedDurations.length > 0) {
      return `${sortedDurations.join(" / ")} мин`;
    }
  }
  if (service.durationMin) {
    return `${service.durationMin} мин`;
  }
  return "Без длительности";
};

function ServiceRowActionsMenu({
  service,
  openMenuId,
  setOpenMenuId,
  onOpenEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  viewScope,
}) {
  const isOpen = openMenuId === service.id;
  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });

  const svcStatus = service.status || "Активна";

  const runAction = (e, fn) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(null);
    fn(service, e);
  };

  return (
    <div
      className="services-col-actions"
      onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        className={`services-row-action-btn ${isOpen ? "is-open" : ""}`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpenMenuId(isOpen ? null : service.id);
        }}
        aria-label="Действия с услугой"
        aria-expanded={isOpen}>
        <AppIcon name="more" size="xs" />
      </button>

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        <div
          className="services-action-menu-dropdown services-action-menu-portal-dropdown"
          role="menu"
          onClick={(e) => e.stopPropagation()}>
          <button
            className="services-menu-item"
            role="menuitem"
            type="button"
            onClick={(e) => runAction(e, onOpenEdit)}>
            <AppIcon name="edit" size="xs" />
            <span>Редактировать</span>
          </button>
          <button
            className="services-menu-item"
            role="menuitem"
            type="button"
            onClick={(e) => runAction(e, onDuplicate)}>
            <AppIcon name="copy" size="xs" />
            <span>Дублировать</span>
          </button>

          {viewScope === "archive" ? (
            <button
              className="services-menu-item services-menu-item-accent"
              role="menuitem"
              type="button"
              onClick={(e) =>
                runAction(e, (s, evt) => onToggleStatus(s, "Активна", evt))
              }>
              <AppIcon name="refresh" size="xs" />
              <span>Восстановить</span>
            </button>
          ) : (
            <>
              {svcStatus === "Скрыта" ? (
                <button
                  className="services-menu-item"
                  role="menuitem"
                  type="button"
                  onClick={(e) =>
                    runAction(e, (s, evt) => onToggleStatus(s, "Активна", evt))
                  }>
                  <AppIcon name="eye" size="xs" />
                  <span>Сделать активной</span>
                </button>
              ) : (
                <button
                  className="services-menu-item"
                  role="menuitem"
                  type="button"
                  onClick={(e) =>
                    runAction(e, (s, evt) => onToggleStatus(s, "Скрыта", evt))
                  }>
                  <AppIcon name="eyeOff" size="xs" />
                  <span>Скрыть</span>
                </button>
              )}
              <button
                className="services-menu-item"
                role="menuitem"
                type="button"
                onClick={(e) =>
                  runAction(e, (s, evt) => onToggleStatus(s, "Архив", evt))
                }>
                <AppIcon name="package" size="xs" />
                <span>В архив</span>
              </button>
            </>
          )}

          <div className="services-menu-divider" />

          <button
            className="services-menu-item services-menu-item-danger"
            role="menuitem"
            type="button"
            onClick={(e) => runAction(e, onDelete)}>
            <AppIcon name="trash" size="xs" />
            <span>Удалить</span>
          </button>
        </div>
      </RowActionMenuPortal>
    </div>
  );
}

export default function ServicesPage({
  services = [],
  serviceCategories = [],
  employees = [],
  onSaveService,
  onDuplicateService,
  onToggleStatus,
  onAdd: _onAdd,
  onCreateCategory,
  onDeleteCategory,
  onEdit: _onEdit,
  onDelete,
  onMoveServiceToCategory: _onMoveServiceToCategory,
  onRenameCategory,
  onReorder: _onReorder,
  appSettings = null,
  pushNotification,
}) {
  const [search, setSearch] = useState("");
  const [viewScope, setViewScope] = useState("active"); // "active" (Действующие) | "archive" (Архив)
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all" | "Активна" | "Скрыта"

  // Selection state
  const [selectedServiceIds, setSelectedServiceIds] = useState(new Set());

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("edit"); // "edit" | "create"
  const [activeDrawerService, setActiveDrawerService] = useState(null);

  // Category modal state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // Price list modal state
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  // Filter dropdown popover state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Row action menu dropdown
  const [openMenuServiceId, setOpenMenuServiceId] = useState(null);

  // Collapsed categories state (persisted in sessionStorage)
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      const saved = sessionStorage.getItem("nuar_services_collapsed_cats");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleCategoryCollapse = useCallback((catName) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      try {
        sessionStorage.setItem("nuar_services_collapsed_cats", JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Scope pools
  const activePool = useMemo(
    () => services.filter((s) => (s.status || "Активна") !== "Архив"),
    [services],
  );

  const archivePool = useMemo(
    () => services.filter((s) => (s.status || "Активна") === "Архив"),
    [services],
  );

  const currentPool = viewScope === "active" ? activePool : archivePool;

  // Dynamic categories list based on canonical groups + current services + custom categories
  const categories = useMemo(() => {
    const rawNames = [
      ...CANONICAL_CATEGORIES,
      ...serviceCategories.map(normalizeCategory),
      ...currentPool.map((s) => normalizeCategory(s.category)),
    ];
    const unique = [...new Set(rawNames.filter(Boolean))];

    // Canonical order first according to reference sequence
    unique.sort((a, b) => {
      const idxA = PREFERRED_CATEGORY_ORDER.indexOf(a);
      const idxB = PREFERRED_CATEGORY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "ru");
    });
    return unique;
  }, [currentPool, serviceCategories]);

  // Counts by normalized category within current pool
  const serviceCountsByCategory = useMemo(() => {
    const counts = new Map();
    currentPool.forEach((s) => {
      const cat = normalizeCategory(s.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return counts;
  }, [currentPool]);

  // Filtered & sorted services
  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = currentPool.filter((service) => {
      // Category filter
      if (selectedCategory !== ALL_CATEGORIES) {
        const cat = normalizeCategory(service.category);
        if (cat !== selectedCategory) return false;
      }

      // Status filter (in active mode)
      if (viewScope === "active" && selectedStatus !== "all") {
        const svcStatus = service.status || "Активна";
        if (svcStatus !== selectedStatus) return false;
      }

      // Search query
      if (query) {
        const subType = inferMassageSubType(service) || "";
        const variantsText = (service.variants ?? [])
          .flatMap((v) => [String(v.duration), String(v.price)])
          .join(" ");
        const matchString = `${service.name} ${service.category || ""} ${subType} ${variantsText} ${service.status || ""}`.toLowerCase();
        if (!matchString.includes(query)) return false;
      }

      return true;
    });

    return list;
  }, [currentPool, search, selectedCategory, selectedStatus, viewScope]);

  // Category card groups: structured by category card blocks
  const categoryGroups = useMemo(() => {
    const groups = new Map();
    const targetCategories =
      selectedCategory === ALL_CATEGORIES ? categories : [selectedCategory];

    targetCategories.forEach((cat) => {
      groups.set(cat, []);
    });

    filteredServices.forEach((service) => {
      const cat = normalizeCategory(service.category);
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat).push(service);
    });

    return Array.from(groups.entries())
      .filter(([_, list]) => list.length > 0)
      .map(([name, list]) => ({name, services: list}));
  }, [categories, filteredServices, selectedCategory]);

  // Selection handlers
  const allFilteredSelected =
    filteredServices.length > 0 &&
    filteredServices.every((s) => selectedServiceIds.has(s.id));

  const isSomeFilteredSelected =
    filteredServices.some((s) => selectedServiceIds.has(s.id)) && !allFilteredSelected;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedServiceIds(new Set());
    } else {
      setSelectedServiceIds(new Set(filteredServices.map((s) => s.id)));
    }
  };

  const handleToggleSelectRow = (id, e) => {
    e?.stopPropagation();
    setSelectedServiceIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open Drawer in edit mode (without touching checkbox selection)
  const handleOpenEdit = useCallback((service, e) => {
    e?.stopPropagation();
    setOpenMenuServiceId(null);
    setActiveDrawerService(service);
    setDrawerMode("edit");
    setIsDrawerOpen(true);
  }, []);

  // Open Drawer in create mode
  const handleOpenCreate = useCallback(() => {
    setOpenMenuServiceId(null);
    setActiveDrawerService(null);
    setDrawerMode("create");
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setActiveDrawerService(null);
  }, []);

  // Save service callback
  const handleSaveService = async (servicePayload, previousService) => {
    if (onSaveService) {
      await onSaveService(servicePayload, previousService);
      pushNotification?.({
        title: previousService ? "Услуга обновлена" : "Услуга создана",
        message: `Услуга «${servicePayload.name}» успешно сохранена.`,
      });
    }
  };

  // Duplicate service callback
  const handleDuplicate = async (service, e) => {
    e?.stopPropagation();
    setOpenMenuServiceId(null);
    if (onDuplicateService) {
      await onDuplicateService(service);
      pushNotification?.({
        title: "Услуга продублирована",
        message: `Создана копия услуги «${service.name}».`,
      });
    }
  };

  // Toggle status callback (Active / Hidden / Archive)
  const handleToggleStatusAction = async (service, nextStatus, e) => {
    e?.stopPropagation();
    setOpenMenuServiceId(null);
    if (onToggleStatus) {
      await onToggleStatus(service, nextStatus);
      pushNotification?.({
        title: "Статус обновлён",
        message: `Услуга «${service.name}»: ${nextStatus}.`,
      });
    }
  };

  // Delete service callback
  const handleDeleteService = (service, e) => {
    e?.stopPropagation();
    setOpenMenuServiceId(null);
    const ok = window.confirm(`Удалить услугу «${service.name}»? Это действие нельзя отменить.`);
    if (ok) {
      onDelete?.(service);
      pushNotification?.({
        title: "Услуга удалена",
        message: `Услуга «${service.name}» удалена из каталога.`,
      });
    }
  };

  // Batch status change
  const handleBatchStatus = async (nextStatus) => {
    const ids = Array.from(selectedServiceIds);
    if (ids.length === 0) return;

    if (nextStatus === "Архив") {
      const ok = window.confirm(
        `Переместить выбранные услуги (${ids.length}) в архив? Они станут доступны во вкладке «Архив».`,
      );
      if (!ok) return;
    }

    for (const id of ids) {
      const svc = services.find((s) => s.id === id);
      if (svc && onToggleStatus) {
        await onToggleStatus(svc, nextStatus);
      }
    }
    setSelectedServiceIds(new Set());
    pushNotification?.({
      title: "Массовое действие выполнено",
      message: `Обновлен статус для ${ids.length} услуг: ${nextStatus}.`,
    });
  };

  // Scope switcher handler
  const handleSwitchScope = (nextScope) => {
    setViewScope(nextScope);
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedServiceIds(new Set());
    setSelectedStatus("all");
    setOpenMenuServiceId(null);
  };

  // Render a single service row within a category card
  const renderServiceRow = (service) => {
    const isSelected = selectedServiceIds.has(service.id);
    const isActiveRow = activeDrawerService?.id === service.id && isDrawerOpen;
    const minPrice = getMinPrice(service);
    const durationText = getDurationsSummary(service);
    const svcStatus = service.status || "Активна";
    const isActive = svcStatus === "Активна";
    const isCombo = (service.serviceType ?? service.payload?.serviceType) === "combo";
    const isCouple = Boolean(
      service.isCouple ||
      service.isParallel ||
      service.payload?.isCouple ||
      service.payload?.isParallel ||
      String(service.name || "").toLowerCase().includes("dwojga") ||
      String(service.name || "").toLowerCase().includes("парный")
    );
    const subType = inferMassageSubType(service);
    const serviceColor = service.color || getServiceColor(service);

    return (
      <div
        key={service.id}
        className={`services-card-row ${isActiveRow ? "is-active-row" : ""} ${isSelected ? "is-selected-row" : ""}`}
        onClick={(e) => handleOpenEdit(service, e)}>
        {/* Checkbox (Mass Selection) */}
        <div className="services-col-check" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onChange={(e) => handleToggleSelectRow(service.id, e)}
            aria-label={`Выбрать ${service.name}`}
          />
        </div>

        {/* Service Name & Subtype / Couple / Combo Badges */}
        <div className="services-col-service" title={service.name}>
          <div className="services-service-info-wrap">
            <span className="services-service-name">{service.name}</span>
            <div className="services-service-tags-row">
              {subType ? (
                <span
                  className="services-badge-pill"
                  style={getServiceBadgeStyle(getBadgeColor(subType, serviceColor))}>
                  {subType}
                </span>
              ) : null}
              {isCouple && subType !== "Парный" ? (
                <span
                  className="services-badge-pill"
                  style={getServiceBadgeStyle(getBadgeColor("Парный", serviceColor))}>
                  Парный
                </span>
              ) : null}
              {isCombo ? (
                <span
                  className="services-badge-pill"
                  style={getServiceBadgeStyle(getBadgeColor("Комплекс", serviceColor))}>
                  Комплекс
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="services-col-duration" title={durationText}>
          {durationText}
        </div>

        {/* Price From */}
        <div className="services-col-price">{formatMoney(minPrice)}</div>

        {/* Active Toggle Switch (Semantic Green #10b981) */}
        <div className="services-col-switch" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isActive}
            onChange={() =>
              handleToggleStatusAction(
                service,
                isActive ? "Скрыта" : "Активна",
              )
            }
            aria-label={isActive ? "Скрыть услугу" : "Сделать активной"}
            className="services-row-switch"
          />
        </div>

        {/* Actions menu (Rendered via Portal to avoid container overflow clipping) */}
        <ServiceRowActionsMenu
          service={service}
          openMenuId={openMenuServiceId}
          setOpenMenuId={setOpenMenuServiceId}
          onOpenEdit={handleOpenEdit}
          onDuplicate={handleDuplicate}
          onToggleStatus={handleToggleStatusAction}
          onDelete={handleDeleteService}
          viewScope={viewScope}
        />
      </div>
    );
  };

  return (
    <div
      className="services-page-root"
      onClick={() => setOpenMenuServiceId(null)}>
      {/* 1. TOP HEADER */}
      <header className="services-top-header">
        <div className="services-title-area">
          <div className="services-title-row">
            <h1 className="services-main-title">Услуги</h1>
            <span className="services-count-badge" title="Всего услуг в каталоге">
              {services.length}
            </span>
          </div>
          <p className="services-subtitle">Управление услугами, ценами и онлайн-записью</p>
        </div>

        <div className="services-header-controls">
          {/* Search Box + Filter Popover */}
          <div className="services-search-with-filter">
            <div className="services-search-box">
              <AppIcon className="services-search-icon" name="search" size="xs" />
              <input
                autoComplete="off"
                autoCorrect="off"
                className="services-search-input"
                placeholder="Поиск по названию или виду..."
                spellCheck="false"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button
                  className="services-search-clear"
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Очистить поиск">
                  <AppIcon name="x" size="xs" />
                </button>
              ) : null}
            </div>

            {/* Filter icon button with popover */}
            <div className="services-filter-popover-wrap">
              <button
                className={`services-filter-icon-btn ${viewScope === "archive" || selectedStatus !== "all" ? "is-active" : ""}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterMenuOpen((prev) => !prev);
                }}
                aria-label="Фильтры каталога"
                title="Фильтры каталога">
                <AppIcon name="sliders" size="xs" />
                {viewScope === "archive" || selectedStatus !== "all" ? (
                  <span className="services-filter-active-dot" />
                ) : null}
              </button>

              {isFilterMenuOpen && (
                <div
                  className="services-filter-dropdown"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="services-filter-dropdown-section">
                    <span className="services-filter-dropdown-title">Режим каталога</span>
                    <div className="services-filter-toggle-row">
                      <button
                        type="button"
                        className={`services-filter-toggle-btn ${viewScope === "active" ? "is-active" : ""}`}
                        onClick={() => {
                          handleSwitchScope("active");
                          setIsFilterMenuOpen(false);
                        }}>
                        Действующие ({activePool.length})
                      </button>
                      <button
                        type="button"
                        className={`services-filter-toggle-btn ${viewScope === "archive" ? "is-active" : ""}`}
                        onClick={() => {
                          handleSwitchScope("archive");
                          setIsFilterMenuOpen(false);
                        }}>
                        Архив ({archivePool.length})
                      </button>
                    </div>
                  </div>

                  {viewScope === "active" && (
                    <div className="services-filter-dropdown-section">
                      <span className="services-filter-dropdown-title">Статус активности</span>
                      <div className="services-filter-toggle-row">
                        <button
                          type="button"
                          className={`services-filter-toggle-btn ${selectedStatus === "all" ? "is-active" : ""}`}
                          onClick={() => {
                            setSelectedStatus("all");
                            setIsFilterMenuOpen(false);
                          }}>
                          Все
                        </button>
                        <button
                          type="button"
                          className={`services-filter-toggle-btn ${selectedStatus === "Активна" ? "is-active" : ""}`}
                          onClick={() => {
                            setSelectedStatus("Активна");
                            setIsFilterMenuOpen(false);
                          }}>
                          Активные
                        </button>
                        <button
                          type="button"
                          className={`services-filter-toggle-btn ${selectedStatus === "Скрыта" ? "is-active" : ""}`}
                          onClick={() => {
                            setSelectedStatus("Скрыта");
                            setIsFilterMenuOpen(false);
                          }}>
                          Скрытые
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manage Categories Button */}
          <button
            className="services-btn-categories"
            type="button"
            onClick={() => setIsCatModalOpen(true)}>
            <AppIcon name="sliders" size="xs" />
            <span className="services-categories-label-long">Управление категориями</span>
            <span className="services-categories-label-short">Категории</span>
          </button>

          {/* Price List Generator Button */}
          <button
            className="services-btn-price"
            type="button"
            onClick={() => setIsPriceListOpen(true)}>
            <AppIcon name="fileText" size="xs" />
            <span>Прайс</span>
          </button>

          {/* Add Service Button */}
          <button
            className="services-btn-add-primary"
            type="button"
            onClick={handleOpenCreate}>
            <AppIcon name="plus" size="xs" />
            Добавить услугу
          </button>
        </div>
      </header>

      {/* 2. FILTER BAR (Category Pills) */}
      <section className="services-filter-bar" aria-label="Фильтры категорий">
        <div className="services-cat-pills-row">
          <button
            className={`services-cat-pill ${selectedCategory === ALL_CATEGORIES ? "is-active" : ""}`}
            type="button"
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}>
            Все {currentPool.length}
          </button>

          {categories.map((cat) => {
            const count = serviceCountsByCategory.get(cat) ?? 0;
            if (count === 0 && !CANONICAL_CATEGORIES.includes(cat)) return null;
            return (
              <button
                key={cat}
                className={`services-cat-pill ${selectedCategory === cat ? "is-active" : ""}`}
                type="button"
                onClick={() => setSelectedCategory(cat)}>
                {cat} {count}
              </button>
            );
          })}
        </div>

        {viewScope === "archive" ? (
          <div className="services-archive-banner-pill">
            <AppIcon name="package" size="xs" />
            <span>Архивные позиции ({archivePool.length})</span>
          </div>
        ) : null}
      </section>

      {/* 3. WORKSPACE CONTAINER (Category Cards + Drawer) */}
      <div className="services-workspace-container">
        {/* MAIN LIST AREA */}
        <div className="services-table-area">
          {/* Batch Actions Bar (when rows are selected) */}
          {selectedServiceIds.size > 0 && (
            <div className="services-batch-bar" role="toolbar" aria-label="Панель массовых действий">
              <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <Checkbox
                  checked={allFilteredSelected}
                  indeterminate={isSomeFilteredSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Выбрать все"
                />
                <span className="services-batch-count">Выбрано: {selectedServiceIds.size}</span>
              </div>
              <div className="services-batch-actions">
                {viewScope === "active" ? (
                  <>
                    <button
                      className="services-batch-btn"
                      type="button"
                      onClick={() => handleBatchStatus("Активна")}>
                      Активировать
                    </button>
                    <button
                      className="services-batch-btn"
                      type="button"
                      onClick={() => handleBatchStatus("Скрыта")}>
                      Скрыть
                    </button>
                    <button
                      className="services-batch-btn services-batch-btn-danger"
                      type="button"
                      onClick={() => handleBatchStatus("Архив")}>
                      В архив
                    </button>
                  </>
                ) : (
                  <button
                    className="services-batch-btn services-batch-btn-accent"
                    type="button"
                    onClick={() => handleBatchStatus("Активна")}>
                    Восстановить из архива
                  </button>
                )}
                <button
                  className="services-batch-btn services-batch-btn-ghost"
                  type="button"
                  onClick={() => setSelectedServiceIds(new Set())}>
                  Снять выбор
                </button>
              </div>
            </div>
          )}

          <div className="services-table-scroll">
            {filteredServices.length === 0 ? (
              <div className="services-empty-state">
                <AppIcon name="search" size="md" className="services-empty-icon" />
                <p>
                  {search
                    ? "По вашему запросу услуг не найдено"
                    : viewScope === "archive"
                      ? "В архиве нет услуг"
                      : "В выбранной категории пока нет услуг"}
                </p>
                {search ? (
                  <button
                    type="button"
                    className="services-empty-reset-btn"
                    onClick={() => setSearch("")}>
                    Сбросить поиск
                  </button>
                ) : null}
              </div>
            ) : (
              categoryGroups.map((group) => {
                const isCollapsed = collapsedCategories.has(group.name);
                return (
                  <div key={group.name} className="services-category-card">
                    <div
                      className="services-category-card-header"
                      onClick={() => toggleCategoryCollapse(group.name)}>
                      <div className="services-category-header-left">
                        <span
                          className="services-category-card-dot"
                          style={{backgroundColor: getCategoryColor(group.name)}}
                          aria-hidden="true"
                        />
                        <h3 className="services-category-card-title">{group.name}</h3>
                        <span className="services-category-card-count">{group.services.length}</span>
                      </div>
                      <div className="services-category-header-right">
                        <span className="services-category-col-label services-col-label-duration">
                          Длительность
                        </span>
                        <span className="services-category-col-label services-col-label-price">
                          Цена от
                        </span>
                        <button
                          type="button"
                          className="services-category-collapse-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryCollapse(group.name);
                          }}
                          aria-label={
                            isCollapsed
                              ? `Развернуть категорию ${group.name}`
                              : `Свернуть категорию ${group.name}`
                          }>
                          <AppIcon name={isCollapsed ? "chevronDown" : "chevronUp"} size="xs" />
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="services-category-card-body">
                        {group.services.map(renderServiceRow)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 5. RIGHT DRAWER FOR EDIT / CREATE */}
        <ServiceDrawer
          isOpen={isDrawerOpen}
          mode={drawerMode}
          service={activeDrawerService}
          categories={categories}
          employees={employees}
          allServices={services}
          onClose={handleCloseDrawer}
          onSave={handleSaveService}
        />
      </div>

      {/* 6. CATEGORY MANAGEMENT MODAL */}
      <CategoryManagerModal
        isOpen={isCatModalOpen}
        categories={categories}
        categoryCounts={serviceCountsByCategory}
        onClose={() => setIsCatModalOpen(false)}
        onCreateCategory={onCreateCategory}
        onRenameCategory={onRenameCategory}
        onDeleteCategory={onDeleteCategory}
      />

      {/* 7. PRICE LIST GENERATOR MODAL */}
      <PriceListModal
        isOpen={isPriceListOpen}
        onClose={() => setIsPriceListOpen(false)}
        services={services}
        serviceCategories={categories}
        appSettings={appSettings}
        pushNotification={pushNotification}
      />
    </div>
  );
}
