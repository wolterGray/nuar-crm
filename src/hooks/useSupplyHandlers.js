import {useCallback} from "react";
import {
  createSupply,
  deleteSupply,
  updateSupply,
} from "../api/supplies.js";

export function useSupplyHandlers({
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
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();

      if (!name) {
        return;
      }

      const supply = {
        ...(editingSupply?.id ? {id: editingSupply.id} : {}),
        name,
        stock: Math.max(0, Number(form.get("stock")) || 0),
        minStock: Math.max(0, Number(form.get("minStock")) || 0),
        unit: form.get("unit") || "шт.",
        cost: Math.max(0, Number(form.get("cost")) || 0),
        note: String(form.get("note") ?? "").trim(),
        orderUrl: String(form.get("orderUrl") ?? "").trim(),
      };
      let savedSupply;

      try {
        const response = editingSupply
          ? await updateSupply(editingSupply.id, supply)
          : await createSupply(supply);
        savedSupply = response?.data ?? supply;
      } catch (error) {
        pushNotification({
          title: "Расходник не сохранён",
          message: error?.message || "Backend не принял изменения",
          persist: false,
        });
        return;
      }

      setSupplies((current) =>
        editingSupply
          ? current.map((item) => (item.id === savedSupply.id ? savedSupply : item))
          : [savedSupply, ...current],
      );
      setSupplyModalOpen(false);
      setEditingSupply(null);
      pushNotification({title: "Расходник сохранён", message: savedSupply.name});
    },
    [
      editingSupply,
      pushNotification,
      setEditingSupply,
      setSupplies,
      setSupplyModalOpen,
    ],
  );

  const changeSupplyStock = useCallback(
    async (supply, difference) => {
      const nextSupply = {
        ...supply,
        stock: Math.max(0, Number(supply.stock) + difference),
      };
      try {
        await updateSupply(supply.id, nextSupply);
      } catch (error) {
        pushNotification({
          title: "Остаток не обновлён",
          message: error?.message || "Backend не принял остаток",
          persist: false,
        });
        return;
      }

      setSupplies((current) =>
        current.map((item) =>
          item.id === supply.id ? nextSupply : item,
        ),
      );
    },
    [pushNotification, setSupplies],
  );

  const requestDeleteSupply = useCallback(
    (supply) => {
      requestEntityDelete("supply", supply);
    },
    [requestEntityDelete],
  );

  const performDeleteSupply = useCallback(
    async (supply) => {
      try {
        await deleteSupply(supply.id);
      } catch (error) {
        pushNotification({
          title: "Расходник не удалён",
          message: error?.message || "Backend не удалил расходник",
          persist: false,
        });
        return;
      }

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
