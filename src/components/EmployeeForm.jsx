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
          <input name="commissionRate" defaultValue={employee?.commissionRate ?? 0} />
        </label>
        <label>
          Статус
          <select name="status" defaultValue={employee?.status ?? 'Активен'}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </select>
        </label>
        <button className="submit-button">
          {employee ? 'Сохранить сотрудника' : 'Добавить сотрудника'}
        </button>
      </form>
    </section>
  )
}

export default EmployeeForm
