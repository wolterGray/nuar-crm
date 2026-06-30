import {
  Home,
  LoaderCircle,
  LogOut,
  RefreshCw,
  SearchX,
  TriangleAlert,
} from "lucide-react";

import {resolveColorTheme} from "../utils/colorTheme.js";
import {Button, Card} from "./ui/index.js";

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
  const themeMode = resolveColorTheme(settings).mode;

  if (mode === "loading") {
    return (
      <main className={`grid w-screen h-screen place-items-center p-6 bg-app-bg text-text-main theme-${themeMode}`}>
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle className="animate-spin text-accent" size={36} />
          <p className="text-text-muted text-sm font-medium">Загрузка</p>
        </div>
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
            <Icon size={24} />
          </span>
          <div>
            <h1 className="m-0 text-text-main text-lg font-bold leading-snug">{title}</h1>
            <p className="m-0 mt-2 text-text-muted text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        {(onAction || onLogout) && (
          <div className="flex flex-col gap-3">
            {onAction && (
              <Button variant="primary" className="w-full flex items-center justify-center gap-2 font-bold cursor-pointer" onClick={onAction}>
                {mode === "not-found" ? <Home size={16} /> : <RefreshCw size={16} />}
                {actionLabel}
              </Button>
            )}
            {onLogout && (
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2 font-medium cursor-pointer" onClick={onLogout}>
                <LogOut size={16} />
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
