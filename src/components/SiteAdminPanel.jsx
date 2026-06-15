import {ExternalLink, Globe} from "lucide-react";
import {useState} from "react";
import {getPublicSiteUrl, openSiteAdmin} from "../utils/openSiteAdmin.js";

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
          <Globe size={18} />
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
        <button
          className="add-visit-button"
          disabled={openingAdmin}
          type="button"
          onClick={handleOpenAdmin}>
          {openingAdmin ? "Открываем…" : "Открыть админку сайта"}
        </button>
        <a
          className={embeddedMobile ? "secondary-button" : "compact-icon-button"}
          href={getPublicSiteUrl()}
          rel="noreferrer"
          target="_blank"
          title="Открыть сайт">
          <ExternalLink size={16} />
          {embeddedMobile ? "Открыть nuarr.pl" : null}
        </a>
      </div>
      {message ? <p className="settings-inline-note">{message}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </>
  );
}
