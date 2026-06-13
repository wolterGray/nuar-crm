import {useCallback, useEffect, useState} from "react";
import {applySiteBookingRequest} from "../utils/applySiteBooking.js";
import {
  fetchPendingSiteBookings,
  updateSiteBookingRequest,
} from "../utils/siteBookingApi.js";
import {summarizeSiteBookingRequest} from "../utils/siteBooking.js";

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
        linked_calendar_entry_id: result.calendarEntryId,
        status: "applied",
      });

      setPendingRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );

      pushNotification({
        message: summarizeSiteBookingRequest(request),
        title: "Заявка с сайта добавлена в календарь",
      });
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
    loadError,
    loading,
    pendingRequests,
    refreshPendingRequests,
    rejectRequest,
  };
}
