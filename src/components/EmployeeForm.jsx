import EmployeePremiumHoursFields from './EmployeePremiumHoursFields'

function EmployeeForm({ employee, onSubmit }) {
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
          Статус
          <select name="status" defaultValue={employee?.status ?? 'Активен'}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </select>
        </label>
        <label>
          Расчёт выплат
          <select
            name="payrollSchedule"
            defaultValue={employee?.payrollSchedule ?? "monthly"}>
            <option value="monthly">Ежемесячно</option>
            <option value="daily">Ежедневно по визитам</option>
          </select>
          <small>
            Ежедневный режим: комиссия с каждого массажа и отметка «оплачено» по
            визитам.
          </small>
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
