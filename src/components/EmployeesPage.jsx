import {motion} from "framer-motion";
import {useMemo, useState} from "react";

import {formatMoney} from "../utils/formatters.jsx";
import {isDailyPayrollEmployee} from "../utils/dailyPayroll.js";
import {resolveEmployeeSiteBookingSlotMinutes} from "../utils/calendarBookableSlots.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";

import PageHeader from "./ui/PageHeader.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import SearchControl from "./ui/SearchControl.jsx";

import {Button, EmptyState} from "./ui/index.js";
import EmployeePayoutsPanel from "./EmployeePayoutsPanel.jsx";

function EmployeeCard({employee, onDelete, onEdit, openMenuId, setOpenMenuId}) {
  const isActive = employee.status === "Активен";

  return (
    <motion.article
      animate={{opacity: 1, y: 0}}
      className="employee-card"
      initial={{opacity: 0, y: 6}}>

      {/* Top Header */}
      <div className="employee-card-top">
        <div className="employee-card-person">
          <div className="employee-avatar-tile">
            {employee.name.slice(0, 1)}
          </div>
          <div className="employee-card-title">
            <h3>{employee.name}</h3>
            <span>{employee.role}</span>
          </div>
        </div>
        <div className="employee-card-controls">
          <span className={`employee-status-pill ${isActive ? "is-active" : ""}`}>
            {employee.status}
          </span>
          <RowActionsMenu
            itemId={employee.id}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(employee)}
            onEdit={() => onEdit(employee)}
          />
        </div>
      </div>

      {/* Grid Stats */}
      <div className="employee-stats">
        <div>
          <span>Визиты</span>
          <strong>{employee.visitsCount}</strong>
        </div>
        <div>
          <span>Выплата</span>
          <strong>{formatMoney(employee.income)}</strong>
        </div>
        <div>
          <span>Чай</span>
          <strong>{formatMoney(employee.tips || 0)}</strong>
        </div>
        <div>
          <span>Ставка</span>
          <strong>{employee.commissionRate}%</strong>
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="employee-card-meta">
        <span>{employee.phone || "Без телефона"}</span>
        <span>
          Смена {employee.shiftStart || "08:00"}–{employee.shiftEnd || "22:00"}
        </span>
        <span>
          {isDailyPayrollEmployee(employee) ? "Ежедневно" : "По периоду"}
        </span>
        <span>
          Сайт: {resolveEmployeeSiteBookingSlotMinutes(employee)} мин
        </span>
      </div>
    </motion.article>
  );
}

function EmployeesPage({
  employees,
  pushNotification,
  onAdd,
  onEdit,
  onDelete,
}) {
  const {isMobile} = useBreakpoint();
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) =>
      [
        employee.name,
        employee.role,
        employee.phone,
        employee.status,
        String(employee.commissionRate),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employees, search]);




  const employeeCards = filteredEmployees.map((employee) => (
    <EmployeeCard
      key={employee.id}
      employee={employee}
      openMenuId={openMenuId}
      setOpenMenuId={setOpenMenuId}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  ));

  return (
    <div
      className="employees-page"
      onClick={() => setOpenMenuId(null)}>

      <EmployeePayoutsPanel pushNotification={pushNotification} />

      {/* Page Header */}
      <PageHeader
        className="employees-page-header"
        actions={
          isMobile ? undefined : (
            <div className="employees-page-toolbar">
              <SearchControl
                className="employees-page-search"
                placeholder="Поиск сотрудника"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOpenMenuId(null);
                }}
                onClear={() => setSearch("")}
              />
              <Button
                className="employees-page-add-button"
                leftIcon="plus"
                variant="primary"
                onClick={onAdd}>
                Добавить сотрудника
              </Button>
            </div>
          )
        }
        description={isMobile ? undefined : `${employees.length} сотрудников в базе`}
        title="Сотрудники"
      />

      {isMobile && (
        <div className="employees-page-toolbar employees-page-toolbar-mobile">
          <SearchControl
            className="employees-page-search"
            placeholder="Поиск сотрудника"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOpenMenuId(null);
            }}
            onClear={() => setSearch("")}
          />
          <Button
            className="employees-page-add-button"
            leftIcon="plus"
            variant="primary"
            onClick={onAdd}>
            Добавить
          </Button>
        </div>
      )}

      <section className="employees-grid">
        {employeeCards.length > 0 ? (
          employeeCards
        ) : (
          <EmptyState
            className="employees-empty-state"
            description={
              search.trim()
                ? "Попробуйте изменить запрос."
                : "Добавьте первого сотрудника в расписание."
            }
            icon={search.trim() ? "search" : "user"}
            title={search.trim() ? "Сотрудники не найдены" : "Сотрудников пока нет"}
          />
        )}
      </section>
    </div>
  );
}

export default EmployeesPage;
