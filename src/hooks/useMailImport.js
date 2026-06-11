import {useCallback} from "react";
import {processMailImports} from "../utils/mailImport.js";

export function useMailImport({
  calendarEntries,
  clientProfiles,
  createLocalId,
  getCalendarServiceColor,
  importDocuments,
  pushNotification,
  setCalendarEntries,
  setClientProfiles,
  setImportDocuments,
  setImportedMailIds,
}) {
  const applyMailImports = useCallback(
    (items) => {
      const result = processMailImports(items, {
        calendarEntries,
        clientProfiles,
        createLocalId,
        getCalendarServiceColor,
        importDocuments,
      });

      setClientProfiles(result.nextClients);
      setCalendarEntries(result.nextCalendarEntries);
      setImportDocuments(result.nextDocuments);
      setImportedMailIds((current) => [...new Set([...current, ...result.appliedIds])]);
      pushNotification({
        title: "Импорт Gmail завершён",
        message: `Записей: ${result.changedBookings} · новых клиентов: ${result.addedClients} · документов: ${result.documentCount}`,
        persist: false,
      });
    },
    [
      calendarEntries,
      clientProfiles,
      createLocalId,
      getCalendarServiceColor,
      importDocuments,
      pushNotification,
      setCalendarEntries,
      setClientProfiles,
      setImportDocuments,
      setImportedMailIds,
    ],
  );

  return {applyMailImports};
}
