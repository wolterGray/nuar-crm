import {useCallback} from "react";

export function useSupplyHandlers({
  createLocalId,
  editingSupply,
  pushNotification,
  requestEntityDelete,
  setEditingSupply,
  setSupplies,
  setSupplyModalOpen,
}) {
  const openCreateSupply = useCallback(() => {
    setEditingSupply(null);
    setSupplyModalOpen(true);
  }, [setEditingSupply, setSupplyModalOpen]);

  const openEditSupply = useCallback(
    (supply) => {
      setEditingSupply(supply);
      setSupplyModalOpen(true);
    },
    [setEditingSupply, setSupplyModalOpen],
  );

  const handleSupplySubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();

      if (!name) {
        return;
      }

      const supply = {
        id: editingSupply?.id ?? createLocalId(),
        name,
        stock: Math.max(0, Number(form.get("stock")) || 0),
        minStock: Math.max(0, Number(form.get("minStock")) || 0),
        unit: form.get("unit") || "шт.",
        cost: Math.max(0, Number(form.get("cost")) || 0),
        note: String(form.get("note") ?? "").trim(),
        orderUrl: String(form.get("orderUrl") ?? "").trim(),
      };

      setSupplies((current) =>
        editingSupply
          ? current.map((item) => (item.id === supply.id ? supply : item))
          : [supply, ...current],
      );
      setSupplyModalOpen(false);
      setEditingSupply(null);
      pushNotification({title: "Расходник сохранён", message: supply.name});
    },
    [
      createLocalId,
      editingSupply,
      pushNotification,
      setEditingSupply,
      setSupplies,
      setSupplyModalOpen,
    ],
  );

  const changeSupplyStock = useCallback(
    (supply, difference) => {
      setSupplies((current) =>
        current.map((item) =>
          item.id === supply.id
            ? {...item, stock: Math.max(0, Number(item.stock) + difference)}
            : item,
        ),
      );
    },
    [setSupplies],
  );

  const requestDeleteSupply = useCallback(
    (supply) => {
      requestEntityDelete("supply", supply);
    },
    [requestEntityDelete],
  );

  const performDeleteSupply = useCallback(
    (supply) => {
      setSupplies((current) => current.filter((item) => item.id !== supply.id));
      pushNotification({title: "Расходник удалён", message: supply.name});
    },
    [pushNotification, setSupplies],
  );

  return {
    changeSupplyStock,
    handleSupplySubmit,
    openCreateSupply,
    openEditSupply,
    performDeleteSupply,
    requestDeleteSupply,
  };
}
