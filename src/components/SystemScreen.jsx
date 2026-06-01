import {
  Home,
  LoaderCircle,
  LogOut,
  RefreshCw,
  SearchX,
  TriangleAlert,
} from "lucide-react";

const icons = {
  error: TriangleAlert,
  loading: LoaderCircle,
  "not-found": SearchX,
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
  const Icon = icons[mode] ?? TriangleAlert;

  return (
    <main className={`login-screen system-screen theme-${settings?.theme ?? "light"}`}>
      <section className="login-card system-card">
        <div className="login-brand">
          <span className="login-brand-mark">N</span>
          <div>
            <strong>{settings?.studioName ?? "NUAR"}</strong>
            <small>CRM</small>
          </div>
        </div>
        <div className="system-state">
          <span className={`system-icon system-icon-${mode}`}>
            <Icon className={mode === "loading" ? "spin" : ""} size={22} />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{message}</p>
          </div>
        </div>
        {(onAction || onLogout) && (
          <div className="system-actions">
            {onAction && (
              <button className="submit-button" type="button" onClick={onAction}>
                {mode === "not-found" ? <Home size={16} /> : <RefreshCw size={16} />}
                {actionLabel}
              </button>
            )}
            {onLogout && (
              <button className="secondary-button" type="button" onClick={onLogout}>
                <LogOut size={16} />
                Выйти
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default SystemScreen;
