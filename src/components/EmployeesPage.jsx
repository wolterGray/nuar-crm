import {Pencil, Plus, Trash2} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../utils/formatters.jsx";
import PageHeader from "./PageHeader.jsx";

function EmployeesPage({employees, onAdd, onEdit, onDelete}) {
  return (
    <section className="employees-page">
      <PageHeader
        actions={
          <button className="add-visit-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            Добавить сотрудника
          </button>
        }
        description={`${employees.length} в базе`}
        title="Сотрудники"
      />

      <div className="employees-grid">
        {employees.map((employee) => (
          <motion.article
            animate={{opacity: 1, y: 0}}
            className="employee-card"
            initial={{opacity: 0, y: 6}}
            key={employee.id}>
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
                Выплата <strong>{formatMoney(employee.income)}</strong>
              </span>
              <span>
                Чай <strong>{formatMoney(employee.tips)}</strong>
              </span>
              <span>
                Средняя выплата{" "}
                <strong>{formatMoney(employee.averageCheck)}</strong>
              </span>
            </div>

            <div className="employee-meta">
              <span>{employee.phone || "Телефон не указан"}</span>
              <span>Комиссия {employee.commissionRate}%</span>
              <span>Смена {employee.shiftStart || "08:00"}–{employee.shiftEnd || "22:00"}</span>
            </div>

            <div className="employee-actions">
              <button
                aria-label="Редактировать сотрудника"
                className="compact-icon-button"
                title="Редактировать"
                type="button"
                onClick={() => onEdit(employee)}>
                <Pencil size={16} />
              </button>
              <button
                aria-label="Удалить сотрудника"
                className="compact-icon-button danger"
                title="Удалить"
                type="button"
                onClick={() => onDelete(employee)}>
                <Trash2 size={16} />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default EmployeesPage
