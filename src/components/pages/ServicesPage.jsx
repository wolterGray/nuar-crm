import {useMemo, useState} from "react";
import {Pencil, Plus, Search, Trash2, X} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {serviceColorPalette} from "../../utils/serviceColors.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";

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
      className={`catalog-page services-page ${isMobile ? "services-page-mobile" : ""}`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        collapsedMeta={`${filteredServices.length} из ${services.length}`}
        collapsible={isMobile}
        defaultExpanded={!isMobile}
        actions={
          <>
            <label className="services-search">
              <Search size={16} />
              <input
                placeholder="Поиск услуги"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOpenMenuId(null);
                }}
              />
              {search ? (
                <button
                  aria-label="Очистить поиск"
                  type="button"
                  onClick={() => setSearch("")}>
                  <X size={15} />
                </button>
              ) : null}
            </label>
            <button className="add-visit-button" type="button" onClick={onAdd}>
              <Plus size={18} />
              {isMobile ? "Добавить" : "Добавить услугу"}
            </button>
          </>
        }
        description={`${filteredServices.length} из ${services.length} в базе`}
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
          filteredServices.map((service) => (
            <motion.article
              className={`catalog-card catalog-row-card ${isMobile ? "service-mobile-card" : ""}`}
              initial={{opacity: 0, y: 6}}
              animate={{opacity: 1, y: 0}}
              key={service.id}>
              <div className="service-card-head">
                <h3>{service.name}</h3>
                <span className="service-color-label">
                  <i style={{background: service.color ?? serviceColorPalette[0]}} />
                  {service.category}
                </span>
              </div>
              <div className="catalog-prices">
                {service.variants.map((variant) => (
                  <span key={variant.duration}>
                    {variant.duration} мин{" "}
                    <strong>{formatMoney(variant.price)}</strong>
                  </span>
                ))}
              </div>
              {isMobile ? (
                <RowActionsMenu
                  className="service-row-actions"
                  itemId={service.id}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onDelete={() => onDelete(service)}
                  onEdit={() => onEdit(service)}
                />
              ) : (
                <div className="employee-actions">
                  <button
                    aria-label="Редактировать услугу"
                    className="compact-icon-button"
                    title="Редактировать"
                    type="button"
                    onClick={() => onEdit(service)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label="Удалить услугу"
                    className="compact-icon-button danger"
                    title="Удалить"
                    type="button"
                    onClick={() => onDelete(service)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}

export default ServicesPage;
