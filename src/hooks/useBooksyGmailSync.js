import {useCallback, useEffect, useMemo, useState} from "react";
import {applyBooksySyncDecision} from "../utils/booksySync/applyDecision.js";
import {
  buildClientGmailConnection,
  syncBooksyGmailClient,
} from "../utils/booksySync/clientSync.js";
import {
  areBooksyGmailFunctionsAvailable,
  disconnectBooksyGmail,
  fetchBooksyGmailDashboard,
  logBooksyGmailDecision,
  runBooksyGmailSync,
  startBooksyGmailOAuth,
} from "../utils/booksySync/api.js";
import {reviewKindLabel} from "../utils/booksySync/matching.js";
import {isSupabaseConfigured} from "../lib/supabase.js";
import {
  clearStoredGmailAccessToken,
  getStoredGmailAccessToken,
  requestGmailAccessToken,
} from "../utils/gmail.js";

const LAST_SYNC_STORAGE_KEY = "nuar-crm-booksy-gmail-last-sync";

const loadLastSyncAt = () => {
  try {
    return localStorage.getItem(LAST_SYNC_STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveLastSyncAt = (value) => {
  try {
    localStorage.setItem(LAST_SYNC_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
};

const formatEventForApply = (event, services = []) => ({
  ...event,
  id: event.id,
  gmail_message_id:
    event.gmail_message_id ?? event.sync_raw_messages?.gmail_message_id,
  subject: event.sync_raw_messages?.subject,
  received_at: event.sync_raw_messages?.received_at,
  services,
  linked_calendar_entry_id:
    event.linked_calendar_entry_id ||
    event.sync_match_candidates?.find((item) => item.is_recommended)
      ?.calendar_entry_id ||
    null,
});

export function useBooksyGmailSync({
  calendarEntries,
  clientProfiles,
  createLocalId,
  employees,
  getCalendarServiceColor,
  gmailAccessToken = "",
  gmailClientId = "",
  googleEmail = "",
  importDocuments = [],
  onGoogleLogin,
  processedMessageIds = [],
  pushNotification,
  services,
  setCalendarEntries,
  setClientProfiles,
  setImportDocuments,
  setProcessedMessageIds,
}) {
  const [connection, setConnection] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [useServerSync, setUseServerSync] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(loadLastSyncAt);
  const [localGmailToken, setLocalGmailToken] = useState(getStoredGmailAccessToken);

  const effectiveGmailToken = localGmailToken || gmailAccessToken;
  const isGmailConnected = Boolean(effectiveGmailToken);

  const clientConnection = useMemo(
    () =>
      buildClientGmailConnection({
        gmailAccessToken: effectiveGmailToken,
        gmailClientId,
        googleEmail,
        lastSyncAt,
      }),
    [effectiveGmailToken, gmailClientId, googleEmail, lastSyncAt],
  );

  const activeConnection = useServerSync ? connection : clientConnection;

  const refreshClientDashboard = useCallback(() => {
    setLoadError("");
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError("Подключите Supabase, чтобы использовать Booksy Gmail Sync.");
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      if (useServerSync) {
        const data = await fetchBooksyGmailDashboard();
        setConnection(data.connection);
        setPendingEvents(data.pendingEvents ?? []);
        setParseErrors(data.parseErrors ?? []);
        return;
      }

      refreshClientDashboard();
    } catch (error) {
      refreshClientDashboard();
      setLoadError(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  }, [refreshClientDashboard, useServerSync]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!isSupabaseConfigured) {
        if (active) {
          setLoadError("Подключите Supabase, чтобы использовать Booksy Gmail Sync.");
        }
        return;
      }

      const serverReady = await areBooksyGmailFunctionsAvailable();
      if (!active) {
        return;
      }

      setUseServerSync(serverReady);

      if (serverReady) {
        setIsLoading(true);
        try {
          const data = await fetchBooksyGmailDashboard();
          if (!active) return;
          setConnection(data.connection);
          setPendingEvents(data.pendingEvents ?? []);
          setParseErrors(data.parseErrors ?? []);
        } catch {
          if (!active) return;
          refreshClientDashboard();
        } finally {
          if (active) setIsLoading(false);
        }
        return;
      }

      refreshClientDashboard();
    };

    void init();

    return () => {
      active = false;
    };
  }, [refreshClientDashboard]);

  const connectGmail = useCallback(async () => {
    if (useServerSync) {
      try {
        const authUrl = await startBooksyGmailOAuth(window.location.href);
        window.location.assign(authUrl);
        return;
      } catch {
        // fall through to client OAuth
      }
    }

    if (gmailClientId?.trim()) {
      try {
        const token = await requestGmailAccessToken(gmailClientId.trim(), {
          prompt: "consent",
        });
        setLocalGmailToken(token);
        pushNotification({
          title: "Booksy Gmail",
          message: "Gmail подключён. Можно синхронизировать письма Booksy.",
          persist: false,
        });
        return;
      } catch (error) {
        pushNotification({
          title: "Booksy Gmail",
          message: error instanceof Error ? error.message : "OAuth ошибка",
          persist: false,
        });
        return;
      }
    }

    if (onGoogleLogin) {
      onGoogleLogin();
      return;
    }

    pushNotification({
      title: "Booksy Gmail",
      message:
        "Укажите Google OAuth Client ID в настройках CRM или включите вход через Google.",
      persist: false,
    });
  }, [gmailClientId, onGoogleLogin, pushNotification, useServerSync]);

  const disconnectGmail = useCallback(async () => {
    if (useServerSync) {
      try {
        await disconnectBooksyGmail();
        await refreshDashboard();
      } catch (error) {
        pushNotification({
          title: "Booksy Gmail",
          message: error instanceof Error ? error.message : "Не удалось отключить",
          persist: false,
        });
      }
      return;
    }

    clearStoredGmailAccessToken();
    setLocalGmailToken("");
    pushNotification({
      title: "Booksy Gmail",
      message: "Локальный доступ к Gmail сброшен",
      persist: false,
    });
  }, [pushNotification, refreshDashboard, useServerSync]);

  const syncNow = useCallback(async () => {
    if (!isGmailConnected) {
      pushNotification({
        title: "Booksy Gmail",
        message: "Сначала нажмите «Подключить Gmail» и разрешите доступ к почте",
        persist: false,
      });
      return;
    }

    setIsSyncing(true);

    try {
      if (useServerSync) {
        const {data} = await runBooksyGmailSync({employees, services});
        await refreshDashboard();
        pushNotification({
          title: "Booksy Gmail Sync",
          message: data?.parsed
            ? `Найдено событий: ${data.parsed}. На проверке: ${data.pending ?? 0}.`
            : "Синхронизация завершена",
          persist: false,
        });
        return;
      }

      const result = await syncBooksyGmailClient({
        calendarEntries,
        clientProfiles,
        employees,
        gmailAccessToken: effectiveGmailToken,
        gmailClientId,
        importDocuments,
        services,
        skippedMessageIds: processedMessageIds,
      });

      setPendingEvents(result.pendingEvents);
      setParseErrors(result.parseErrors);

      if (result.pendingDocuments.length > 0 && setImportDocuments) {
        setImportDocuments((current) => {
          const knownIds = new Set(current.map((document) => document.id));
          const fresh = result.pendingDocuments.filter(
            (document) => !knownIds.has(document.id),
          );
          return fresh.length > 0 ? [...fresh, ...current] : current;
        });

        if (setProcessedMessageIds) {
          setProcessedMessageIds((current) => [
            ...new Set([
              ...current,
              ...result.pendingDocuments.map((document) => document.id),
            ]),
          ]);
        }
      }

      const syncedAt = new Date().toISOString();
      saveLastSyncAt(syncedAt);
      setLastSyncAt(syncedAt);

      const parts = [];
      if (result.pendingEvents.length) {
        parts.push(`визитов: ${result.pendingEvents.length}`);
      }
      if (result.pendingDocuments.length) {
        parts.push(`фактур: ${result.pendingDocuments.length}`);
      }

      pushNotification({
        title: "Booksy Gmail Sync",
        message: parts.length
          ? `Найдено ${parts.join(", ")}`
          : "Новых писем и фактур не найдено",
        persist: false,
      });
    } catch (error) {
      pushNotification({
        title: "Booksy Gmail Sync",
        message: error instanceof Error ? error.message : "Ошибка синхронизации",
        persist: false,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [
    calendarEntries,
    clientProfiles,
    employees,
    effectiveGmailToken,
    gmailClientId,
    googleEmail,
    isGmailConnected,
    importDocuments,
    processedMessageIds,
    pushNotification,
    refreshDashboard,
    services,
    setImportDocuments,
    useServerSync,
  ]);

  const applyDecision = useCallback(
    async (event, action, linkedCalendarEntryId = null) => {
      const formattedEvent = formatEventForApply(event, services);
      const result = applyBooksySyncDecision(formattedEvent, {
        action,
        calendarEntries,
        clientProfiles,
        createLocalId,
        getCalendarServiceColor,
        linkedCalendarEntryId:
          linkedCalendarEntryId ?? formattedEvent.linked_calendar_entry_id,
      });

      if (result.applied || action === "ignore") {
        setCalendarEntries(result.nextCalendarEntries);
        setClientProfiles(result.nextClients);
      }

      const messageId =
        event.gmail_message_id ?? event.sync_raw_messages?.gmail_message_id;

      if (messageId && setProcessedMessageIds) {
        setProcessedMessageIds((current) =>
          [...new Set([...current, messageId])],
        );
      }

      if (useServerSync && !String(event.id).startsWith("local-")) {
        try {
          await logBooksyGmailDecision({
            eventId: event.id,
            action,
            linkedCalendarEntryId:
              linkedCalendarEntryId ?? formattedEvent.linked_calendar_entry_id,
            details: result.log,
          });
        } catch (error) {
          pushNotification({
            title: "Booksy Gmail",
            message:
              error instanceof Error ? error.message : "Не удалось сохранить решение",
            persist: false,
          });
          return;
        }
      }

      setPendingEvents((current) => current.filter((item) => item.id !== event.id));
      pushNotification({
        title: "Booksy Gmail",
        message:
          action === "ignore"
            ? "Событие проигнорировано"
            : "Изменения применены в графике",
        persist: false,
      });
    },
    [
      calendarEntries,
      clientProfiles,
      createLocalId,
      getCalendarServiceColor,
      pushNotification,
      services,
      setCalendarEntries,
      setClientProfiles,
      setProcessedMessageIds,
      useServerSync,
    ],
  );

  const summary = useMemo(
    () => ({
      newVisits: pendingEvents.filter((item) => item.review_kind === "new_visit").length,
      duplicates: pendingEvents.filter(
        (item) => item.review_kind === "possible_duplicate",
      ).length,
      updates: pendingEvents.filter((item) => item.review_kind === "visit_update").length,
      cancellations: pendingEvents.filter((item) => item.review_kind === "visit_cancel")
        .length,
      needsReview: pendingEvents.filter((item) => item.review_kind === "needs_review")
        .length,
      parseErrors: parseErrors.length,
    }),
    [parseErrors.length, pendingEvents],
  );

  return {
    connection: activeConnection,
    pendingEvents,
    parseErrors,
    isLoading,
    isSyncing,
    loadError,
    summary,
    reviewKindLabel,
    connectGmail,
    disconnectGmail,
    syncNow,
    refreshDashboard,
    applyDecision,
    isConfigured: isSupabaseConfigured,
    isGmailConnected,
    useServerSync,
  };
}
