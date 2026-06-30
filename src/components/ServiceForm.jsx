import {useMemo} from "react";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";
import {Button} from "./ui/index.js";

const serviceDurations = [30, 60, 75, 90, 120];

function ServiceBufferToggle({defaultChecked, hint, label, name}) {
  return (
    <div className="service-buffer-toggle-row">
      <label className="service-buffer-toggle">
        <input
          className="service-buffer-toggle-input"
          defaultChecked={defaultChecked}
          name={name}
          type="checkbox"
        />
        <span aria-hidden="true" className="service-buffer-toggle-box" />
        <span className="service-buffer-toggle-label">{label}</span>
      </label>
      <HintIcon className="service-buffer-toggle-hint">{hint}</HintIcon>
    </div>
  );
}

function ServiceBookingBuffers({service}) {
  return (
    <div className="employee-pricing-panel service-booking-buffers">
      <div className="service-booking-buffers-heading">
        <h3>
          Буферы онлайн-записи
          <HintIcon>
            Дополнительное время до и после услуги для онлайн-записи на сайте.
            Учитывается при расчёте свободных слотов вместе с занятостью календаря.
          </HintIcon>
        </h3>
      </div>
      <div className="service-buffer-group">
        <ServiceBufferToggle
          defaultChecked={service?.siteBookingBufferBeforeEnabled ?? false}
          hint="Сколько минут должно быть свободно перед началом записи. Например, 15 минут на подготовку кабинета."
          label="Буфер до услуги"
          name="siteBookingBufferBeforeEnabled"
        />
        <label className="service-buffer-field">
          <FieldLabel hint="Минуты до начала услуги, если буфер включён.">
            Минут до
          </FieldLabel>
          <input
            min="0"
            name="siteBookingBufferBeforeMinutes"
            type="number"
            defaultValue={service?.siteBookingBufferBeforeMinutes ?? 15}
          />
        </label>
      </div>
      <div className="service-buffer-group">
        <ServiceBufferToggle
          defaultChecked={service?.siteBookingBufferAfterEnabled ?? false}
          hint="Сколько минут блокировать после окончания услуги. Например, 30 минут на уборку после бандажа или крио."
          label="Буфер после услуги"
          name="siteBookingBufferAfterEnabled"
        />
        <label className="service-buffer-field">
          <FieldLabel hint="Минуты после окончания услуги, если буфер включён.">
            Минут после
          </FieldLabel>
          <input
            min="0"
            name="siteBookingBufferAfterMinutes"
            type="number"
            defaultValue={service?.siteBookingBufferAfterMinutes ?? 30}
          />
        </label>
      </div>
    </div>
  );
}

function ServiceForm({service, onSubmit}) {
  const {isMobile} = useBreakpoint();
  const defaultColor = useMemo(
    () => service?.color ?? getRandomServiceColor(),
    [service?.color],
  );
  const getPrice = (duration) =>
    service?.variants?.find((variant) => variant.duration === duration)?.price ?? "";

  return (
    <section className="panel service-form-panel service-form-sheet-root">
      <h2>{service ? "Редактировать услугу" : "Новая услуга"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <label>
          Название
          <input name="name" defaultValue={service?.name ?? ""} required />
        </label>
        <label>
          Категория
          <input name="category" defaultValue={service?.category ?? "Массаж"} />
        </label>
        <label className="service-color-field">
          Цвет в календаре
          <input
            className="color-input"
            name="color"
            type="color"
            defaultValue={defaultColor}
          />
        </label>
        <div className="catalog-price-grid service-price-grid">
          {serviceDurations.map((duration) => (
            <label key={duration}>
              {duration} мин
              <input
                name={`price_${duration}`}
                defaultValue={getPrice(duration)}
                placeholder="0"
              />
            </label>
          ))}
        </div>
        <ServiceBookingBuffers service={service} />
        <Button
          className="crm-primary-action service-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {service
            ? isMobile
              ? "Сохранить"
              : "Сохранить услугу"
            : isMobile
              ? "Добавить"
              : "Добавить услугу"}
        </Button>
      </form>
    </section>
  );
}

export default ServiceForm;
