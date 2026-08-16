import EmployeePremiumHoursFields from './EmployeePremiumHoursFields'
import {FieldLabel} from './HintIcon.jsx'
import {resolveEmployeeSiteBookingSlotMinutes} from '../utils/calendarBookableSlots.js'
import {
  getEmployeeBlockedDates,
  getEmployeeWorkingDays,
  WEEKDAY_OPTIONS,
} from '../utils/employeeAvailability.js'
import {Button, Checkbox, Field, Input, Select, Textarea} from './ui/index.js'

function EmployeeForm({ employee, onSubmit }) {
  const siteBookingSlotMinutes = resolveEmployeeSiteBookingSlotMinutes(employee ?? {});
  const workingDays = getEmployeeWorkingDays(employee ?? {});
  const blockedDates = getEmployeeBlockedDates(employee ?? {});

  return (
    <section className="panel employee-form-panel employee-form-sheet-root">
      <h2>{employee ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
      <form className="employee-form" onSubmit={onSubmit}>
        <Field label="Имя">
          <Input name="name" defaultValue={employee?.name ?? ''} required />
        </Field>
        <Field label="Роль">
          <Input name="role" defaultValue={employee?.role ?? 'Массажист'} required />
        </Field>
        <Field label="Телефон">
          <Input name="phone" defaultValue={employee?.phone ?? ''} placeholder="+48" />
        </Field>
        <Field label="Комиссия %">
          <Input min="0" max="100" name="commissionRate" type="number" defaultValue={employee?.commissionRate ?? 0} />
        </Field>
        <div className="form-split">
          <Field label="Начало смены">
            <Input name="shiftStart" type="time" defaultValue={employee?.shiftStart ?? '08:00'} />
          </Field>
          <Field label="Конец смены">
            <Input name="shiftEnd" type="time" defaultValue={employee?.shiftEnd ?? '22:00'} />
          </Field>
        </div>
        <label>
          <FieldLabel hint="Шаг времени, который клиент может выбрать в форме записи на сайте. Учитывается вместе со сменой сотрудника.">
            Интервал записи с сайта
          </FieldLabel>
          <Select
            name="siteBookingSlotMinutes"
            defaultValue={String(siteBookingSlotMinutes)}>
            <option value="15">15 минут</option>
            <option value="30">30 минут</option>
            <option value="45">45 минут</option>
            <option value="60">1 час</option>
            <option value="90">1,5 часа</option>
            <option value="120">2 часа</option>
          </Select>
        </label>
        <Field label="Статус">
          <Select name="status" defaultValue={employee?.status ?? 'Активен'}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </Select>
        </Field>
        <label>
          <FieldLabel hint="Как часто обычно закрываем выплаты сотруднику. Еженедельные выплаты можно собирать фильтром «эта неделя».">
            Расчёт выплат
          </FieldLabel>
          <Select
            name="payrollSchedule"
            defaultValue={employee?.payrollSchedule ?? "monthly"}>
            <option value="monthly">Ежемесячно</option>
            <option value="weekly">Еженедельно</option>
            <option value="daily">Ежедневно по визитам</option>
          </Select>
        </label>
        <div className="employee-pricing-panel">
          <h3>Доступность для записи</h3>
          <Field label="Рабочие дни">
            <div className="employee-weekdays-row">
              {WEEKDAY_OPTIONS.map((day) => (
                <label className="employee-weekday-toggle" key={day.value}>
                  <Checkbox
                    defaultChecked={workingDays.includes(day.value)}
                    name="workingDaysOfWeek"
                    value={day.value}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field
            description="Например: 2026-08-20, 2026-08-21"
            label="Отпуск / закрытые даты">
            <Textarea
              name="bookingBlockedDates"
              rows={2}
              defaultValue={blockedDates.join('\n')}
              placeholder="YYYY-MM-DD"
            />
          </Field>
        </div>
        <EmployeePremiumHoursFields employee={employee} />
        <Button
          className="crm-primary-action employee-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {employee ? 'Сохранить сотрудника' : 'Добавить сотрудника'}
        </Button>
      </form>
    </section>
  )
}

export default EmployeeForm
