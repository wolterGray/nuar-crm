import {useCallback, useEffect, useState} from "react";
import {applySiteBookingRequest} from "../utils/applySiteBooking.js";
import {
  fetchPendingSiteBookings,
  fetchRecentSiteBookings,
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
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [applyingRequestId, setApplyingRequestId] = useState("");

  const refreshPendingRequests = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [requests, recent] = await Promise.all([
        fetchPendingSiteBookings(),
        fetchRecentSiteBookings(),
      ]);
      setPendingRequests(requests);
      setRecentRequests(recent);
    } catch (error) {
      setLoadError(error?.message || "Не удалось загрузить заявки с сайта");
      setPendingRequests([]);
      setRecentRequests([]);
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
        setRecentRequests((current) =>
          current.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  linked_calendar_entry_id: String(result.calendarEntryId),
                  status: "applied",
                  updated_at: new Date().toISOString(),
                }
              : item,
          ),
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
      setRecentRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {...item, status: "rejected", updated_at: new Date().toISOString()}
            : item,
        ),
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
    recentRequests,
    refreshPendingRequests,
    rejectRequest,
  };
}
