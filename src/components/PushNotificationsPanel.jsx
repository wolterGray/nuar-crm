import {useCallback, useEffect, useState} from "react";
import {sendTestPushNotification} from "../api/pushNotifications.js";
import {
  disableWebPush,
  enableWebPush,
  getCurrentPushState,
  isIosDevice,
} from "../utils/webPush.js";
import {AppIcon, Button} from "./ui/index.js";

const STATUS = {
  loading: {label: "Проверяем…", tone: "text-text-muted"},
  connected: {label: "Подключены", tone: "text-accentSuccess"},
  disconnected: {label: "Не подключены", tone: "text-text-muted"},
  blocked: {label: "Разрешение заблокировано", tone: "text-accentError"},
  unsupported: {label: "Не поддерживаются", tone: "text-accentWarning"},
  error: {label: "Не удалось проверить", tone: "text-accentError"},
};

export default function PushNotificationsPanel({pushNotification}) {
  const [state, setState] = useState({state: "loading", reason: null});
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    setState({state: "loading", reason: null});
    try {
      setState(await getCurrentPushState());
    } catch (error) {
      setState({state: "error", reason: error.message});
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentPushState()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((error) => {
        if (active) setState({state: "error", reason: error.message});
      });
    return () => {
      active = false;
    };
  }, []);

  const run = async (action, callback) => {
    setBusy(action);
    try {
      const next = await callback();
      if (next?.state) setState(next);
    } catch (error) {
      pushNotification?.({title: "Push-уведомления", message: error.message, persist: false});
      await refresh();
    } finally {
      setBusy("");
    }
  };

  const current = STATUS[state.state] || STATUS.error;
  const iosInstallRequired = state.reason === "ios-install-required";

  return (
    <section className="rounded-card border border-border-soft bg-field p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 rounded-control border border-border flex items-center justify-center text-accent bg-surface">
            <AppIcon name="bellRing" size="sm" />
          </span>
          <div>
            <h3 className="m-0 text-text-main text-sm font-semibold">Push-уведомления</h3>
            <p className="m-0 mt-1 text-text-muted text-xs leading-relaxed">
              Системные уведомления приходят на это устройство, даже когда CRM закрыта.
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold whitespace-nowrap ${current.tone}`}>{current.label}</span>
      </div>

      {iosInstallRequired ? (
        <div className="rounded-control border border-border-soft bg-surface p-3 text-xs text-text-muted leading-relaxed">
          На iPhone откройте CRM в Safari, нажмите «Поделиться» → «На экран Домой», затем запустите CRM с новой иконки и включите уведомления.
        </div>
      ) : null}
      {state.state === "blocked" ? (
        <p className="m-0 text-xs text-text-muted leading-relaxed">
          Разрешите уведомления в настройках браузера. На iPhone: Настройки → Уведомления → NUAR CRM.
        </p>
      ) : null}
      {state.state === "unsupported" && !iosInstallRequired ? (
        <p className="m-0 text-xs text-text-muted leading-relaxed">
          Нужен современный браузер с Service Worker и Push API через защищённое HTTPS-соединение.
        </p>
      ) : null}
      {state.state === "error" ? (
        <p className="m-0 text-xs text-accentError">{state.reason || "Проверьте соединение с сервером."}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {state.state === "disconnected" || state.state === "error" ? (
          <Button
            leftIcon="bellRing"
            loading={busy === "enable"}
            variant="primary"
            onClick={() => run("enable", enableWebPush)}>
            Включить уведомления
          </Button>
        ) : null}
        {state.state === "connected" ? (
          <>
            <Button
              loading={busy === "test"}
              variant="primary"
              onClick={() => run("test", async () => {
                const result = await sendTestPushNotification();
                pushNotification?.({
                  title: "Тест отправлен",
                  message: `Устройства: ${result.sent} из ${result.total}`,
                  persist: false,
                });
                return state;
              })}>
              Отправить тестовое уведомление
            </Button>
            <Button
              loading={busy === "disable"}
              variant="secondary"
              onClick={() => run("disable", disableWebPush)}>
              Отключить
            </Button>
          </>
        ) : null}
        {state.state === "loading" ? <span className="text-xs text-text-faint">Проверяем это устройство…</span> : null}
      </div>
      {isIosDevice() && state.state === "connected" ? (
        <p className="m-0 text-[12px] text-text-faint">Уведомления подключены для установленной копии NUAR CRM на этом устройстве.</p>
      ) : null}
    </section>
  );
}
