import {resolveColorTheme} from "../utils/colorTheme.js";
import {AppIcon, Button, Card} from "./ui/index.js";

const icons = {
  error: "alert",
  loading: "loader",
  "not-found": "search",
};

function SystemScreen({
  actionLabel,
  message,
  mode = "loading",
  onAction,
  onLogout,
  settings,
  title,
}) {
  const iconName = icons[mode] ?? "alert";
  const themeMode = resolveColorTheme(settings).mode;

  if (mode === "loading") {
    return (
      <main className={`system-loading-screen grid w-screen h-screen place-items-center p-6 text-text-main theme-${themeMode}`}>
        <section className="system-loading-card" aria-live="polite" aria-busy="true">
          <div className="system-loading-brand" aria-label={`${settings?.studioName ?? "NUAR"} CRM`}>
            <span className="system-loading-mark">N</span>
            <div>
              <strong>{settings?.studioName ?? "NUAR"}</strong>
              <small>CRM</small>
            </div>
          </div>

          <div className="system-loading-orbit" aria-hidden="true">
            <span />
            <AppIcon className="system-loading-spinner animate-spin" name="loader" size="lg" spin />
          </div>

          <div className="system-loading-copy">
            <h1>{title || "Загружаем CRM"}</h1>
            <p>{message || "Подключаем защищённые данные и готовим рабочее пространство."}</p>
          </div>

          <div className="system-loading-progress" aria-hidden="true">
            <span />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`grid w-screen h-screen place-items-center p-6 bg-app-bg text-text-main theme-${themeMode}`}>
      <Card className="w-full max-w-[420px] p-8 flex flex-col gap-6 bg-surface/90 border border-border/40 rounded-card shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="grid w-8 h-8 place-items-center rounded-control bg-accent/10 text-accent font-extrabold text-sm shrink-0">
            N
          </span>
          <div>
            <strong className="block text-text-main text-sm font-bold tracking-tight">
              {settings?.studioName ?? "NUAR"}
            </strong>
            <small className="block text-text-faint text-[9px] font-bold tracking-widest uppercase">
              CRM
            </small>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-4 py-4">
          <span className={`grid w-14 h-14 place-items-center rounded-full bg-border-soft ${mode === "error" ? "text-red-400 bg-red-500/10" : "text-accent bg-accent/10"}`}>
            <AppIcon name={iconName} size="lg" spin={mode === "loading"} />
          </span>
          <div>
            <h1 className="m-0 text-text-main text-lg font-bold leading-snug">{title}</h1>
            <p className="m-0 mt-2 text-text-muted text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        {(onAction || onLogout) && (
          <div className="flex flex-col gap-3">
            {onAction && (
              <Button
                className="w-full flex items-center justify-center gap-2 font-bold cursor-pointer"
                leftIcon={mode === "not-found" ? "home" : "refresh"}
                variant="primary"
                onClick={onAction}>
                {actionLabel}
              </Button>
            )}
            {onLogout && (
              <Button
                className="w-full flex items-center justify-center gap-2 font-medium cursor-pointer"
                leftIcon="logout"
                variant="secondary"
                onClick={onLogout}>
                Выйти
              </Button>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}

export default SystemScreen;
