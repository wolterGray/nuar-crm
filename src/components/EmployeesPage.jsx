import {Plus} from "lucide-react";
import {motion} from "framer-motion";
import {useMemo, useState} from "react";
import DailyPayrollPanel from "./DailyPayrollPanel.jsx";
import PayrollPanel from "./PayrollPanel.jsx";
import {formatMoney} from "../utils/formatters.jsx";
import {isDailyPayrollEmployee} from "../utils/dailyPayroll.js";
import {resolveEmployeeSiteBookingSlotMinutes} from "../utils/calendarBookableSlots.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import PageHeader from "./PageHeader.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import SearchControl from "./ui/SearchControl.jsx";

function EmployeeCard({employee, isMobile, onDelete, onEdit, openMenuId, setOpenMenuId}) {
  const isActive = employee.status === "Активен";

  return (
    <motion.article
      animate={{opacity: 1, y: 0}}
      className={`employee-card ${isMobile ? "employee-mobile-card" : ""}`}
      initial={{opacity: 0, y: 6}}>
      <div className="employee-card-header employee-mobile-head">
        <div className="employee-avatar">{employee.name.slice(0, 1)}</div>
        <div className="employee-mobile-copy">
          <h3>{employee.name}</h3>
          <span>{employee.role}</span>
        </div>
        <RowActionsMenu
          className="employee-row-actions"
          itemId={employee.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(employee)}
          onEdit={() => onEdit(employee)}
        />
      </div>

      {isMobile ? (
        <>
          <div className="employee-mobile-stats">
            <span className={isActive ? "is-active" : ""}>{employee.status}</span>
            <span>
              <strong>{employee.visitsCount}</strong> виз.
            </span>
            <span>
              <strong>{formatMoney(employee.income)}</strong>
            </span>
            <span>
              <strong>{employee.commissionRate}%</strong>
            </span>
          </div>
          <div className="employee-mobile-meta">
            <span>{employee.phone || "Без телефона"}</span>
            <span>
              {employee.shiftStart || "08:00"}–{employee.shiftEnd || "22:00"}
            </span>
            <span>
              {isDailyPayrollEmployee(employee) ? "Ежедневно" : "По периоду"}
            </span>
            <span>Сайт {resolveEmployeeSiteBookingSlotMinutes(employee)} мин</span>
          </div>
        </>
      ) : (
        <>
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
            <span>
              {isDailyPayrollEmployee(employee)
                ? "Выплата ежедневно"
                : "Выплата по периоду"}
            </span>
            <span>
              Смена {employee.shiftStart || "08:00"}–{employee.shiftEnd || "22:00"}
            </span>
            <span>
              Сайт: шаг {resolveEmployeeSiteBookingSlotMinutes(employee)} мин
            </span>
          </div>
        </>
      )}

      {!isMobile ? <b className={isActive ? "status-active" : ""}>{employee.status}</b> : null}
    </motion.article>
  );
}

function EmployeesPage({
  employees,
  getDailyPayrollReport,
  getPayrollReport,
  markAllDailyPayoutsPaid,
  markPayrollPaid,
  payrollEmployees = [],
  payrollRecords,
  removePayrollRecord,
  reopenPayrollRecord,
  setVisitMasterPayoutPaid,
  onAdd,
  onEdit,
  onDelete,
}) {
  const {isMobile} = useBreakpoint();
  const [mobileSection, setMobileSection] = useState("list");
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

  const activeEmployeesCount = useMemo(
    () => employees.filter((employee) => employee.status === "Активен").length,
    [employees],
  );
  const dailyPayrollCount = useMemo(
    () => employees.filter(isDailyPayrollEmployee).length,
    [employees],
  );
  const totalVisits = useMemo(
    () =>
      employees.reduce(
        (sum, employee) => sum + (Number(employee.visitsCount) || 0),
        0,
      ),
    [employees],
  );

  const mobileDescription =
    mobileSection === "list"
      ? `${filteredEmployees.length} из ${employees.length} в базе`
      : mobileSection === "daily"
        ? "Ежедневная выплата по визитам"
        : "Расчёт выплат за период";

  const employeeCards = filteredEmployees.map((employee) => (
    <EmployeeCard
      key={employee.id}
      employee={employee}
      isMobile={isMobile}
      openMenuId={openMenuId}
      setOpenMenuId={setOpenMenuId}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  ));

  return (
    <section
      className={`employees-page ${isMobile ? "employees-page-mobile" : ""}`}
      onClick={() => setOpenMenuId(null)}>
      {!isMobile ? (
        <>
          <DailyPayrollPanel
            employees={payrollEmployees}
            getDailyPayrollReport={getDailyPayrollReport}
            markAllDailyPayoutsPaid={markAllDailyPayoutsPaid}
            setVisitMasterPayoutPaid={setVisitMasterPayoutPaid}
          />
          <PayrollPanel
            getPayrollReport={getPayrollReport}
            markPayrollPaid={markPayrollPaid}
            payrollRecords={payrollRecords}
            removePayrollRecord={removePayrollRecord}
            reopenPayrollRecord={reopenPayrollRecord}
          />
        </>
      ) : null}

      <PageHeader
        collapsedMeta={mobileDescription}
        collapsible={isMobile}
        actions={
          isMobile ? (
            <>
              <div className="employees-page-tabs">
                <button
                  className={mobileSection === "list" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setMobileSection("list");
                    setOpenMenuId(null);
                  }}>
                  Сотрудники
                </button>
                <button
                  className={mobileSection === "daily" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setMobileSection("daily");
                    setOpenMenuId(null);
                  }}>
                  Ежедневно
                </button>
                <button
                  className={mobileSection === "period" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setMobileSection("period");
                    setOpenMenuId(null);
                  }}>
                  Период
                </button>
              </div>
              {mobileSection === "list" ? (
                <>
                  <SearchControl
                    className="employees-search-control"
                    placeholder="Поиск сотрудника"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setOpenMenuId(null);
                    }}
                    onClear={() => setSearch("")}
                  />
                  <div className="employees-summary">
                    <article
                      className={`employees-summary-card${
                        mobileSection === "list" ? " is-active" : ""
                      }`}>
                      <span>Всего</span>
                      <strong>{employees.length}</strong>
                    </article>
                    <article className="employees-summary-card">
                      <span>Активных</span>
                      <strong>{activeEmployeesCount}</strong>
                    </article>
                    <article
                      className={`employees-summary-card${
                        mobileSection === "daily" ? " is-active" : ""
                      }`}>
                      <span>Ежедневно</span>
                      <strong>{dailyPayrollCount}</strong>
                    </article>
                    <article className="employees-summary-card">
                      <span>Визитов</span>
                      <strong>{totalVisits}</strong>
                    </article>
                  </div>
                  <button className="add-visit-button" type="button" onClick={onAdd}>
                    <Plus size={18} />
                    Добавить
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <button className="add-visit-button" type="button" onClick={onAdd}>
              <Plus size={18} />
              Добавить сотрудника
            </button>
          )
        }
        description={isMobile ? mobileDescription : `${employees.length} в базе`}
        title="Сотрудники"
      />

      {isMobile ? (
        <div className="employees-grid">
          <div
            className={`employees-panel employees-panel-list ${
              mobileSection !== "list" ? "employees-panel-hidden-mobile" : ""
            }`}>
            <div className="employees-scroll employees-grid">
              {filteredEmployees.length === 0 ? (
                <div className="employees-empty">
                  <strong>
                    {search.trim() ? "Ничего не найдено" : "Сотрудников пока нет"}
                  </strong>
                  <span>
                    {search.trim()
                      ? "Попробуйте изменить запрос."
                      : "Добавьте первого сотрудника в команду."}
                  </span>
                </div>
              ) : (
                employeeCards
              )}
            </div>
          </div>

          <div
            className={`employees-panel employees-panel-daily ${
              mobileSection !== "daily" ? "employees-panel-hidden-mobile" : ""
            }`}>
            <div className="employees-scroll employees-payroll-scroll">
              <DailyPayrollPanel
                employees={payrollEmployees}
                getDailyPayrollReport={getDailyPayrollReport}
                markAllDailyPayoutsPaid={markAllDailyPayoutsPaid}
                setVisitMasterPayoutPaid={setVisitMasterPayoutPaid}
              />
            </div>
          </div>

          <div
            className={`employees-panel employees-panel-period ${
              mobileSection !== "period" ? "employees-panel-hidden-mobile" : ""
            }`}>
            <div className="employees-scroll employees-payroll-scroll">
              <PayrollPanel
                embeddedMobile
                getPayrollReport={getPayrollReport}
                markPayrollPaid={markPayrollPaid}
                payrollRecords={payrollRecords}
                removePayrollRecord={removePayrollRecord}
                reopenPayrollRecord={reopenPayrollRecord}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="employees-grid">{employeeCards}</div>
      )}
    </section>
  );
}

export default EmployeesPage;
