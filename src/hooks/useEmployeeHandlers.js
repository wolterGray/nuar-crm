import {useCallback} from "react";

export function useEmployeeHandlers({
  createLocalId,
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
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingEmployee?.name;

      if (!name) {
        return;
      }

      const employee = {
        id: editingEmployee?.id ?? createLocalId(),
        name,
        role: String(form.get("role") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        commissionRate: Number(form.get("commissionRate")) || 0,
        shiftStart: form.get("shiftStart") || "08:00",
        shiftEnd: form.get("shiftEnd") || "22:00",
        status: form.get("status"),
      };

      setEmployees((current) =>
        editingEmployee
          ? current.map((item) => (item.id === employee.id ? employee : item))
          : [employee, ...current],
      );

      if (previousName && previousName !== employee.name) {
        setVisits((current) =>
          current.map((visit) =>
            visit.master === previousName
              ? {...visit, master: employee.name}
              : visit,
          ),
        );
        setCalendarEntries((current) =>
          current.map((entry) =>
            entry.master === previousName
              ? {...entry, master: employee.name}
              : entry,
          ),
        );
      }

      setEmployeeModalOpen(false);
      setEditingEmployee(null);
      pushNotification({
        title: editingEmployee ? "Сотрудник обновлен" : "Сотрудник добавлен",
        message: `${employee.name} сохранен в базе сотрудников`,
      });
    },
    [
      createLocalId,
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
    (employee) => {
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
