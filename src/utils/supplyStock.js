export const isSupplyLowStock = (item) =>
  Number(item?.stock) <= Number(item?.minStock);

export const isSupplyOutOfStock = (item) => Number(item?.stock) <= 0;

export const getSupplyStockStatus = (item) => {
  if (isSupplyOutOfStock(item)) {
    return "out";
  }

  if (isSupplyLowStock(item)) {
    return "low";
  }

  return "ok";
};

export const getSupplyStockStatusLabel = (status) => {
  if (status === "out") {
    return "Закончился";
  }

  if (status === "low") {
    return "Заканчивается";
  }

  return "";
};
