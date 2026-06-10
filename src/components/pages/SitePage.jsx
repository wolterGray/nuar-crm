import {ExternalLink, Globe, UploadCloud} from "lucide-react";
import {useState} from "react";
import {getPublicSiteUrl, openSiteAdmin} from "../../utils/openSiteAdmin.js";
import {publishServicesToSite} from "../../utils/siteSync.js";
import {PageNotificationsSlot} from "../PageNotifications.jsx";

function SitePage({services}) {
  const [publishing, setPublishing] = useState(false);
  const [openingAdmin, setOpeningAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handlePublish = async () => {
    setPublishing(true);
    setMessage("");
    setError("");

    try {
      const result = await publishServicesToSite(services);
      setMessage(
        `Цены опубликованы на сайте: ${result.matched} из ${result.total} услуг. Тексты и фото не изменялись.`,
      );
    } catch (publishError) {
      setError(publishError.message ?? "Не удалось опубликовать цены на сайте.");
    } finally {
      setPublishing(false);
    }
  };

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
    <section className="settings-page">
      <div className="employees-toolbar settings-toolbar">
        <div className="title-notifications-flex">
          <div>
            <h2>Сайт NUAR</h2>
            <p>Публикация цен и вход в админку nuarr.pl без отдельного логина</p>
          </div>
          <PageNotificationsSlot />
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <UploadCloud size={18} />
            <div>
              <h2>Опубликовать цены</h2>
              <p>
                Берёт услуги из CRM и обновляет только цены и длительности на сайте.
                Сохранение происходит сразу — отдельная кнопка «Сохранить» не нужна.
                Полный снимок сайта (тексты, фото, отзывы) — в админке: Настройки → «Опубликовать все данные в Supabase».
              </p>
            </div>
          </div>
          <button
            className="add-visit-button"
            disabled={publishing}
            type="button"
            onClick={handlePublish}>
            {publishing ? "Публикуем…" : "Опубликовать цены на сайте"}
          </button>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <Globe size={18} />
            <div>
              <h2>Админка сайта</h2>
              <p>
                Откроет полную CMS (тексты, фото, отзывы) в новой вкладке с вашей
                текущей CRM-сессией.
              </p>
            </div>
          </div>
          <div className="toolbar-actions">
            <button
              className="add-visit-button"
              disabled={openingAdmin}
              type="button"
              onClick={handleOpenAdmin}>
              {openingAdmin ? "Открываем…" : "Открыть админку сайта"}
            </button>
            <a
              className="compact-icon-button"
              href={getPublicSiteUrl()}
              rel="noreferrer"
              target="_blank"
              title="Открыть сайт">
              <ExternalLink size={16} />
            </a>
          </div>
        </section>
      </div>

      {message && (
        <section className="panel settings-panel">
          <p>{message}</p>
        </section>
      )}
      {error && (
        <section className="panel settings-panel">
          <p className="field-error">{error}</p>
        </section>
      )}
    </section>
  );
}

export default SitePage;
