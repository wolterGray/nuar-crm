export const getVisitTotal = (visit) =>
  visit.amount + visit.tip + visit.extra - visit.commission - visit.discount