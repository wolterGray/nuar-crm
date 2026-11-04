import {useEffect, useState} from "react";
import {fetchDataIntegrityStatus} from "../api/systemDiagnostics.js";
import {AppIcon, Button} from "./ui/index.js";

const CHECK_LABELS = {
  completedEntriesWithoutVisit: "Завершённые записи без визита",
  duplicateVisitLinks: "Дубли завершённых визитов",
  invalidCertificateBalances: "Некорректные остатки сертификатов",
  invalidPackageBalances: "Некорректные остатки пакетов",
  mismatchedVisitLinks: "Несогласованные связи календаря",
  missingCalendarEntries: "Визиты без записи календаря",
  missingVisits: "Записи календаря без визита",
};

export default function DataIntegrityPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchDataIntegrityStatus()
      .then((result) => { if (active) setStatus(result); })
      .catch((loadError) => { if (active) setError(loadError.message || "Проверка не выполнена"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const issues = Object.entries(status?.checks || {}).filter(([, check]) => check.count > 0);
  const healthy = status?.healthy === true && issues.length === 0;
  const automaticCheck = status?.automation?.lastRunAt
    ? new Date(status.automation.lastRunAt).toLocaleString("ru-RU", {dateStyle: "short", timeStyle: "short"})
    : "ещё не выполнялась";

  return (
    <div className={`backup-status-panel ${healthy ? "is-healthy" : "is-warning"}`}>
      <span className="backup-status-icon"><AppIcon name="shield-check" size="md" /></span>
      <div className="backup-status-copy">
        <div className="flex items-center gap-2 flex-wrap">
          <strong>Целостность данных CRM</strong>
          <span>{loading ? "Проверка..." : healthy ? "Ошибок нет" : "Требует внимания"}</span>
        </div>
        {error ? <small className="text-accentError">{error}</small> : issues.length > 0 ? (
          <small>{issues.map(([key, check]) => `${CHECK_LABELS[key] || key}: ${check.count}`).join(" · ")}</small>
        ) : (
          <small>Связи календаря, визитов, пакетов и сертификатов согласованы.</small>
        )}
        {!loading && !error ? <small>Автопроверка: {automaticCheck}</small> : null}
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
