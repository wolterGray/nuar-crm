import {useCallback} from "react";
import {attachClientLink} from "../utils/clientLinks.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {toVisitNumber} from "../utils/visits.jsx";

export function useFinancialOperations({
  clientProfiles,
  createLocalId,
  editingFinancialOperation,
  pushNotification,
  setEditingFinancialOperation,
  setFinancialOperationModalOpen,
  setVisits,
}) {
  const handleFinancialOperationSubmit = useCallback(
    (event) => {
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
        setVisits((current) =>
          current.map((item) =>
            item.id === editingFinancialOperation.id ? {...item, ...operation} : item,
          ),
        );
        pushNotification({
          title: "Поступление обновлено",
          message: `${operationType}: ${extra} zł`,
        });
      } else {
        setVisits((current) => [
          {
            id: createLocalId(),
            ...operation,
          },
          ...current,
        ]);
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
      createLocalId,
      editingFinancialOperation,
      pushNotification,
      setEditingFinancialOperation,
      setFinancialOperationModalOpen,
      setVisits,
    ],
  );

  return {handleFinancialOperationSubmit};
}
