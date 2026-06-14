import EmployeePremiumHoursFields from './EmployeePremiumHoursFields'
import {FieldLabel} from './HintIcon.jsx'
import {resolveEmployeeSiteBookingSlotMinutes} from '../utils/calendarBookableSlots.js'

function EmployeeForm({ employee, onSubmit }) {
  const siteBookingSlotMinutes = resolveEmployeeSiteBookingSlotMinutes(employee ?? {});

  return (
    <section className="panel employee-form-panel">
      <h2>{employee ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
      <form className="employee-form" onSubmit={onSubmit}>
        <label>
          Имя
          <input name="name" defaultValue={employee?.name ?? ''} required />
        </label>
        <label>
          Роль
          <input name="role" defaultValue={employee?.role ?? 'Массажист'} required />
        </label>
        <label>
          Телефон
          <input name="phone" defaultValue={employee?.phone ?? ''} placeholder="+48" />
        </label>
        <label>
          Комиссия %
          <input min="0" max="100" name="commissionRate" type="number" defaultValue={employee?.commissionRate ?? 0} />
        </label>
        <div className="form-split">
          <label>
            Начало смены
            <input name="shiftStart" type="time" defaultValue={employee?.shiftStart ?? '08:00'} />
          </label>
          <label>
            Конец смены
            <input name="shiftEnd" type="time" defaultValue={employee?.shiftEnd ?? '22:00'} />
          </label>
        </div>
        <label>
          <FieldLabel hint="Шаг времени, который клиент может выбрать в форме записи на сайте. Учитывается вместе со сменой сотрудника.">
            Интервал записи с сайта
          </FieldLabel>
          <select
            name="siteBookingSlotMinutes"
            defaultValue={String(siteBookingSlotMinutes)}>
            <option value="15">15 минут</option>
            <option value="30">30 минут</option>
            <option value="45">45 минут</option>
            <option value="60">1 час</option>
            <option value="90">1,5 часа</option>
            <option value="120">2 часа</option>
          </select>
        </label>
        <label>
          Статус
          <select name="status" defaultValue={employee?.status ?? 'Активен'}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </select>
        </label>
        <label>
          <FieldLabel hint="Ежедневный режим: комиссия с каждого массажа и отметка «оплачено» по визитам.">
            Расчёт выплат
          </FieldLabel>
          <select
            name="payrollSchedule"
            defaultValue={employee?.payrollSchedule ?? "monthly"}>
            <option value="monthly">Ежемесячно</option>
            <option value="daily">Ежедневно по визитам</option>
          </select>
        </label>
        <EmployeePremiumHoursFields employee={employee} />
        <button className="submit-button">
          {employee ? 'Сохранить сотрудника' : 'Добавить сотрудника'}
        </button>
      </form>
    </section>
  )
}

export default EmployeeForm
