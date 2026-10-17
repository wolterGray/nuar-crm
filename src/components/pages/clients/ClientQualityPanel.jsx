import Button from "../../ui/Button.jsx";

export default function ClientQualityPanel({ report, onEditClient, onOpenClient }) {
  const topMissing = [
    ...report.missingPhone.map((client) => ({
      client,
      label: "Нет телефона",
    })),
    ...report.missingSource.map((client) => ({
      client,
      label: "Нет источника",
    })),
    ...report.missingMessageLanguage.map((client) => ({
      client,
      label: "Нет языка SMS",
    })),
  ].slice(0, 5);
  const duplicateGroups = [...report.duplicatePhones, ...report.duplicateNames].slice(
    0,
    4,
  );

  return (
    <section className="clients-quality-panel grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr_1.4fr] gap-3 mb-3 p-4 rounded-xl border border-border bg-surface">
      {/* Quality Score */}
      <div className="clients-quality-card clients-quality-score flex flex-col gap-1 p-3.5 rounded-xl border border-border bg-surface-2">
        <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">Качество базы</span>
        <strong className="text-textPrimary text-3xl font-extrabold leading-none mt-1">{report.score}%</strong>
        <small className="text-[11px] text-textMuted mt-2">
          {report.hasIssues
            ? `${report.issuesCount} пунктов к проверке`
            : "База выглядит чисто"}
        </small>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">Дубли телефонов</span>
          <strong className="text-textPrimary text-xl font-bold mt-1">{report.duplicatePhones.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">Дубли имён</span>
          <strong className="text-textPrimary text-xl font-bold mt-1">{report.duplicateNames.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">Без телефона</span>
          <strong className="text-textPrimary text-xl font-bold mt-1">{report.missingPhone.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">Без источника/SMS</span>
          <strong className="text-textPrimary text-xl font-bold mt-1">
            {report.missingSource.length + report.missingMessageLanguage.length}
          </strong>
        </article>
      </div>

      {/* Quality Lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Missing fields */}
        <div className="clients-quality-card flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold mb-1">Быстро исправить</span>
          {topMissing.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-y-auto max-h-36 pr-0.5">
              {topMissing.map((item) => (
                <Button
                  key={`${item.label}-${item.client.id}`}
                  className="flex flex-col items-start text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditClient?.(item.client)}>
                  <strong className="text-xs text-textPrimary group-hover:text-accent font-semibold truncate w-full">{item.client.name}</strong>
                  <small className="text-[10px] text-textMuted truncate w-full">{item.label}</small>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-textMuted py-2">Критичных пропусков нет.</p>
          )}
        </div>

        {/* Duplicates */}
        <div className="clients-quality-card flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-surface-2">
          <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold mb-1">Похожие клиенты</span>
          {duplicateGroups.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-y-auto max-h-36 pr-0.5">
              {duplicateGroups.map((group) => (
                <Button
                  key={group.key}
                  className="flex flex-col items-start text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenClient(group.clients[0])}>
                  <strong className="text-xs text-textPrimary group-hover:text-accent font-semibold truncate w-full">{group.clients.map((client) => client.name).join(" / ")}</strong>
                  <small className="text-[10px] text-textMuted truncate w-full">{group.clients.length} записи · открыть</small>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-textMuted py-2">Дублей не найдено.</p>
          )}
        </div>
      </div>
    </section>
  );
}
