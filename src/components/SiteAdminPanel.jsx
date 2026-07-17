import {useState} from "react";
import {getPublicSiteUrl, openSiteAdmin} from "../utils/openSiteAdmin.js";
import {AppIcon, Button} from "./ui/index.js";

export default function SiteAdminPanel({compact = false, embeddedMobile = false}) {
  const [openingAdmin, setOpeningAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleOpenAdmin = async () => {
    setOpeningAdmin(true);
    setError("");

    try {
      await openSiteAdmin("/admin");
      setMessage("Админка сайта открыта в новой вкладке — повторный вход не нужен.");
    } catch (openError) {
      setError(openError.message ?? "Не удалось открыть админку сайта.");
    } finally {
      setOpeningAdmin(false);
    }
  };

  return (
    <>
      {!embeddedMobile ? (
        <div className="settings-panel-heading">
          <AppIcon name="globe" size="md" />
          <div>
            <h2>Сайт NUAR</h2>
            <p>
              {compact
                ? "CMS сайта и публичная страница nuarr.pl"
                : "Цены и длительности услуг обновляются на сайте автоматически при изменении в CRM. В админке — только фото, тексты и остальной контент."}
            </p>
          </div>
        </div>
      ) : null}
      <div
        className={`toolbar-actions${
          embeddedMobile ? " site-admin-mobile-actions" : ""
        }`}>
        <Button
          className="add-visit-button"
          disabled={openingAdmin}
          type="button"
          variant="primary"
          onClick={handleOpenAdmin}>
          {openingAdmin ? "Открываем…" : "Открыть админку сайта"}
        </Button>
        <a
          className={embeddedMobile ? "secondary-button" : "compact-icon-button"}
          href={getPublicSiteUrl()}
          rel="noreferrer"
          target="_blank"
          title="Открыть сайт">
          <AppIcon name="external" size="sm" />
          {embeddedMobile ? "Открыть nuarr.pl" : null}
        </a>
      </div>
      {message ? <p className="settings-inline-note">{message}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </>
  );
}
