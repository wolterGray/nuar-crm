import {useMemo, useState} from "react";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";
import {Button, Checkbox, Field, Input, Select, Textarea} from "./ui/index.js";
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

const getServiceType = (service, fallback = "service") =>
  service?.serviceType ?? service?.payload?.serviceType ?? fallback;

const getComboItems = (service) => {
  const items = service?.comboItems ?? service?.payload?.comboItems ?? [];
  return Array.isArray(items) ? items : [];
};

function ServiceForm({employees = [], service, serviceCatalog = [], serviceType = "service", onSubmit}) {
  const {isMobile} = useBreakpoint();
  const [activeComboTab, setActiveComboTab] = useState("general");
  const currentServiceType = getServiceType(service, serviceType);
  const isCombo = currentServiceType === "combo";
  const defaultColor = useMemo(
    () => service?.color ?? getRandomServiceColor(),
    [service?.color],
  );
  const getPrice = (duration) =>
    service?.variants?.find((variant) => variant.duration === duration)?.price ?? "";
  const comboItems = getComboItems(service);
  const regularServices = serviceCatalog.filter(
    (item) =>
      String(item.id) !== String(service?.id) &&
      getServiceType(item) !== "combo",
  );
  const assignedEmployeeIds = getServiceAssignedEmployeeIds(service);
  const assignedToEveryone = !service || assignedEmployeeIds.length === 0;
  const comboRows = Array.from({length: Math.max(2, comboItems.length || 2)}, (_, index) => comboItems[index] ?? {});

  if (isCombo) {
    return (
      <section className="panel service-form-panel service-form-sheet-root service-combo-form">
        <h2>{service ? "Редактировать комплекс" : "Новый комплекс услуг"}</h2>
        <form className="catalog-form" onSubmit={onSubmit}>
          <input name="serviceType" type="hidden" value="combo" />
          <div className="service-combo-tabs" role="tablist" aria-label="Настройки комплекса">
            {[
              ["general", "Общие"],
              ["services", "Услуги"],
              ["price", "Цена"],
            ].map(([tab, label]) => (
              <button
                className={activeComboTab === tab ? "is-active" : ""}
                key={tab}
                type="button"
                onClick={() => setActiveComboTab(tab)}>
                {label}
              </button>
            ))}
          </div>

          <div className="service-combo-panel" hidden={activeComboTab !== "general"}>
              <Field label="Название комплекса">
                <Input name="name" defaultValue={service?.name ?? ""} required />
              </Field>
              <Field label="Категория">
                <Input name="category" defaultValue={service?.category ?? "Комплексы"} />
              </Field>
              <Field className="service-color-field" label="Цвет в календаре">
                <Input className="color-input" name="color" type="color" defaultValue={defaultColor} />
              </Field>
              <Field label="Описание">
                <Textarea
                  name="description"
                  defaultValue={service?.description ?? service?.payload?.description ?? ""}
                  placeholder="Описание комплекса для себя или сайта"
                  rows={5}
                />
              </Field>
          </div>

          <div className="service-combo-panel" hidden={activeComboTab !== "services"}>
              <div className="service-combo-list">
                {comboRows.map((item, index) => (
                  <div className="service-combo-row" key={index}>
                    <span>{index + 1}</span>
                    <Select name={`combo_service_${index}`} defaultValue={item.serviceId ?? ""}>
                      <option value="">Выберите услугу</option>
                      {regularServices.map((catalogService) => (
                        <option key={catalogService.id} value={catalogService.id}>
                          {catalogService.name}
                        </option>
                      ))}
                    </Select>
                    <Select name={`combo_duration_${index}`} defaultValue={item.duration ?? 60}>
                      {serviceDurations.map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} мин
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
              <p className="service-combo-note">
                Параллельный комплекс занимает одно и то же время у разных мастеров.
              </p>
          </div>

          <div className="service-combo-panel" hidden={activeComboTab !== "price"}>
              <div className="service-combo-price-list">
                {comboRows.map((item, index) => (
                  <label className="service-combo-price-row" key={index}>
                    <span>Услуга {index + 1}</span>
                    <Input
                      name={`combo_price_${index}`}
                      defaultValue={item.price ?? ""}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
              <label className="form-checkbox service-combo-price-mode">
                <Checkbox
                  className="form-checkbox-input"
                  defaultChecked={service?.payload?.comboCustomPrice !== false}
                  name="comboCustomPrice"
                />
                <span aria-hidden="true" className="form-checkbox-box" />
                <span className="form-checkbox-label">Своя цена комплекса</span>
              </label>
          </div>

          <Button
            className="crm-primary-action service-form-submit"
            size="lg"
            type="submit"
            variant="primary">
            {service ? "Сохранить комплекс" : "Добавить комплекс"}
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="panel service-form-panel service-form-sheet-root">
      <h2>{service ? "Редактировать услугу" : "Новая услуга"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <input name="serviceType" type="hidden" value="service" />
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
