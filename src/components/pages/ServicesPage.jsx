import {useMemo, useState} from "react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {serviceColorPalette} from "../../utils/serviceColors.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../ui/PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {Button, EmptyState, Input, Select} from "../ui/index.js";

const DEFAULT_CATEGORIES = ["Массаж", "Комплексы"];
const ALL_CATEGORIES = "__all__";
const normalizeCategory = (value) => String(value ?? "").trim();

function ServicesPage({
  services,
  serviceCategories = [],
  onAdd,
  onCreateCategory,
  onDelete,
  onDeleteCategory,
  onEdit,
  onMoveServiceToCategory,
  onRenameCategory,
}) {
  const {isMobile} = useBreakpoint();
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const categories = useMemo(() => {
    const names = [
      ...DEFAULT_CATEGORIES,
      ...serviceCategories,
      ...services.map((service) => normalizeCategory(service.category)),
    ].filter(Boolean);

    return [...new Set(names)].sort((left, right) => left.localeCompare(right, "ru"));
  }, [serviceCategories, services]);

  const serviceCountsByCategory = useMemo(
    () =>
      services.reduce((counts, service) => {
        const category = normalizeCategory(service.category) || "Без категории";
        counts.set(category, (counts.get(category) ?? 0) + 1);
        return counts;
      }, new Map()),
    [services],
  );

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const categoryFilteredServices =
      selectedCategory === ALL_CATEGORIES
        ? services
        : services.filter(
            (service) =>
              (normalizeCategory(service.category) || "Без категории") === selectedCategory,
          );

    if (!query) return categoryFilteredServices;

    return categoryFilteredServices.filter((service) =>
      [
        service.name,
        service.category,
        ...(service.variants ?? []).flatMap((variant) => [
          String(variant.duration),
          String(variant.price),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, selectedCategory, services]);

  const selectedCategoryCount =
    selectedCategory === ALL_CATEGORIES
      ? services.length
      : serviceCountsByCategory.get(selectedCategory) ?? 0;
  const canManageSelectedCategory = selectedCategory !== ALL_CATEGORIES;

  return (
    <div
      className="services-page"
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        className="services-page-header"
        actions={
          <div className="services-page-toolbar">
            <SearchControl
              className="services-page-search"
              placeholder="Поиск услуги"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenMenuId(null);
              }}
              onClear={() => setSearch("")}
            />
            <Button
              className="services-page-add-button"
              leftIcon="plus"
              variant="secondary"
              onClick={() => onAdd("service")}>
              {isMobile ? "Добавить" : "Добавить услугу"}
            </Button>
            <Button
              className="services-page-add-button"
              leftIcon="plus"
              variant="primary"
              onClick={() => onAdd("combo")}>
              {isMobile ? "Комплекс" : "Комплекс услуг"}
            </Button>
          </div>
        }
        description={isMobile ? undefined : `${filteredServices.length} из ${services.length} услуг в базе`}
        title={
          isMobile ? (
            <span className="flex items-baseline gap-2">
              <span>Услуги</span>
              <span className="text-sm font-normal text-muted-foreground">({services.length})</span>
            </span>
          ) : (
            "Услуги"
          )
        }
      />

      <section className="service-categories-panel" aria-label="Категории услуг">
        <div className="service-category-tabs">
          <button
            className={selectedCategory === ALL_CATEGORIES ? "is-active" : ""}
            type="button"
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}>
            Все <span>{services.length}</span>
          </button>
          {categories.map((category) => (
            <button
              className={selectedCategory === category ? "is-active" : ""}
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setEditingCategoryName(category);
              }}>
              {category} <span>{serviceCountsByCategory.get(category) ?? 0}</span>
            </button>
          ))}
        </div>
        <form
          className="service-category-create"
          onSubmit={(event) => {
            event.preventDefault();
            const name = normalizeCategory(newCategory);
            if (!name) return;
            onCreateCategory?.(name);
            setSelectedCategory(name);
            setEditingCategoryName(name);
            setNewCategory("");
          }}>
          <Input
            aria-label="Новая категория"
            placeholder="Новая категория"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          />
          <Button size="sm" type="submit" variant="secondary">
            Создать
          </Button>
        </form>
      </section>

      {canManageSelectedCategory ? (
        <section className="service-category-manage">
          <span>{selectedCategoryCount} услуг</span>
          <Input
            aria-label="Название категории"
            value={editingCategoryName || selectedCategory}
            onChange={(event) => setEditingCategoryName(event.target.value)}
          />
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => {
              const nextName = normalizeCategory(editingCategoryName);
              if (!nextName) return;
              onRenameCategory?.(selectedCategory, nextName);
              setSelectedCategory(nextName);
              setEditingCategoryName(nextName);
            }}>
            Переименовать
          </Button>
          <Button
            size="sm"
            type="button"
            variant="danger"
            onClick={() => {
              const confirmed =
                selectedCategoryCount === 0 ||
                window.confirm(
                  `Удалить категорию "${selectedCategory}"? Услуги будут перенесены в "Без категории".`,
                );
              if (!confirmed) return;
              onDeleteCategory?.(selectedCategory);
              setSelectedCategory(ALL_CATEGORIES);
              setEditingCategoryName("");
            }}>
            Удалить
          </Button>
        </section>
      ) : null}

      <div className="services-grid">
        {filteredServices.length === 0 ? (
          <EmptyState
            className="services-empty-state"
            description={
              search.trim()
                ? "Попробуйте изменить запрос."
                : "Добавьте первую услугу в каталог."
            }
            icon={search.trim() ? "search" : "plus"}
            title={search.trim() ? "Ничего не найдено" : "Услуг пока нет"}
          />
        ) : (
          filteredServices.map((service) => {
            const variants = service.variants ?? [];
            const isCombo = (service.serviceType ?? service.payload?.serviceType) === "combo";
            const visibleVariants = variants.slice(0, 2);
            const hiddenVariantsCount = Math.max(0, variants.length - visibleVariants.length);

            return (
              <motion.article
                className="catalog-card service-card"
                initial={{opacity: 0, y: 6}}
                animate={{opacity: 1, y: 0}}
                key={service.id}>

                {/* Main Head */}
                <div className="service-card-header">
                  <div className="service-card-title">
                    <h3>{service.name}</h3>
                    <span>
                      <span
                        className="service-card-dot"
                        style={{backgroundColor: service.color ?? serviceColorPalette[0]}}
                      />
                      {service.category || "Без категории"}
                    </span>
                  </div>

                  <RowActionsMenu
                    itemId={service.id}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    onDelete={() => onDelete(service)}
                    onEdit={() => onEdit(service)}
                  />
                </div>

                <div className="service-card-meta">
                  <span>{variants.length} вариантов</span>
                  <span>•</span>
                  <span>
                    {variants.length > 0
                      ? `${Math.min(...variants.map((v) => Number(v.duration) || 0))}-${Math.max(...variants.map((v) => Number(v.duration) || 0))} мин`
                      : "Без длительности"}
                  </span>
                  {isCombo ? (
                    <>
                      <span>•</span>
                      <span>{service.payload?.comboItems?.length ?? service.comboItems?.length ?? 0} услуг</span>
                    </>
                  ) : null}
                  <Select
                    className="service-card-category-select"
                    aria-label="Перенести в категорию"
                    value={service.category || "Без категории"}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onMoveServiceToCategory?.(service, event.target.value)}>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    {!categories.includes("Без категории") ? (
                      <option value="Без категории">Без категории</option>
                    ) : null}
                  </Select>
                </div>

                {/* Variants Price Box */}
                <div className="service-variants">
                  {variants.length > 0 ? (
                    <>
                      {visibleVariants.map((variant) => (
                        <span key={variant.duration} className="service-variant-pill">
                          {isCombo ? "комплекс" : `${variant.duration} мин`}
                          <strong className="text-text-main font-semibold">{formatMoney(variant.price)}</strong>
                        </span>
                      ))}
                      {hiddenVariantsCount > 0 ? (
                        <span className="service-variant-pill is-more">
                          +{hiddenVariantsCount}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="service-variant-pill is-empty">
                      Настроить цену
                    </span>
                  )}
                </div>
              </motion.article>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ServicesPage;
