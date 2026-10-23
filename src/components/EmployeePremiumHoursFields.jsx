import {useMemo, useState} from "react";
import {WEEKDAY_OPTIONS, normalizePremiumHoursRules} from "../utils/siteBookingPricing.js";
import HintIcon, {FieldLabel} from "./HintIcon.jsx";
import {Input} from "./ui/index.js";

const getRulesByDay = (employee) => {
  const rules = normalizePremiumHoursRules(employee?.premiumHoursRules);

  return Object.fromEntries(
    WEEKDAY_OPTIONS.map((day) => {
      const matchingRules = rules
        .filter((rule) => rule.enabled && rule.daysOfWeek.includes(day.value))
        .sort((first, second) => second.percent - first.percent);
      return [
        day.value,
        matchingRules[0] ?? {
          enabled: false,
          endTime: "22:00",
          percent: 15,
          startTime: "17:00",
        },
      ];
    }),
  );
};

function EmployeePremiumHoursFields({employee}) {
  const rulesByDay = useMemo(() => getRulesByDay(employee), [employee]);
  const [premiumHoursEnabled, setPremiumHoursEnabled] = useState(
    employee?.premiumHoursEnabled ?? false,
  );
  const [enabledDays, setEnabledDays] = useState(() =>
    Object.fromEntries(
      WEEKDAY_OPTIONS.map((day) => [day.value, Boolean(rulesByDay[day.value]?.enabled)]),
    ),
  );

  const toggleDay = (day, enabled) => {
    setEnabledDays((current) => ({...current, [day]: enabled}));
  };

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
                Для каждого дня можно отдельно настроить время и процент наценки.
              </HintIcon>
            </span>
          </strong>
          <small>
            {premiumHoursEnabled
              ? "Настройте дни и часы действия наценки."
              : "Выключены"}
          </small>
        </span>
      </label>
      {premiumHoursEnabled ? (
        <fieldset className="employee-premium-days employee-premium-schedule">
          <input name="premiumRulesMode" type="hidden" value="per-day" />
          <legend>
            <span className="labeled-hint-row labeled-hint-row-nowrap">
              Расписание премиум-часов
              <HintIcon>
                Включите нужный день и задайте его наценку и интервал. Например,
                суббота 18:00–22:00 +20%, воскресенье 12:00–20:00 +30%.
              </HintIcon>
            </span>
          </legend>
          <div className="employee-premium-schedule-list">
            {WEEKDAY_OPTIONS.map((day) => {
              const rule = rulesByDay[day.value];
              const dayEnabled = Boolean(enabledDays[day.value]);

              return (
                <div
                  className={`employee-premium-schedule-row${dayEnabled ? " is-enabled" : ""}`}
                  key={day.value}
                >
                  <label className="employee-premium-day-toggle">
                    <input
                      checked={dayEnabled}
                      className="employee-day-toggle-input"
                      name={`premiumRuleEnabled_${day.value}`}
                      type="checkbox"
                      onChange={(event) => toggleDay(day.value, event.target.checked)}
                    />
                    <span className="employee-day-switch" aria-hidden="true" />
                    <span>{day.fullLabel}</span>
                  </label>
                  <div className="employee-premium-day-fields">
                    <label>
                      <small>Наценка, %</small>
                      <Input
                        aria-label={`${day.fullLabel}: наценка`}
                        defaultValue={rule.percent ?? 15}
                        disabled={!dayEnabled}
                        min="0"
                        name={`premiumRulePercent_${day.value}`}
                        type="number"
                      />
                    </label>
                    <label>
                      <small>С</small>
                      <Input
                        aria-label={`${day.fullLabel}: начало премиум-часов`}
                        defaultValue={rule.startTime ?? "17:00"}
                        disabled={!dayEnabled}
                        name={`premiumRuleStart_${day.value}`}
                        type="time"
                      />
                    </label>
                    <label>
                      <small>До</small>
                      <Input
                        aria-label={`${day.fullLabel}: конец премиум-часов`}
                        defaultValue={rule.endTime ?? "22:00"}
                        disabled={!dayEnabled}
                        name={`premiumRuleEnd_${day.value}`}
                        type="time"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

export default EmployeePremiumHoursFields;
