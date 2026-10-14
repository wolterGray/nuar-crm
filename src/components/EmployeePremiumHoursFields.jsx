import {useState} from "react";
import {WEEKDAY_OPTIONS, buildPremiumHoursRule} from "../utils/siteBookingPricing.js";
import FormCheckbox from "./FormCheckbox.jsx";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";
import {Input} from "./ui/index.js";

function EmployeePremiumHoursFields({employee}) {
  const firstRule = employee?.premiumHoursRules?.[0] ?? buildPremiumHoursRule();
  const selectedDays = new Set(firstRule.daysOfWeek ?? []);
  const [premiumHoursEnabled, setPremiumHoursEnabled] = useState(
    employee?.premiumHoursEnabled ?? false,
  );

  return (
    <div className="employee-pricing-panel">
      <div className="employee-pricing-panel-heading">
        <h3>
          Цены для заявок с сайта
          <HintIcon>
            Настройки для онлайн-записи на nuarr.pl и расчёта стоимости в CRM. На
            зарплату мастера в Payroll не влияют.
          </HintIcon>
        </h3>
      </div>
      <label>
        <FieldLabel hint="Постоянная скидка от базовой цены услуги. Например, у Максима сейчас 18%.">
          Скидка мастера, %
        </FieldLabel>
        <Input
          max="100"
          min="0"
          name="siteDiscountPercent"
          type="number"
          defaultValue={employee?.siteDiscountPercent ?? 0}
        />
      </label>
      <label className="employee-booking-toggle employee-disclosure-toggle employee-premium-disclosure-toggle">
        <input
          checked={premiumHoursEnabled}
          className="employee-booking-toggle-input"
          name="premiumHoursEnabled"
          type="checkbox"
          onChange={(event) => setPremiumHoursEnabled(event.target.checked)}
        />
        <span className="employee-booking-switch" aria-hidden="true" />
        <span className="employee-booking-copy">
          <strong>
            <span className="labeled-hint-row labeled-hint-row-nowrap">
              Премиум-часы
              <HintIcon>
                Дополнительная наценка, если клиент записывается через сайт в
                выбранные дни и время (например, у Ольги вечером в выходные).
              </HintIcon>
            </span>
          </strong>
          <small>
            {premiumHoursEnabled
              ? "Наценка активна для выбранных часов."
              : "Выключены"}
          </small>
        </span>
      </label>
      {premiumHoursEnabled ? (
        <div className="employee-premium-fields">
          <div className="employee-premium-rule-grid">
            <label>
              <FieldLabel hint="Сколько добавить к цене после скидки мастера.">
                Наценка, %
              </FieldLabel>
              <Input
                min="0"
                name="premiumHoursPercent"
                type="number"
                defaultValue={firstRule.percent ?? 15}
              />
            </label>
            <label>
              <FieldLabel hint="Начало интервала.">С</FieldLabel>
              <Input
                defaultValue={firstRule.startTime ?? "17:00"}
                name="premiumHoursStart"
                type="time"
              />
            </label>
            <label>
              <FieldLabel hint="Конец интервала, не включая это время.">До</FieldLabel>
              <Input
                defaultValue={firstRule.endTime ?? "22:00"}
                name="premiumHoursEnd"
                type="time"
              />
            </label>
          </div>
          <fieldset className="employee-premium-days">
            <legend>
              <span className="labeled-hint-row labeled-hint-row-nowrap">
                Дни, когда действует наценка
                <HintIcon>
                  Отметьте дни недели, в которые сайт должен повысить цену, если клиент
                  выбрал время между «С» и «До». Пример: пятница–воскресенье, 17:00–22:00
                  дает +15% к стоимости массажа при записи онлайн.
                </HintIcon>
              </span>
            </legend>
            <div className="employee-premium-days-grid">
              {WEEKDAY_OPTIONS.map((day) => (
                <FormCheckbox
                  className="employee-premium-day-option"
                  defaultChecked={selectedDays.has(day.value)}
                  key={day.value}
                  labelClassName="employee-premium-day-label"
                  name="premiumHoursDays"
                  value={day.value}>
                  {day.fullLabel}
                </FormCheckbox>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

export default EmployeePremiumHoursFields;
