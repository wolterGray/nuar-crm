import AppIcon from "../../ui/AppIcon.jsx";
import Button from "../../ui/Button.jsx";
import IconButton from "../../ui/IconButton.jsx";

export default function ClientQualityPanel({
  report,
  onClose,
  onEditClient,
  onOpenClient,
}) {
  const topMissing = [
    ...report.missingPhone.map((client) => ({
      client,
      label: "Нет телефона",
      type: "phone",
    })),
    ...report.missingSource.map((client) => ({
      client,
      label: "Нет источника",
      type: "source",
    })),
    ...report.missingMessageLanguage.map((client) => ({
      client,
      label: "Нет языка SMS",
      type: "lang",
    })),
  ].slice(0, 5);

  const duplicateGroups = [
    ...report.duplicatePhones.map((group) => ({ ...group, type: "phone" })),
    ...report.duplicateNames.map((group) => ({ ...group, type: "name" })),
  ].slice(0, 4);

  const isGoodHealth = report.score >= 90;

  return (
    <section aria-label="Анализ качества базы" className="clients-quality-panel">
      {/* 1. Header Bar: Title, Health Score Badge, Close Button */}
      <div className="quality-panel-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="quality-panel-icon-wrap">
            <AppIcon name="barChart2" size="sm" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="quality-panel-title">Анализ качества базы</h3>
            <span
              className={`quality-score-pill ${
                isGoodHealth ? "is-good" : "is-warning"
              }`}>
              <span className="score-dot" />
              <span>{report.score}% чистоты</span>
            </span>
          </div>
          <span className="quality-panel-summary hidden sm:inline">
            {report.hasIssues
              ? `${report.issuesCount} пунктов требуют внимания`
              : "Критических проблем не обнаружено"}
          </span>
        </div>

        {onClose && (
          <IconButton
            icon="x"
            label="Скрыть анализ"
            size="sm"
            variant="ghost"
            onClick={onClose}
          />
        )}
      </div>

      {/* 2. Metrics Row (Clean 4-column KPI strip like /today) */}
      <div className="quality-metrics-strip">
        <div className="quality-metric-cell">
          <span className="metric-label">Дубли телефонов</span>
          <div className="metric-val-wrap">
            <strong className={`metric-val ${report.duplicatePhones.length > 0 ? "text-amber-400" : "text-textPrimary"}`}>
              {report.duplicatePhones.length}
            </strong>
            <span className="metric-sub">совпадающих</span>
          </div>
        </div>

        <div className="quality-metric-cell">
          <span className="metric-label">Дубли имён</span>
          <div className="metric-val-wrap">
            <strong className={`metric-val ${report.duplicateNames.length > 0 ? "text-amber-400" : "text-textPrimary"}`}>
              {report.duplicateNames.length}
            </strong>
            <span className="metric-sub">одинаковых ФИО</span>
          </div>
        </div>

        <div className="quality-metric-cell">
          <span className="metric-label">Без телефона</span>
          <div className="metric-val-wrap">
            <strong className={`metric-val ${report.missingPhone.length > 0 ? "text-rose-400" : "text-textPrimary"}`}>
              {report.missingPhone.length}
            </strong>
            <span className="metric-sub">нет контактов</span>
          </div>
        </div>

        <div className="quality-metric-cell">
          <span className="metric-label">Без источника / SMS</span>
          <div className="metric-val-wrap">
            <strong className={`metric-val ${(report.missingSource.length + report.missingMessageLanguage.length) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {report.missingSource.length + report.missingMessageLanguage.length}
            </strong>
            <span className="metric-sub">
              {(report.missingSource.length + report.missingMessageLanguage.length) === 0 ? "все каналы есть" : "не заполнен канал"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Actionable Details Grid (Two columns with lists) */}
      {(topMissing.length > 0 || duplicateGroups.length > 0) && (
        <div className="quality-actions-grid">
          {/* Col 1: Missing Fields to Fix */}
          <div className="quality-action-col">
            <div className="quality-action-col-header">
              <AppIcon name="edit3" size="xs" />
              <span>Быстро заполнить профили</span>
              <span className="col-count">({report.missingPhone.length + report.missingSource.length})</span>
            </div>

            {topMissing.length > 0 ? (
              <div className="quality-items-list">
                {topMissing.map((item) => (
                  <div
                    key={`${item.label}-${item.client.id}`}
                    className="quality-item-row">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="quality-item-avatar">
                        {(item.client.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="quality-item-name truncate">
                          {item.client.name || item.client.phone || "Без имени"}
                        </span>
                        <span className="quality-item-tag">
                          {item.label}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="subtle"
                      className="quality-action-btn"
                      onClick={() => onEditClient?.(item.client)}>
                      <span>Заполнить</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="quality-empty-notice">Все важные контакты заполнены.</p>
            )}
          </div>

          {/* Col 2: Duplicates */}
          <div className="quality-action-col">
            <div className="quality-action-col-header">
              <AppIcon name="users" size="xs" />
              <span>Возможные дубликаты</span>
              <span className="col-count">({report.duplicatePhones.length + report.duplicateNames.length})</span>
            </div>

            {duplicateGroups.length > 0 ? (
              <div className="quality-items-list">
                {duplicateGroups.map((group) => {
                  const firstClient = group.clients[0];
                  return (
                    <div
                      key={group.key}
                      className="quality-item-row">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="quality-item-name font-semibold truncate">
                            {group.clients.map((c) => c.name).join(" · ")}
                          </span>
                        </div>
                        <span className="quality-item-tag text-amber-400">
                          {group.type === "phone" ? "Одинаковый телефон" : "Одинаковое имя"} · {group.clients.length} записи
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="subtle"
                        className="quality-action-btn"
                        onClick={() => onOpenClient(firstClient)}>
                        <span>Открыть</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="quality-empty-notice">Дубликатов клиентов не найдено.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
