import {WEEKDAY_OPTIONS, buildPremiumHoursRule} from "../utils/siteBookingPricing.js";

function EmployeePremiumHoursFields({employee}) {
  const firstRule = employee?.premiumHoursRules?.[0] ?? buildPremiumHoursRule();
  const selectedDays = new Set(firstRule.daysOfWeek ?? []);

  return (
    <div className="employee-pricing-panel">
      <div className="employee-pricing-panel-heading">
        <h3>Цены для заявок с сайта</h3>
        <p className="employee-pricing-panel-lead">
          Настройки для онлайн-записи на nuarr.pl и расчёта стоимости в CRM. На
          зарплату мастера в Payroll не влияют.
        </p>
      </div>
      <label>
        Скидка мастера, %
        <input
          max="100"
          min="0"
          name="siteDiscountPercent"
          type="number"
          defaultValue={employee?.siteDiscountPercent ?? 0}
        />
        <small>
          Постоянная скидка от базовой цены услуги. Например, у Максима сейчас
          18%.
        </small>
      </label>
      <label className="toggle-row">
        <input
          defaultChecked={employee?.premiumHoursEnabled ?? false}
          name="premiumHoursEnabled"
          type="checkbox"
        />
        <span>
          Премиум-часы
          <small>
            Дополнительная наценка, если клиент записывается через сайт в
            выбранные дни и время (например, у Ольги вечером в выходные).
          </small>
        </span>
      </label>
      <div className="employee-premium-rule-grid">
        <label>
          Наценка, %
          <input
            min="0"
            name="premiumHoursPercent"
            type="number"
            defaultValue={firstRule.percent ?? 15}
          />
          <small>Сколько добавить к цене после скидки мастера.</small>
        </label>
        <label>
          С
          <input
            defaultValue={firstRule.startTime ?? "17:00"}
            name="premiumHoursStart"
            type="time"
          />
          <small>Начало интервала.</small>
        </label>
        <label>
          До
          <input
            defaultValue={firstRule.endTime ?? "22:00"}
            name="premiumHoursEnd"
            type="time"
          />
          <small>Конец интервала, не включая это время.</small>
        </label>
      </div>
      <fieldset className="employee-premium-days">
        <legend>Дни, когда действует наценка</legend>
        <p className="employee-premium-days-help">
          Отметьте дни недели, в которые сайт должен повысить цену, если клиент
          выбрал время между «С» и «До». Пример: пятница–воскресенье, 17:00–22:00
          → +15% к стоимости массажа при записи онлайн.
        </p>
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
