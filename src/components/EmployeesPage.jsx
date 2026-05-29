import {Pencil, Plus, Trash2} from "lucide-react";
import {formatMoney} from "../utils/formatters.jsx";

function EmployeesPage({employees, onAdd, onEdit, onDelete}) {
  return (
    <section className="employees-page">
      <div className="employees-toolbar">
        <div>
          <h2>Сотрудники</h2>
          <p>{employees.length} в базе</p>
        </div>
        <button className="add-visit-button" type="button" onClick={onAdd}>
          <Plus size={18} />
          Добавить сотрудника
        </button>
      </div>

      <div className="employees-grid">
        {employees.map((employee) => (
          <article className="employee-card" key={employee.id}>
            <div className="employee-card-header">
              <div className="employee-avatar">{employee.name.slice(0, 1)}</div>
              <div>
                <h3>{employee.name}</h3>
                <span>{employee.role}</span>
              </div>
              <b
                className={
                  employee.status === "Активен" ? "status-active" : ""
                }>
                {employee.status}
              </b>
            </div>

            <div className="employee-stats">
              <span>
                Визитов <strong>{employee.visitsCount}</strong>
              </span>
              <span>
                Доход <strong>{formatMoney(employee.income)}</strong>
              </span>
              <span>
                Чай <strong>{formatMoney(employee.tips)}</strong>
              </span>
              <span>
                Средний чек{" "}
                <strong>{formatMoney(employee.averageCheck)}</strong>
              </span>
            </div>

            <div className="employee-meta">
              <span>{employee.phone || "Телефон не указан"}</span>
              <span>Комиссия {employee.commissionRate}%</span>
            </div>

            <div className="employee-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => onEdit(employee)}>
                <Pencil size={16} />
                Редактировать
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => onDelete(employee)}>
                <Trash2 size={16} />
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default EmployeesPage