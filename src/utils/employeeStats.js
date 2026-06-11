import {getEmployeePayout} from "./visits.jsx";

export const buildEmployeeStats = (employees, visits) =>
  employees.map((employee) => {
    const employeeVisits = visits.filter(
      (visit) => visit.recordType !== "operation" && visit.master === employee.name,
    );
    const income = employeeVisits.reduce(
      (sum, visit) => sum + getEmployeePayout(visit, employees),
      0,
    );
    const tips = employeeVisits.reduce((sum, visit) => sum + visit.tip, 0);
    const averageCheck = Math.round(income / Math.max(employeeVisits.length, 1));

    return {
      ...employee,
      visitsCount: employeeVisits.length,
      income,
      tips,
      averageCheck,
    };
  });
