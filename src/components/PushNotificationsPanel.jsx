import {useCallback, useEffect, useState} from "react";
import {
  fetchPushPreferences,
  sendTestPushNotification,
  updatePushPreferences,
} from "../api/pushNotifications.js";
import {
  disableWebPush,
  enableWebPush,
  getCurrentPushState,
  isIosDevice,
} from "../utils/webPush.js";
import {AppIcon, Button, Switch} from "./ui/index.js";

const PREFERENCE_OPTIONS = [
  {key: "pushNewVisits", label: "Новые записи"},
  {key: "pushVisitCancelled", label: "Отмены"},
  {key: "pushVisitRescheduled", label: "Переносы"},
  {key: "pushImportantTasks", label: "Важные задачи на сегодня"},
  {key: "pushOverdueTasks", label: "Просроченные важные задачи"},
];

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
  const [preferences, setPreferences] = useState(null);

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

  useEffect(() => {
    let active = true;
    fetchPushPreferences()
      .then((next) => active && setPreferences(next))
      .catch((error) => pushNotification?.({title: "Настройки Push", message: error.message, persist: false}));
    return () => { active = false; };
  }, [pushNotification]);

  const changePreference = async (key, checked) => {
    const previous = preferences;
    setPreferences((current) => ({...current, [key]: checked}));
    try {
      setPreferences(await updatePushPreferences({[key]: checked}));
    } catch (error) {
      setPreferences(previous);
      pushNotification?.({title: "Настройки Push", message: error.message, persist: false});
    }
  };

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
    <section className="rounded-control border border-border-soft bg-field px-3.5 py-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-control border border-border flex items-center justify-center text-accent bg-surface">
            <AppIcon name="bellRing" size="sm" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="m-0 text-text-main text-[13px] font-semibold">Push-уведомления в браузере</h3>
              <span className={`inline-flex items-center rounded-full border border-border-soft bg-surface px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${current.tone}`}>
                {current.label}
              </span>
            </div>
            <p className="m-0 mt-0.5 text-text-muted text-xs leading-snug">
              Системные уведомления на это устройство, даже когда вкладка CRM закрыта.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {state.state === "disconnected" || state.state === "error" ? (
            <Button
              leftIcon="bellRing"
              loading={busy === "enable"}
              size="sm"
              type="button"
              variant="primary"
              onClick={() => run("enable", enableWebPush)}>
              Подключить на устройстве
            </Button>
          ) : null}
          {state.state === "connected" ? (
            <>
              <Button
                loading={busy === "test"}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => run("test", async () => {
                  const result = await sendTestPushNotification();
                  pushNotification?.({
                    title: "Тест отправлен",
                    message: `Устройства: ${result.sent} из ${result.total}`,
                    persist: false,
                  });
                  return state;
                })}>
                Тест
              </Button>
              <Button
                loading={busy === "disable"}
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => run("disable", disableWebPush)}>
                Отключить
              </Button>
            </>
          ) : null}
          {state.state === "loading" ? <span className="text-xs text-text-faint">Проверка…</span> : null}
        </div>
      </div>

      {iosInstallRequired ? (
        <div className="rounded-control border border-border-soft bg-surface px-3 py-2 text-xs text-text-muted leading-snug">
          На iPhone откройте CRM в Safari → «Поделиться» → «На экран Домой», затем запустите CRM с иконки и подключите Push.
        </div>
      ) : null}
      {state.state === "blocked" ? (
        <p className="m-0 text-xs text-text-muted leading-snug">
          Разрешите уведомления для сайта в настройках браузера или в Настройки → Уведомления → NUAR CRM.
        </p>
      ) : null}
      {state.state === "unsupported" && !iosInstallRequired ? (
        <p className="m-0 text-xs text-text-muted leading-snug">
          Push-уведомления требуют современный браузер и защищённое HTTPS-соединение.
        </p>
      ) : null}
      {state.state === "error" ? (
        <p className="m-0 text-xs text-accentError">{state.reason || "Проверьте соединение с сервером."}</p>
      ) : null}
      {isIosDevice() && state.state === "connected" ? (
        <p className="m-0 text-[11px] text-text-faint">Подключено для установленного приложения NUAR CRM на этом устройстве.</p>
      ) : null}
      {preferences ? (
        <div className="border-t border-border-soft pt-2.5">
          <p className="m-0 mb-2 text-xs font-semibold text-text-main">Какие события присылать</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {PREFERENCE_OPTIONS.map((option) => (
              <label key={option.key} className="flex min-h-8 items-center justify-between gap-3 text-xs text-text-muted cursor-pointer">
                <span>{option.label}</span>
                <Switch
                  checked={preferences[option.key] === true}
                  aria-label={option.label}
                  onChange={(event) => changePreference(option.key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
