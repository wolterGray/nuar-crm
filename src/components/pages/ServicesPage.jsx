import {useMemo, useState} from "react";
import {Plus} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {serviceColorPalette} from "../../utils/serviceColors.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";

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
    <section
      className={`panel catalog-page services-page ${isMobile ? "services-page-mobile" : ""}`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        actions={
          <>
            <SearchControl
              className="services-search-control"
              placeholder="Поиск услуги"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenMenuId(null);
              }}
              onClear={() => setSearch("")}
            />
            <button className="add-visit-button" type="button" onClick={onAdd}>
              <Plus size={18} />
              {isMobile ? "Добавить" : "Добавить услугу"}
            </button>
          </>
        }
        description={isMobile ? undefined : `${filteredServices.length} из ${services.length} в базе`}
        title="Услуги"
      />

      <div className="catalog-grid services-grid">
        {filteredServices.length === 0 ? (
          <div className="services-empty">
            <strong>{search.trim() ? "Ничего не найдено" : "Услуг пока нет"}</strong>
            <span>
              {search.trim()
                ? "Попробуйте изменить запрос."
                : "Добавьте первую услугу в каталог."}
            </span>
          </div>
        ) : (
          filteredServices.map((service) => {
            const variants = service.variants ?? [];

            return (
              <motion.article
                className={`catalog-card catalog-row-card service-row-card ${isMobile ? "service-mobile-card" : ""}`}
                initial={{opacity: 0, y: 6}}
                animate={{opacity: 1, y: 0}}
                key={service.id}>
                <div className="service-card-main">
                  <div className="service-card-head">
                    <h3>{service.name}</h3>
                    <span className="service-color-label">
                      <i style={{background: service.color ?? serviceColorPalette[0]}} />
                      {service.category || "Без категории"}
                    </span>
                  </div>
                  <div className="service-card-meta">
                    <span>{variants.length} вариантов</span>
                    <span>
                      {variants.length > 0
                        ? `${Math.min(...variants.map((variant) => Number(variant.duration) || 0))}-${Math.max(...variants.map((variant) => Number(variant.duration) || 0))} мин`
                        : "Без длительности"}
                    </span>
                  </div>
                </div>
                <div className="catalog-prices service-prices">
                  {variants.map((variant) => (
                    <span key={variant.duration}>
                      {variant.duration} мин{" "}
                      <strong>{formatMoney(variant.price)}</strong>
                    </span>
                  ))}
                </div>
                <RowActionsMenu
                  className="service-row-actions"
                  itemId={service.id}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onDelete={() => onDelete(service)}
                  onEdit={() => onEdit(service)}
                />
              </motion.article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default ServicesPage;
