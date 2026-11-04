import {useEffect, useState} from "react";
import {fetchBackupStatus} from "../api/systemDiagnostics.js";
import {AppIcon, Button} from "./ui/index.js";

const formatDate = (value) => value
  ? new Date(value).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"})
  : "—";

export default function BackupStatusPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchBackupStatus()
      .then((result) => { if (active) setStatus(result); })
      .catch((loadError) => { if (active) setError(loadError.message || "Проверка не выполнена"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const healthy = status?.healthy === true;
  const label = loading ? "Проверка..." : healthy ? "Копия актуальна" : "Требует внимания";

  return (
    <div className={`backup-status-panel ${healthy ? "is-healthy" : "is-warning"}`}>
      <span className="backup-status-icon"><AppIcon name="databaseBackup" size="md" /></span>
      <div className="backup-status-copy">
        <div className="flex items-center gap-2 flex-wrap"><strong>Серверная резервная копия</strong><span>{label}</span></div>
        {error ? <small className="text-accentError">{error}</small> : status?.available ? (
          <small>
            Последняя: {formatDate(status.latest?.createdAt)} · {status.latest?.sizeFormatted || "—"}
            {status.latest?.entryCount ? ` · ${status.latest.entryCount} объектов` : ""}
            {status.mirror?.configured
              ? ` · внешняя копия: ${status.mirror.healthy ? "актуальна" : "требует внимания"}`
              : " · внешняя копия не настроена"}
            {status.restoreDrill?.available
              ? ` · восстановление проверено: ${formatDate(status.restoreDrill.completedAt)}${status.restoreDrill.healthy ? "" : " (проверка устарела)"}`
              : " · полное восстановление ещё не проверялось"}
          </small>
        ) : <small>Резервные копии не найдены. Проверьте расписание `db:backup` на сервере.</small>}
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
  );
}
