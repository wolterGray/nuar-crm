import {useCallback, useMemo, useState} from "react";
import AppIcon from "../ui/AppIcon.jsx";
import Checkbox from "../ui/Checkbox.jsx";
import {formatMoney} from "../../utils/formatters.jsx";
import {getCategoryColor} from "../../utils/serviceColors.js";
import {
  CANONICAL_CATEGORIES,
  formatServiceCountRu,
  inferMassageSubType,
  normalizeCategory,
} from "../../utils/serviceCategories.js";
import ServiceDrawer from "../services/ServiceDrawer.jsx";
import CategoryManagerModal from "../services/CategoryManagerModal.jsx";
import PriceListModal from "../priceList/PriceListModal.jsx";
import "./ServicesPage.css";

const ALL_CATEGORIES = "__all__";

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
  pushNotification,
}) {
  const [search, setSearch] = useState("");
  const [viewScope, setViewScope] = useState("active"); // "active" (Действующие) | "archive" (Архив)
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all" | "Активна" | "Скрыта"
  const [sortField, setSortField] = useState(null); // "name" | "category" | "price" | "status"
  const [sortDirection, setSortDirection] = useState("asc");

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

  // Row action menu dropdown
  const [openMenuServiceId, setOpenMenuServiceId] = useState(null);

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

    // Canonical order first
    unique.sort((a, b) => {
      const idxA = CANONICAL_CATEGORIES.indexOf(a);
      const idxB = CANONICAL_CATEGORIES.indexOf(b);
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

    // Sorting
    if (sortField) {
      list = [...list].sort((a, b) => {
        let valA, valB;
        if (sortField === "name") {
          valA = a.name || "";
          valB = b.name || "";
          return sortDirection === "asc"
            ? valA.localeCompare(valB, "ru")
            : valB.localeCompare(valA, "ru");
        }
        if (sortField === "category") {
          valA = normalizeCategory(a.category);
          valB = normalizeCategory(b.category);
          return sortDirection === "asc"
            ? valA.localeCompare(valB, "ru")
            : valB.localeCompare(valA, "ru");
        }
        if (sortField === "price") {
          valA = getMinPrice(a);
          valB = getMinPrice(b);
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }
        if (sortField === "status") {
          valA = a.status || "Активна";
          valB = b.status || "Активна";
          return sortDirection === "asc"
            ? valA.localeCompare(valB, "ru")
            : valB.localeCompare(valA, "ru");
        }
        return 0;
      });
    }

    return list;
  }, [currentPool, search, selectedCategory, selectedStatus, sortDirection, sortField, viewScope]);

  // Grouped structure: when "Все" category is selected and no sorting applied
  const isGrouped = selectedCategory === ALL_CATEGORIES && !sortField && !search.trim();

  const groupedServices = useMemo(() => {
    if (!isGrouped) return null;

    const groups = new Map();
    // Initialize groups in canonical order
    categories.forEach((cat) => {
      groups.set(cat, []);
    });

    filteredServices.forEach((service) => {
      const cat = normalizeCategory(service.category);
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat).push(service);
    });

    // Return only non-empty groups
    return Array.from(groups.entries())
      .filter(([_, list]) => list.length > 0)
      .map(([name, list]) => ({name, services: list}));
  }, [categories, filteredServices, isGrouped]);

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

  // Sort toggle helper
  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Scope switcher handler
  const handleSwitchScope = (nextScope) => {
    setViewScope(nextScope);
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedServiceIds(new Set());
    setSelectedStatus("all");
    setOpenMenuServiceId(null);
  };

  // Render a single service table row
  const renderServiceRow = (service) => {
    const isSelected = selectedServiceIds.has(service.id);
    const isActiveRow = activeDrawerService?.id === service.id && isDrawerOpen;
    const minPrice = getMinPrice(service);
    const durationText = getDurationsSummary(service);
    const variantsCount = (service.variants ?? []).length || 1;
    const svcStatus = service.status || "Активна";
    const isCombo = (service.serviceType ?? service.payload?.serviceType) === "combo";
    const subType = inferMassageSubType(service);
    const normalizedCat = normalizeCategory(service.category);
    const catColor = getCategoryColor(normalizedCat);
    const isMenuOpen = openMenuServiceId === service.id;

    return (
      <div
        key={service.id}
        className={`services-table-row ${isActiveRow ? "is-active-row" : ""} ${isSelected ? "is-selected-row" : ""}`}
        onClick={(e) => handleOpenEdit(service, e)}>
        {/* Checkbox (Mass Selection) */}
        <div className="services-col-check" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onChange={(e) => handleToggleSelectRow(service.id, e)}
            aria-label={`Выбрать ${service.name}`}
          />
        </div>

        {/* Service Name & Subtype Tag */}
        <div className="services-col-service" title={service.name}>
          <div className="services-service-info-wrap">
            <span className="services-service-name">{service.name}</span>
            <div className="services-service-tags-row">
              {subType ? <span className="services-subtype-tag">{subType}</span> : null}
              {isCombo ? <span className="services-combo-badge">Комплекс</span> : null}
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="services-col-category">
          <span
            className="services-cat-dot"
            style={{backgroundColor: catColor}}
            aria-hidden="true"
          />
          <span>{normalizedCat}</span>
        </div>

        {/* Variants Count */}
        <div className="services-col-variants">
          <span className="services-variants-badge">{variantsCount}</span>
        </div>

        {/* Duration list */}
        <div className="services-col-duration" title={durationText}>
          {durationText}
        </div>

        {/* Price From */}
        <div className="services-col-price">{formatMoney(minPrice)}</div>

        {/* Status */}
        <div className="services-col-status">
          <span
            className={`services-status-badge status-${
              svcStatus === "Активна"
                ? "active"
                : svcStatus === "Скрыта"
                  ? "hidden"
                  : "archived"
            }`}>
            <span className="services-badge-dot" />
            {svcStatus}
          </span>
        </div>

        {/* Actions menu */}
        <div
          className="services-col-actions"
          onClick={(e) => e.stopPropagation()}>
          <button
            className="services-row-action-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuServiceId(isMenuOpen ? null : service.id);
            }}
            aria-label="Действия с услугой">
            <AppIcon name="more" size="xs" />
          </button>

          {isMenuOpen ? (
            <div
              className="services-action-menu-dropdown"
              onClick={(e) => e.stopPropagation()}>
              <button
                className="services-menu-item"
                type="button"
                onClick={(e) => handleOpenEdit(service, e)}>
                <AppIcon name="edit" size="xs" />
                Редактировать
              </button>
              <button
                className="services-menu-item"
                type="button"
                onClick={(e) => handleDuplicate(service, e)}>
                <AppIcon name="copy" size="xs" />
                Дублировать
              </button>

              {viewScope === "archive" ? (
                <button
                  className="services-menu-item services-menu-item-accent"
                  type="button"
                  onClick={(e) => handleToggleStatusAction(service, "Активна", e)}>
                  <AppIcon name="refresh" size="xs" />
                  Восстановить
                </button>
              ) : (
                <>
                  {svcStatus === "Скрыта" ? (
                    <button
                      className="services-menu-item"
                      type="button"
                      onClick={(e) => handleToggleStatusAction(service, "Активна", e)}>
                      <AppIcon name="eye" size="xs" />
                      Сделать активной
                    </button>
                  ) : (
                    <button
                      className="services-menu-item"
                      type="button"
                      onClick={(e) => handleToggleStatusAction(service, "Скрыта", e)}>
                      <AppIcon name="eyeOff" size="xs" />
                      Скрыть
                    </button>
                  )}
                  <button
                    className="services-menu-item"
                    type="button"
                    onClick={(e) => handleToggleStatusAction(service, "Архив", e)}>
                    <AppIcon name="package" size="xs" />
                    В архив
                  </button>
                </>
              )}

              <button
                className="services-menu-item services-menu-item-danger"
                type="button"
                onClick={(e) => handleDeleteService(service, e)}>
                <AppIcon name="trash" size="xs" />
                Удалить
              </button>
            </div>
          ) : null}
        </div>
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
          {/* Scope Toggle: Действующие | Архив */}
          <div className="services-scope-toggle" role="group" aria-label="Режим каталога">
            <button
              type="button"
              className={`services-scope-btn ${viewScope === "active" ? "is-active" : ""}`}
              onClick={() => handleSwitchScope("active")}>
              Действующие
              <span className="services-scope-count">{activePool.length}</span>
            </button>
            <button
              type="button"
              className={`services-scope-btn ${viewScope === "archive" ? "is-active" : ""}`}
              onClick={() => handleSwitchScope("archive")}>
              Архив
              {archivePool.length > 0 ? (
                <span className="services-scope-count">{archivePool.length}</span>
              ) : null}
            </button>
          </div>

          {/* Search Box */}
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

      {/* 2. FILTER BAR (Categories + Status) */}
      <section className="services-filter-bar" aria-label="Фильтры услуг">
        <div className="services-cat-pills-row">
          <button
            className={`services-cat-pill ${selectedCategory === ALL_CATEGORIES ? "is-active" : ""}`}
            type="button"
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}>
            Все
            <span className="services-cat-pill-count">{currentPool.length}</span>
          </button>

          {categories.map((cat) => {
            const count = serviceCountsByCategory.get(cat) ?? 0;
            // Hide category pill if it has 0 services in current pool (unless it's canonical in active view)
            if (count === 0 && !CANONICAL_CATEGORIES.includes(cat)) return null;
            return (
              <button
                key={cat}
                className={`services-cat-pill ${selectedCategory === cat ? "is-active" : ""}`}
                type="button"
                onClick={() => setSelectedCategory(cat)}>
                {cat}
                <span className="services-cat-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Status Dropdown Filter (Available in Active View) */}
        {viewScope === "active" ? (
          <div className="services-status-filter-wrap">
            <AppIcon className="services-status-icon" name="filter" size="xs" />
            <select
              className="services-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Фильтрация по статусу">
              <option value="all">Статус: Все</option>
              <option value="Активна">Статус: Активные</option>
              <option value="Скрыта">Статус: Скрытые</option>
            </select>
            <AppIcon className="services-status-chevron" name="chevronDown" size="xs" />
          </div>
        ) : (
          <div className="services-archive-banner-pill">
            <AppIcon name="package" size="xs" />
            <span>Архивные позиции ({archivePool.length})</span>
          </div>
        )}
      </section>

      {/* 3. WORKSPACE CONTAINER (Table + Drawer) */}
      <div className="services-workspace-container">
        {/* MAIN TABLE AREA */}
        <div className="services-table-area">
          <div className={`services-table-head ${selectedServiceIds.size > 0 ? "is-batch-active" : ""}`}>
            <div className="services-col-check">
              <Checkbox
                checked={allFilteredSelected}
                indeterminate={isSomeFilteredSelected}
                onChange={handleToggleSelectAll}
                aria-label="Выбрать все отображаемые услуги"
              />
            </div>

            {selectedServiceIds.size > 0 ? (
              <div className="services-table-head-batch" role="toolbar" aria-label="Панель массовых действий">
                <span className="services-batch-count">Выбрано: {selectedServiceIds.size}</span>
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
            ) : (
              <>
                <div
                  className="services-col-service services-sortable-th"
                  onClick={() => handleSort("name")}>
                  <span>Услуга</span>
                  {sortField === "name" ? (
                    <AppIcon name={sortDirection === "asc" ? "chevronUp" : "chevronDown"} size="xs" />
                  ) : null}
                </div>
                <div
                  className="services-col-category services-sortable-th"
                  onClick={() => handleSort("category")}>
                  <span>Категория</span>
                  {sortField === "category" ? (
                    <AppIcon name={sortDirection === "asc" ? "chevronUp" : "chevronDown"} size="xs" />
                  ) : null}
                </div>
                <div className="services-col-variants">Варианты</div>
                <div className="services-col-duration">Продолжительность</div>
                <div
                  className="services-col-price services-sortable-th"
                  onClick={() => handleSort("price")}>
                  <span>Цена от</span>
                  {sortField === "price" ? (
                    <AppIcon name={sortDirection === "asc" ? "chevronUp" : "chevronDown"} size="xs" />
                  ) : null}
                </div>
                <div
                  className="services-col-status services-sortable-th"
                  onClick={() => handleSort("status")}>
                  <span>Статус</span>
                  {sortField === "status" ? (
                    <AppIcon name={sortDirection === "asc" ? "chevronUp" : "chevronDown"} size="xs" />
                  ) : null}
                </div>
                <div className="services-col-actions" />
              </>
            )}
          </div>

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
            ) : isGrouped && groupedServices ? (
              // Grouped view by category with elegant non-collapsible section headers
              groupedServices.map((group) => (
                <div key={group.name} className="services-table-group-section">
                  <div className="services-group-divider">
                    <div className="services-group-divider-content">
                      <span
                        className="services-group-dot"
                        style={{backgroundColor: getCategoryColor(group.name)}}
                        aria-hidden="true"
                      />
                      <strong className="services-group-title">{group.name}</strong>
                      <span className="services-group-count">
                        · {group.services.length} {formatServiceCountRu(group.services.length)}
                      </span>
                    </div>
                  </div>
                  {group.services.map(renderServiceRow)}
                </div>
              ))
            ) : (
              // Flat view (when filtered by category, searched, or sorted)
              filteredServices.map(renderServiceRow)
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
        pushNotification={pushNotification}
      />
    </div>
  );
}
