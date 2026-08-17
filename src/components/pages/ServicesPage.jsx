import {useMemo, useState} from "react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {serviceColorPalette} from "../../utils/serviceColors.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../ui/PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {Button, EmptyState} from "../ui/index.js";

function ServicesPage({services, onAdd, onEdit, onDelete}) {
  const {isMobile} = useBreakpoint();
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return services;
    }

    return services.filter((service) =>
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
  }, [search, services]);

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
                      {isCombo ? "Комплекс" : service.category || "Без категории"}
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
