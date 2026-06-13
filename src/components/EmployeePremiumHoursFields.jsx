import {WEEKDAY_OPTIONS, buildPremiumHoursRule} from "../utils/siteBookingPricing.js";

function EmployeePremiumHoursFields({employee}) {
  const firstRule = employee?.premiumHoursRules?.[0] ?? buildPremiumHoursRule();
  const selectedDays = new Set(firstRule.daysOfWeek ?? []);

  return (
    <div className="employee-pricing-panel">
      <h3>Цены для заявок с сайта</h3>
      <label>
        Скидка мастера, %
        <input
          max="100"
          min="0"
          name="siteDiscountPercent"
          type="number"
          defaultValue={employee?.siteDiscountPercent ?? 0}
        />
        <small>Например, у Максима сейчас 18%. Применяется к базовой цене услуги.</small>
      </label>
      <label className="toggle-row">
        <input
          defaultChecked={employee?.premiumHoursEnabled ?? false}
          name="premiumHoursEnabled"
          type="checkbox"
        />
        <span>
          Премиум-часы
          <small>Наценка в выбранные дни и время (например, у Ольги)</small>
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
        </label>
        <label>
          С
          <input
            defaultValue={firstRule.startTime ?? "17:00"}
            name="premiumHoursStart"
            type="time"
          />
        </label>
        <label>
          До
          <input
            defaultValue={firstRule.endTime ?? "22:00"}
            name="premiumHoursEnd"
            type="time"
          />
        </label>
      </div>
      <fieldset className="employee-premium-days">
        <legend>Дни недели</legend>
        <div className="employee-premium-days-grid">
          {WEEKDAY_OPTIONS.map((day) => (
            <label className="toggle-row" key={day.value}>
              <input
                defaultChecked={selectedDays.has(day.value)}
                name="premiumHoursDays"
                type="checkbox"
                value={day.value}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default EmployeePremiumHoursFields;
