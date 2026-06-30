import {Plus} from "lucide-react";
import {motion} from "framer-motion";
import {useMemo, useState} from "react";

import {formatMoney} from "../utils/formatters.jsx";
import {isDailyPayrollEmployee} from "../utils/dailyPayroll.js";
import {resolveEmployeeSiteBookingSlotMinutes} from "../utils/calendarBookableSlots.js";

import PageHeader from "./ui/PageHeader.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import SearchControl from "./ui/SearchControl.jsx";

import Button from "./ui/Button.jsx";

function EmployeeCard({employee, onDelete, onEdit, openMenuId, setOpenMenuId}) {
  const isActive = employee.status === "Активен";

  return (
    <motion.article
      animate={{opacity: 1, y: 0}}
      className="employee-card"
      initial={{opacity: 0, y: 6}}>

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="employee-avatar-tile">
            {employee.name.slice(0, 1)}
          </div>
          <div className="grid gap-0.5 min-w-0">
            <h3 className="m-0 text-text-main text-sm font-semibold truncate leading-snug">{employee.name}</h3>
            <span className="text-text-muted text-xs truncate block leading-normal">{employee.role}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="flex flex-col gap-0.5 px-2 border-r border-border-soft">
          <span className="text-text-faint text-[9px] font-semibold uppercase tracking-wider">Визиты</span>
          <strong className="text-text-main text-sm font-semibold">{employee.visitsCount}</strong>
        </div>
        <div className="flex flex-col gap-0.5 px-2 border-r border-border-soft">
          <span className="text-text-faint text-[9px] font-semibold uppercase tracking-wider">Выплата</span>
          <strong className="text-text-main text-sm font-semibold">{formatMoney(employee.income)}</strong>
        </div>
        <div className="flex flex-col gap-0.5 px-2 border-r border-border-soft">
          <span className="text-text-faint text-[9px] font-semibold uppercase tracking-wider">Чай</span>
          <strong className="text-text-main text-sm font-semibold">{formatMoney(employee.tips || 0)}</strong>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          <span className="text-text-faint text-[9px] font-semibold uppercase tracking-wider">Ставка</span>
          <strong className="text-text-main text-sm font-semibold">{employee.commissionRate}%</strong>
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
        <span className="truncate max-w-[140px]">{employee.phone || "Без телефона"}</span>
        <span className="shrink-0">•</span>
        <span className="shrink-0">
          Смена {employee.shiftStart || "08:00"}–{employee.shiftEnd || "22:00"}
        </span>
        <span className="shrink-0">•</span>
        <span className="shrink-0">
          {isDailyPayrollEmployee(employee) ? "Ежедневно" : "По периоду"}
        </span>
        <span className="shrink-0">•</span>
        <span className="shrink-0">
          Сайт: {resolveEmployeeSiteBookingSlotMinutes(employee)} мин
        </span>
      </div>
    </motion.article>
  );
}

function EmployeesPage({
  employees,
  onAdd,
  onEdit,
  onDelete,
}) {
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

      {/* Page Header */}
      <PageHeader
        className="employees-page-header"
        actions={
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
            <Button variant="primary" onClick={onAdd} className="employees-page-add-button">
              <Plus size={16} />
              Добавить сотрудника
            </Button>
          </div>
        }
        description={`${employees.length} сотрудников в базе`}
        title="Сотрудники"
      />

      <section className="employees-grid">
        {employeeCards}
      </section>
    </div>
  );
}

export default EmployeesPage;
