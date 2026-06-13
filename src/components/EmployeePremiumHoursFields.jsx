import {WEEKDAY_OPTIONS, buildPremiumHoursRule} from "../utils/siteBookingPricing.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";

function EmployeePremiumHoursFields({employee}) {
  const firstRule = employee?.premiumHoursRules?.[0] ?? buildPremiumHoursRule();
  const selectedDays = new Set(firstRule.daysOfWeek ?? []);

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
        <input
          max="100"
          min="0"
          name="siteDiscountPercent"
          type="number"
          defaultValue={employee?.siteDiscountPercent ?? 0}
        />
      </label>
      <label className="toggle-row">
        <input
          defaultChecked={employee?.premiumHoursEnabled ?? false}
          name="premiumHoursEnabled"
          type="checkbox"
        />
        <span className="labeled-hint-row">
          Премиум-часы
          <HintIcon>
            Дополнительная наценка, если клиент записывается через сайт в
            выбранные дни и время (например, у Ольги вечером в выходные).
          </HintIcon>
        </span>
      </label>
      <div className="employee-premium-rule-grid">
        <label>
          <FieldLabel hint="Сколько добавить к цене после скидки мастера.">
            Наценка, %
          </FieldLabel>
          <input
            min="0"
            name="premiumHoursPercent"
            type="number"
            defaultValue={firstRule.percent ?? 15}
          />
        </label>
        <label>
          <FieldLabel hint="Начало интервала.">С</FieldLabel>
          <input
            defaultValue={firstRule.startTime ?? "17:00"}
            name="premiumHoursStart"
            type="time"
          />
        </label>
        <label>
          <FieldLabel hint="Конец интервала, не включая это время.">До</FieldLabel>
          <input
            defaultValue={firstRule.endTime ?? "22:00"}
            name="premiumHoursEnd"
            type="time"
          />
        </label>
      </div>
      <fieldset className="employee-premium-days">
        <legend>
          <span className="labeled-hint-row">
            Дни, когда действует наценка
            <HintIcon>
              Отметьте дни недели, в которые сайт должен повысить цену, если клиент
              выбрал время между «С» и «До». Пример: пятница–воскресенье, 17:00–22:00
              → +15% к стоимости массажа при записи онлайн.
            </HintIcon>
          </span>
        </legend>
        <div className="employee-premium-days-grid">
          {WEEKDAY_OPTIONS.map((day) => (
            <label className="employee-premium-day-option" key={day.value}>
              <input
                defaultChecked={selectedDays.has(day.value)}
                name="premiumHoursDays"
                type="checkbox"
                value={day.value}
              />
              <span>{day.fullLabel}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default EmployeePremiumHoursFields;
