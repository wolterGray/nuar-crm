import {useMemo} from "react";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";
import {Button, Checkbox, Field, Input} from "./ui/index.js";
import {getServiceAssignedEmployeeIds} from "../utils/serviceAssignments.js";

const serviceDurations = [30, 60, 75, 90, 120];

function ServiceBufferToggle({defaultChecked, hint, label, name}) {
  return (
    <div className="service-buffer-toggle-row">
      <label className="service-buffer-toggle">
        <Checkbox
          className="service-buffer-toggle-input"
          defaultChecked={defaultChecked}
          name={name}
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
          <Input
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
          <Input
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

function ServiceForm({employees = [], service, onSubmit}) {
  const {isMobile} = useBreakpoint();
  const defaultColor = useMemo(
    () => service?.color ?? getRandomServiceColor(),
    [service?.color],
  );
  const getPrice = (duration) =>
    service?.variants?.find((variant) => variant.duration === duration)?.price ?? "";
  const isParallel = service?.isParallel ?? service?.payload?.isParallel ?? false;
  const parallelParticipants =
    service?.parallelParticipants ?? service?.payload?.parallelParticipants ?? 2;
  const assignedEmployeeIds = getServiceAssignedEmployeeIds(service);
  const assignedToEveryone = !service || assignedEmployeeIds.length === 0;

  return (
    <section className="panel service-form-panel service-form-sheet-root">
      <h2>{service ? "Редактировать услугу" : "Новая услуга"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <Field label="Название">
          <Input name="name" defaultValue={service?.name ?? ""} required />
        </Field>
        <Field label="Категория">
          <Input name="category" defaultValue={service?.category ?? "Массаж"} />
        </Field>
        <Field className="service-color-field" label="Цвет в календаре">
          <Input
            className="color-input"
            name="color"
            type="color"
            defaultValue={defaultColor}
          />
        </Field>
        <div className="catalog-price-grid service-price-grid">
          {serviceDurations.map((duration) => (
            <Field key={duration} label={`${duration} мин`}>
              <Input
                name={`price_${duration}`}
                defaultValue={getPrice(duration)}
                placeholder="0"
              />
            </Field>
          ))}
        </div>
        {employees.length > 0 ? (
          <div className="employee-pricing-panel service-booking-buffers">
            <div className="service-booking-buffers-heading">
              <h3>
                Мастера
                <HintIcon>
                  Услуга будет видна в календаре только у выбранных мастеров.
                  Если выбрать всех, услуга останется общей.
                </HintIcon>
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {employees.map((employee) => (
                <label className="form-checkbox" key={employee.id}>
                  <Checkbox
                    className="form-checkbox-input"
                    defaultChecked={
                      assignedToEveryone ||
                      assignedEmployeeIds.includes(String(employee.id))
                    }
                    name="assignedEmployeeIds"
                    value={employee.id}
                  />
                  <span aria-hidden="true" className="form-checkbox-box" />
                  <span className="form-checkbox-label">{employee.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="employee-pricing-panel service-booking-buffers">
          <ServiceBufferToggle
            defaultChecked={isParallel}
            hint="Для парного массажа запись занимает календарь у выбранного мастера и второго мастера. Комиссия считается каждому от своей доли цены."
            label="Парная услуга"
            name="isParallel"
          />
          <label className="service-buffer-field">
            <FieldLabel hint="Сейчас используется 2 мастера: например классический + классический в одно время.">
              Мастеров
            </FieldLabel>
            <Input
              min="2"
              name="parallelParticipants"
              type="number"
              defaultValue={parallelParticipants}
            />
          </label>
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
