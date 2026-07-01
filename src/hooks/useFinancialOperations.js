import {useCallback} from "react";
import {attachClientLink} from "../utils/clientLinks.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {toVisitNumber} from "../utils/visits.jsx";
import {
  createVisit,
  updateVisit,
} from "../api/visits.js";

export function useFinancialOperations({
  clientProfiles,
  editingFinancialOperation,
  pushNotification,
  setEditingFinancialOperation,
  setFinancialOperationModalOpen,
  setVisits,
}) {
  const handleFinancialOperationSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const extra = toVisitNumber(form.get("extra"));
      const operationType = String(form.get("operationType") ?? "Доплата");

      if (extra <= 0) {
        return;
      }

      const operation = attachClientLink(clientProfiles, {
        amount: 0,
        client: String(form.get("client") ?? "").trim(),
        commission: 0,
        commissionType: "Без комиссии",
        date: toDisplayDate(form.get("date")),
        debt: 0,
        discount: 0,
        duration: "",
        extra,
        master: "",
        note: String(form.get("note") ?? "").trim(),
        packageName: "",
        packageSessionsUsed: 0,
        packageUsageId: "",
        payment: String(form.get("payment") ?? "Не указано"),
        recordType: "operation",
        service: operationType,
        tip: 0,
      });

      if (editingFinancialOperation) {
        const nextOperation = {...editingFinancialOperation, ...operation};
        let savedOperation = nextOperation;
        try {
          const response = await updateVisit(editingFinancialOperation.id, nextOperation);
          savedOperation = response?.data ?? nextOperation;
        } catch (error) {
          pushNotification({
            title: "Поступление не обновлено",
            message: error?.message || "Не удалось обновить запись в backend",
            persist: false,
          });
          return;
        }

        setVisits((current) =>
          current.map((item) =>
            item.id === editingFinancialOperation.id ? savedOperation : item,
          ),
        );
        pushNotification({
          title: "Поступление обновлено",
          message: `${operationType}: ${extra} zł`,
        });
      } else {
        let savedOperation = operation;
        try {
          const response = await createVisit(operation);
          savedOperation = response?.data ?? operation;
        } catch (error) {
          pushNotification({
            title: "Поступление не добавлено",
            message: error?.message || "Не удалось сохранить запись в backend",
            persist: false,
          });
          return;
        }

        setVisits((current) => [savedOperation, ...current]);
        pushNotification({
          title: "Поступление добавлено",
          message: `${operationType}: ${extra} zł`,
        });
      }

      setEditingFinancialOperation(null);
      setFinancialOperationModalOpen(false);
    },
    [
      clientProfiles,
      editingFinancialOperation,
      pushNotification,
      setEditingFinancialOperation,
      setFinancialOperationModalOpen,
      setVisits,
    ],
  );

  return {handleFinancialOperationSubmit};
}
