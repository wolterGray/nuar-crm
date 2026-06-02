import {Pencil, Plus, Trash2} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";

function ServicesPage({services, onAdd, onEdit, onDelete}) {
  return (
    <section className="catalog-page">
      <div className="employees-toolbar">
        <div>
          <h2>Услуги</h2>
          <p>{services.length} в базе</p>
        </div>
        <div className="toolbar-actions">
          <button className="add-visit-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            Добавить услугу
          </button>
          <PageNotificationsSlot />
        </div>
      </div>

      <div className="catalog-grid">
        {services.map((service) => (
          <motion.article
            className="catalog-card catalog-row-card"
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            key={service.id}>
            <div>
              <h3>{service.name}</h3>
              <span className="service-color-label">
                <i style={{background: service.color ?? "#4f8edc"}} />
                {service.category}
              </span>
            </div>
            <div className="catalog-prices">
              {service.variants.map((variant) => (
                <span key={variant.duration}>
                  {variant.duration} мин <strong>{formatMoney(variant.price)}</strong>
                </span>
              ))}
            </div>
            <div className="employee-actions">
              <button aria-label="Редактировать услугу" className="compact-icon-button" title="Редактировать" type="button" onClick={() => onEdit(service)}>
                <Pencil size={16} />
              </button>
              <button aria-label="Удалить услугу" className="compact-icon-button danger" title="Удалить" type="button" onClick={() => onDelete(service)}>
                <Trash2 size={16} />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default ServicesPage;
