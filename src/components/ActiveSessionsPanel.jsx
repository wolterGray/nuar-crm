import {useCallback, useEffect, useState} from "react";
import {
  fetchAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
} from "../api/auth.js";
import {AppIcon, Badge, Button, Card} from "./ui/index.js";

const formatSessionDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Неизвестно"
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
      });
};

function ActiveSessionsPanel({pushNotification}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAuthSessions();
      setSessions(payload.sessions || []);
    } catch (requestError) {
      setError(requestError?.message || "Не удалось загрузить активные устройства");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  const revokeSession = async (session) => {
    setBusyId(session.id);
    try {
      const payload = await revokeAuthSession(session.id);
      if (payload.current) {
        window.dispatchEvent(new Event("nuar-crm-auth-lost"));
        return;
      }
      setSessions((current) => current.filter((item) => item.id !== session.id));
      pushNotification?.({
        title: "Сеанс завершён",
        message: session.deviceName || "Устройство отключено от CRM",
        persist: false,
      });
    } catch (requestError) {
      pushNotification?.({
        title: "Не удалось завершить сеанс",
        message: requestError?.message || "Повторите попытку",
        persist: false,
      });
    } finally {
      setBusyId("");
    }
  };

  const revokeOthers = async () => {
    setBusyId("others");
    try {
      const payload = await revokeOtherAuthSessions();
      setSessions((current) => current.filter((session) => session.current));
      pushNotification?.({
        title: "Другие устройства отключены",
        message: `Завершено сеансов: ${payload.revokedCount || 0}`,
        persist: false,
      });
    } catch (requestError) {
      pushNotification?.({
        title: "Не удалось отключить устройства",
        message: requestError?.message || "Повторите попытку",
        persist: false,
      });
    } finally {
      setBusyId("");
    }
  };

  const otherSessionCount = sessions.filter((session) => !session.current).length;

  return (
    <Card className="active-sessions-card p-4 sm:p-5">
      <div className="active-sessions-header">
        <div className="active-sessions-heading">
          <span className="active-sessions-heading-icon">
            <AppIcon name="devices" size="md" />
          </span>
          <div>
            <div className="active-sessions-title-row">
              <h2>Активные устройства</h2>
              <Badge variant="neutral" size="sm">{sessions.length}</Badge>
            </div>
            <p>Устройства, на которых выполнен вход в ваш аккаунт.</p>
          </div>
        </div>
        {otherSessionCount > 0 ? (
          <Button
            loading={busyId === "others"}
            size="sm"
            type="button"
            variant="secondary"
            onClick={revokeOthers}
          >
            Выйти на других
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="active-sessions-state">Загрузка устройств…</div>
      ) : error ? (
        <div className="active-sessions-state is-error">
          <span>{error}</span>
          <Button size="sm" type="button" variant="ghost" onClick={loadSessions}>Повторить</Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="active-sessions-state">Активные устройства не найдены.</div>
      ) : (
        <div className="active-sessions-list">
          {sessions.map((session) => (
            <article className="active-session-row" key={session.id}>
              <span className="active-session-device-icon">
                <AppIcon name={session.deviceName === "iPhone" || session.deviceName === "Android" ? "smartphone" : "monitor"} size="md" />
              </span>
              <div className="active-session-copy">
                <div>
                  <strong>{session.deviceName || "Неизвестное устройство"}</strong>
                  {session.current ? <Badge variant="success" size="sm">Это устройство</Badge> : null}
                </div>
                <small>
                  Активность: {formatSessionDate(session.lastUsedAt)}
                  {session.ip ? ` · IP ${session.ip}` : ""}
                </small>
              </div>
              <Button
                loading={busyId === session.id}
                size="sm"
                type="button"
                variant={session.current ? "ghost" : "secondary"}
                onClick={() => revokeSession(session)}
              >
                {session.current ? "Выйти" : "Завершить"}
              </Button>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

export default ActiveSessionsPanel;
