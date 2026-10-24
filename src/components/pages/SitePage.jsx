import {useMemo} from "react";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {parseWaitlistEntryDetails} from "../../utils/waitlist.js";
import PageHeader from "../ui/PageHeader.jsx";
import SiteAdminPanel from "../SiteAdminPanel.jsx";
import "./SitePage.css";

const formatLatestRequest = (value) => {
  if (!value) return "Нет заявок";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Нет данных";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
};

function SitePage({waitlistEntries = []}) {
  const {isMobile} = useBreakpoint();
  const siteStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const siteRequests = waitlistEntries
      .map((entry) => parseWaitlistEntryDetails(entry))
      .filter((entry) => entry.isSiteBooking);
    const currentMonth = siteRequests.filter((entry) => {
      const createdAt = new Date(entry.createdAt || 0).getTime();
      return Number.isFinite(createdAt) && createdAt >= monthStart;
    });
    const booked = currentMonth.filter((entry) => entry.isCompleted).length;
    const latest = siteRequests.reduce((latestValue, entry) => {
      const timestamp = new Date(entry.createdAt || 0).getTime();
      return Number.isFinite(timestamp) && timestamp > latestValue ? timestamp : latestValue;
    }, 0);

    return {
      booked,
      conversion: currentMonth.length > 0 ? Math.round((booked / currentMonth.length) * 100) : 0,
      latest: latest ? new Date(latest).toISOString() : null,
      requests: currentMonth.length,
    };
  }, [waitlistEntries]);

  const statsPanel = (
    <section className="panel site-stats-panel" aria-labelledby="site-stats-title">
      <div className="site-stats-heading">
        <div>
          <h2 id="site-stats-title">Онлайн-запись</h2>
          <p>Текущий месяц</p>
        </div>
      </div>
      <div className="site-stats-grid">
        <article><span>Заявки</span><strong>{siteStats.requests}</strong></article>
        <article><span>Записаны</span><strong>{siteStats.booked}</strong></article>
        <article><span>Конверсия</span><strong>{siteStats.conversion}%</strong></article>
        <article><span>Последняя заявка</span><strong>{formatLatestRequest(siteStats.latest)}</strong></article>
      </div>
    </section>
  );

  if (isMobile) {
    return (
      <section className="site-page site-page-mobile nuar-site">
        <PageHeader
          className="site-page-header"
          description="Управление сайтом и проверка онлайн-записи"
          title="Сайт"
        />

        <div className="site-mobile-admin-panel">
          <SiteAdminPanel compact embeddedMobile />
        </div>
        {statsPanel}
      </section>
    );
  }

  return (
    <section className="settings-page site-page">
      <PageHeader
        description="Управление публичным сайтом и проверка формы онлайн-записи"
        title="Сайт NUAR"
      />

      <section className="panel settings-panel site-launchpad">
        <SiteAdminPanel compact />
      </section>
      {statsPanel}
    </section>
  );
}

export default SitePage;
