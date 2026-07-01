import {useCallback} from "react";
import {
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "../api/employees.js";
import {parseEmployeePricingFromForm} from "../utils/siteBookingPricing.js";

export function useEmployeeHandlers({
  editingEmployee,
  pushNotification,
  requestEntityDelete,
  setCalendarEntries,
  setEditingEmployee,
  setEmployeeModalOpen,
  setEmployees,
  setVisits,
}) {
  const openCreateEmployee = useCallback(() => {
    setEditingEmployee(null);
    setEmployeeModalOpen(true);
  }, [setEditingEmployee, setEmployeeModalOpen]);

  const openEditEmployee = useCallback(
    (employee) => {
      setEditingEmployee(employee);
      setEmployeeModalOpen(true);
    },
    [setEditingEmployee, setEmployeeModalOpen],
  );

  const handleEmployeeSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingEmployee?.name;

      if (!name) {
        return;
      }

      const employee = {
        ...(editingEmployee?.id ? {id: editingEmployee.id} : {}),
        name,
        role: String(form.get("role") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        commissionRate: Number(form.get("commissionRate")) || 0,
        shiftStart: form.get("shiftStart") || "08:00",
        shiftEnd: form.get("shiftEnd") || "22:00",
        siteBookingSlotMinutes: Math.max(
          15,
          Number(form.get("siteBookingSlotMinutes")) || 15,
        ),
        status: form.get("status"),
        payrollSchedule:
          form.get("payrollSchedule") === "daily" ? "daily" : "monthly",
        ...parseEmployeePricingFromForm(form, editingEmployee),
      };
      let savedEmployee;

      try {
        const response = editingEmployee
          ? await updateEmployee(editingEmployee.id, employee)
          : await createEmployee(employee);
        savedEmployee = response?.data ?? employee;
      } catch (error) {
        pushNotification({
          title: "Сотрудник не сохранен",
          message: error?.message || "Backend не принял изменения сотрудника",
          persist: false,
        });
        return;
      }

      setEmployees((current) =>
        editingEmployee
          ? current.map((item) => (item.id === savedEmployee.id ? savedEmployee : item))
          : [savedEmployee, ...current],
      );

      if (previousName && previousName !== savedEmployee.name) {
        setVisits((current) =>
          current.map((visit) =>
            visit.master === previousName
              ? {...visit, master: savedEmployee.name}
              : visit,
          ),
        );
        setCalendarEntries((current) =>
          current.map((entry) =>
            entry.master === previousName
              ? {...entry, master: savedEmployee.name}
              : entry,
          ),
        );
      }

      setEmployeeModalOpen(false);
      setEditingEmployee(null);
      pushNotification({
        title: editingEmployee ? "Сотрудник обновлен" : "Сотрудник добавлен",
        message: `${savedEmployee.name} сохранен в базе сотрудников`,
      });
    },
    [
      editingEmployee,
      pushNotification,
      setCalendarEntries,
      setEditingEmployee,
      setEmployeeModalOpen,
      setEmployees,
      setVisits,
    ],
  );

  const requestDeleteEmployee = useCallback(
    (employee) => {
      requestEntityDelete("employee", employee);
    },
    [requestEntityDelete],
  );

  const performDeleteEmployee = useCallback(
    async (employee) => {
      try {
        await deleteEmployee(employee.id);
      } catch (error) {
        pushNotification({
          title: "Сотрудник не удален",
          message: error?.message || "Backend не удалил сотрудника",
          persist: false,
        });
        return;
      }

      setEmployees((current) => current.filter((item) => item.id !== employee.id));
      pushNotification({
        title: "Сотрудник удален",
        message: `${employee.name} удален из базы сотрудников`,
      });
    },
    [pushNotification, setEmployees],
  );

  return {
    handleEmployeeSubmit,
    openCreateEmployee,
    openEditEmployee,
    performDeleteEmployee,
    requestDeleteEmployee,
  };
}
