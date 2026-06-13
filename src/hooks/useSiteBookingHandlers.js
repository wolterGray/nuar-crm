import {useCallback, useEffect, useState} from "react";
import {applySiteBookingRequest} from "../utils/applySiteBooking.js";
import {
  fetchPendingSiteBookings,
  updateSiteBookingRequest,
} from "../utils/siteBookingApi.js";
import {summarizeSiteBookingRequest, formatSiteBookingInputDate} from "../utils/siteBooking.js";

export function useSiteBookingHandlers({
  calendarEntries,
  clientProfiles,
  createLocalId,
  employees,
  getCalendarServiceColor,
  pushNotification,
  serviceCatalog,
  setCalendarEntries,
  setClientProfiles,
}) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [applyingRequestId, setApplyingRequestId] = useState("");

  const refreshPendingRequests = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const requests = await fetchPendingSiteBookings();
      setPendingRequests(requests);
    } catch (error) {
      setLoadError(error?.message || "Не удалось загрузить заявки с сайта");
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPendingRequests();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshPendingRequests]);

  const applyRequest = useCallback(
    async (request) => {
      setApplyingRequestId(request.id);

      try {
        const result = applySiteBookingRequest(request, {
          calendarEntries,
          clientProfiles,
          createLocalId,
          employees,
          getCalendarServiceColor,
          serviceCatalog,
        });

        setClientProfiles(result.nextClients);
        setCalendarEntries(result.nextCalendarEntries);

        await updateSiteBookingRequest(request.id, {
          linked_calendar_entry_id: String(result.calendarEntryId),
          status: "applied",
        });

        setPendingRequests((current) =>
          current.filter((item) => item.id !== request.id),
        );

        const visitDate =
          result.nextCalendarEntries.at(-1)?.date ||
          formatSiteBookingInputDate(
            request.preferred_date ?? request.preferredDate,
          );

        pushNotification({
          message: `${summarizeSiteBookingRequest(request)}${
            visitDate ? ` · Откройте календарь на ${visitDate}` : ""
          }`,
          title: "Заявка с сайта добавлена в календарь",
        });
      } catch (error) {
        pushNotification({
          message:
            error?.message ||
            "Не удалось добавить заявку в календарь. Проверьте вход в CRM и синхронизацию с облаком.",
          title: "Ошибка импорта заявки",
        });
      } finally {
        setApplyingRequestId("");
      }
    },
    [
      calendarEntries,
      clientProfiles,
      createLocalId,
      employees,
      getCalendarServiceColor,
      pushNotification,
      serviceCatalog,
      setCalendarEntries,
      setClientProfiles,
    ],
  );

  const rejectRequest = useCallback(
    async (request) => {
      await updateSiteBookingRequest(request.id, {status: "rejected"});
      setPendingRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      pushNotification({
        message: summarizeSiteBookingRequest(request),
        title: "Заявка с сайта отклонена",
      });
    },
    [pushNotification],
  );

  return {
    applyRequest,
    applyingRequestId,
    loadError,
    loading,
    pendingRequests,
    refreshPendingRequests,
    rejectRequest,
  };
}
