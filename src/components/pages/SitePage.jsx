import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../ui/PageHeader.jsx";
import SiteAdminPanel from "../SiteAdminPanel.jsx";
import "./SitePage.css";

function SitePage() {
  const {isMobile} = useBreakpoint();

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
    </section>
  );
}

export default SitePage;
