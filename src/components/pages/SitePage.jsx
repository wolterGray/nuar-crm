import PageHeader from "../PageHeader.jsx";
import SiteAdminPanel from "../SiteAdminPanel.jsx";

function SitePage() {
  return (
    <section className="settings-page">
      <PageHeader
        description="Цены и длительности услуг обновляются на сайте автоматически при изменении в CRM."
        title="Сайт NUAR"
      />

      <div className="settings-grid">
        <section className="panel settings-panel">
          <SiteAdminPanel />
        </section>
      </div>
    </section>
  );
}

export default SitePage;
