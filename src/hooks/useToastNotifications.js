import {useCallback, useEffect, useRef, useState} from "react";

export function useToastNotifications({createLocalId, setNotificationInbox}) {
  const [notifications, setNotifications] = useState([]);
  const notificationQueueRef = useRef([]);
  const notificationTimerRef = useRef(null);
  const notificationVisibleRef = useRef(false);
  const pushNotificationRef = useRef(() => {});

  const archiveNotification = useCallback((notification) => {
    if (!notification?.undoAction || notification.persist === false) {
      return;
    }

    setNotificationInbox((current) =>
      [
        {
          ...notification,
          archivedAt: new Date().toISOString(),
        },
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 60),
    );
  }, [setNotificationInbox]);

  const showNextNotification = useCallback(() => {
    if (notificationTimerRef.current || notificationVisibleRef.current) {
      return;
    }

    const [nextNotification, ...nextQueue] = notificationQueueRef.current;

    if (!nextNotification) {
      return;
    }

    notificationQueueRef.current = nextQueue;
    notificationVisibleRef.current = true;
    setNotifications([nextNotification]);
  }, []);

  const pushNotification = useCallback(
    (notification) => {
      const id = createLocalId();
      const nextNotification = {id, ...notification};

      notificationQueueRef.current = [
        ...notificationQueueRef.current,
        nextNotification,
      ];
      showNextNotification();
    },
    [createLocalId, showNextNotification],
  );

  useEffect(() => {
    pushNotificationRef.current = pushNotification;
  }, [pushNotification]);

  const closeNotification = useCallback(
    (id) => {
      archiveNotification(notifications.find((item) => item.id === id));
      setNotifications((current) => current.filter((item) => item.id !== id));

      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }

      notificationVisibleRef.current = false;
    },
    [archiveNotification, notifications],
  );

  useEffect(
    () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }

      if (notifications.length === 0) {
        notificationVisibleRef.current = false;
        notificationTimerRef.current = window.setTimeout(() => {
          notificationTimerRef.current = null;
          showNextNotification();
        }, 260);

        return () => {
          if (notificationTimerRef.current) {
            window.clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = null;
          }
        };
      }

      notificationVisibleRef.current = true;
      notificationTimerRef.current = window.setTimeout(() => {
        archiveNotification(notifications[0]);
        setNotifications([]);
      }, 4200);

      return () => {
        if (notificationTimerRef.current) {
          window.clearTimeout(notificationTimerRef.current);
          notificationTimerRef.current = null;
        }
      };
    },
    [archiveNotification, notifications, showNextNotification],
  );

  useEffect(
    () => () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }
    },
    [],
  );

  return {
    closeNotification,
    notifications,
    pushNotification,
    pushNotificationRef,
  };
}
