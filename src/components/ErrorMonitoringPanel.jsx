import {useEffect, useState} from "react";
import {fetchErrorSummary} from "../api/auditLogs.js";
import {AppIcon, Button} from "./ui/index.js";

const emptySummary = {
  counts: {errorCount24h: 0, failedDeliveries24h: 0, pendingDeliveries: 0, retryingDeliveries: 0, warningCount24h: 0},
  recent: [],
  retention: null,
  worker: null,
};

export default function ErrorMonitoringPanel() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchErrorSummary()
      .then((result) => {
        if (active) setSummary(result || emptySummary);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Не удалось загрузить диагностику");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  const counts = summary.counts || emptySummary.counts;
  const workerHealthy = summary.worker?.active && !summary.worker?.lastError;
  const healthItems = [
    {label: "Ошибки за 24 ч", value: counts.errorCount24h, tone: counts.errorCount24h ? "danger" : "success"},
    {label: "Предупреждения", value: counts.warningCount24h, tone: counts.warningCount24h ? "warning" : "neutral"},
    {label: "Очередь", value: counts.pendingDeliveries + counts.retryingDeliveries, tone: counts.retryingDeliveries ? "warning" : "neutral"},
    {label: "Worker", value: workerHealthy ? "Работает" : "Проверить", tone: workerHealthy ? "success" : "danger"},
  ];

  return (
    <section className="error-monitoring flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-sm font-bold text-text-main">Состояние системы</h3>
          <p className="m-0 mt-0.5 text-xs text-text-muted">Ошибки API и доставка уведомлений за последние 24 часа.</p>
        </div>
        <Button
          disabled={loading}
          onClick={() => { setLoading(true); setError(""); setRefreshKey((value) => value + 1); }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <AppIcon name="refresh" size="sm" />
        </Button>
      </div>
      <div className="error-monitoring-kpis">
        {healthItems.map((item) => (
          <div className={`error-monitoring-kpi is-${item.tone}`} key={item.label}>
            <span>{item.label}</span><strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {summary.retention ? (
        <div className="error-monitoring-retention">
          <AppIcon name="database" size="sm" />
          <span>
            Очистка технических данных: {summary.retention.active ? "активна" : "выключена"}
            {summary.retention.lastRunAt
              ? ` · ${new Date(summary.retention.lastRunAt).toLocaleString("ru-RU")} · удалено ${summary.retention.lastResult?.totalDeleted || 0}`
              : " · ожидает первого запуска"}
          </span>
        </div>
      ) : null}
      {error ? <div className="audit-log-error">{error}</div> : null}
      {summary.recent?.length ? (
        <div className="error-monitoring-events">
          {summary.recent.map((event) => (
            <div className="error-monitoring-event" key={event.id}>
              <span className={`error-monitoring-dot is-${event.severity}`} />
              <div><strong>{event.message}</strong><small>{event.source} · {new Date(event.createdAt).toLocaleString("ru-RU")}</small></div>
            </div>
          ))}
        </div>
      ) : !loading && !error ? <div className="audit-log-empty">Недавних ошибок нет.</div> : null}
    </section>
  );
}
