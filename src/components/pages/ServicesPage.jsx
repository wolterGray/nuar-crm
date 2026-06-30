import {useMemo, useState} from "react";
import {Plus} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {serviceColorPalette} from "../../utils/serviceColors.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../ui/PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import Button from "../ui/Button.jsx";

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
            <Button variant="primary" onClick={onAdd} className="services-page-add-button">
              <Plus size={16} />
              {isMobile ? "Добавить" : "Добавить услугу"}
            </Button>
          </div>
        }
        description={isMobile ? undefined : `${filteredServices.length} из ${services.length} услуг в базе`}
        title="Услуги"
      />

      <div className="services-grid">
        {filteredServices.length === 0 ? (
          <div className="services-empty-state">
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
                </div>

                {/* Variants Price Box */}
                {variants.length > 0 && (
                  <div className="service-variants">
                    {variants.map((variant) => (
                      <span key={variant.duration} className="service-variant-pill">
                        {variant.duration} мин <strong className="text-text-main font-semibold">{formatMoney(variant.price)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </motion.article>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ServicesPage;
