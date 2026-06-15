import {useMemo} from "react";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";

const serviceDurations = [30, 60, 75, 90, 120];

function ServiceForm({service, onSubmit}) {
  const defaultColor = useMemo(
    () => service?.color ?? getRandomServiceColor(),
    [service?.color],
  );
  const getPrice = (duration) =>
    service?.variants?.find((variant) => variant.duration === duration)?.price ?? "";

  return (
    <section className="panel service-form-panel">
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
        <label>
          Цвет в календаре
          <input
            className="color-input"
            name="color"
            type="color"
            defaultValue={defaultColor}
          />
        </label>
        <div className="catalog-price-grid">
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
        <div className="employee-pricing-panel">
          <div className="employee-pricing-panel-heading">
            <h3>
              Интервал между бронированиями
              <HintIcon>
                Дополнительное время до и после услуги для онлайн-записи на сайте.
                Учитывается при расчёте свободных слотов вместе с занятостью календаря.
              </HintIcon>
            </h3>
          </div>
          <label className="toggle-row">
            <input
              defaultChecked={service?.siteBookingBufferBeforeEnabled ?? false}
              name="siteBookingBufferBeforeEnabled"
              type="checkbox"
            />
            <span className="labeled-hint-row">
              Буфер до услуги
              <HintIcon>
                Сколько минут должно быть свободно перед началом записи. Например,
                15 минут на подготовку кабинета.
              </HintIcon>
            </span>
          </label>
          <label>
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
          <label className="toggle-row">
            <input
              defaultChecked={service?.siteBookingBufferAfterEnabled ?? false}
              name="siteBookingBufferAfterEnabled"
              type="checkbox"
            />
            <span className="labeled-hint-row">
              Буфер после услуги
              <HintIcon>
                Сколько минут блокировать после окончания услуги. Например, 30 минут
                на уборку после бандажа или крио.
              </HintIcon>
            </span>
          </label>
          <label>
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
        <button className="submit-button">
          {service ? "Сохранить услугу" : "Добавить услугу"}
        </button>
      </form>
    </section>
  );
}

export default ServiceForm;
