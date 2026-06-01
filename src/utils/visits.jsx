export const toVisitNumber = (value) => {
  const normalizedValue =
    typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : value;
  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : 0;
};

export const getDiscountedServiceAmount = (visit) => {
  const amount = toVisitNumber(visit.amount);
  const discountPercent = toVisitNumber(visit.discount);
  return amount - amount * (discountPercent / 100);
};

export const getVisitCommission = (visit) => {
  if (visit.commissionType === "Booksy 45%") {
    const discountedAmount = getDiscountedServiceAmount(visit);
    const netAmount = Math.floor(
      discountedAmount - discountedAmount * 0.45 * 1.23,
    );
    return Math.max(0, discountedAmount - netAmount);
  }

  return toVisitNumber(visit.commission);
};

export const getEmployeePayoutBase = (visit) => {
  if (visit.payment === "Пакет") {
    return 0;
  }

  return getDiscountedServiceAmount(visit);
};

export const getEmployeePayout = (visit, employees = []) => {
  const employee = employees.find((item) => item.name === visit.master);
  const rate = toVisitNumber(employee?.commissionRate);

  return Math.round(getEmployeePayoutBase(visit) * (rate / 100));
};

export const getVisitTransactionTotal = (visit) => {
  const tip = toVisitNumber(visit.tip);
  const extra = toVisitNumber(visit.extra);

  if (visit.payment === "Пакет") {
    return tip + extra;
  }

  if (visit.commissionType === "Booksy 45%") {
    const discountedAmount = getDiscountedServiceAmount(visit);
    const netAmount = Math.floor(
      discountedAmount - discountedAmount * 0.45 * 1.23,
    );
    return Math.max(0, netAmount) + tip + extra;
  }

  return (
    getDiscountedServiceAmount(visit) +
    tip +
    extra -
    getVisitCommission(visit)
  );
};

export const getVisitTotal = (visit, employees = []) =>
  getVisitTransactionTotal(visit) - getEmployeePayout(visit, employees);
