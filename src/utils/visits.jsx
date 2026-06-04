import {
  getVisitDebtAmount,
  getVisitDiscountedAmount,
  getVisitEmployeePayout,
  getVisitNetProfit,
  getVisitPlatformCommission,
  getVisitReceivedAmount,
  isBarterVisit,
  isPackageVisit,
  toFinanceNumber,
} from "./finance.js";

export const toVisitNumber = toFinanceNumber;

export const getDiscountedServiceAmount = getVisitDiscountedAmount;

export const isPackagePayment = isPackageVisit;

export const isBarterPayment = isBarterVisit;

export const getVisitCommission = getVisitPlatformCommission;

export const getVisitDebt = getVisitDebtAmount;

export const getEmployeePayoutBase = getVisitDiscountedAmount;

export const getEmployeePayout = getVisitEmployeePayout;

export const getVisitTransactionTotal = getVisitReceivedAmount;

export const getVisitTotal = getVisitNetProfit;
