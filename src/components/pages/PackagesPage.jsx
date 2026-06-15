import {Archive, ChevronDown, Gift, Pencil, Plus, Search, Trash2, X} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {motion} from "framer-motion";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
} from "../../utils/clientPackages.js";
import {
  getCertificateBalanceLabel,
  isActiveCertificate,
  isArchivedCertificate,
} from "../../utils/certificates.js";
import {formatMoney} from "../../utils/formatters.jsx";
import {
  getPackageRemainingLabel,
  getPackageUsedVisits,
} from "../../utils/packages.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";

function ClientPackageCard({
  isMobile,
  onDelete,
  onEdit,
  openMenuId,
  packageItem,
  setOpenMenuId,
}) {
  const archived = isArchivedClientPackage(packageItem);

  return (
    <article
      className={`client-package-card${archived ? " is-archived" : ""}${
        isMobile ? " package-mobile-card" : ""
      }`}>
      <div className="package-card-head package-client-head">
        <div className="client-package-main">
          <strong>{packageItem.client}</strong>
          <span>{packageItem.packageName}</span>
          <small>{packageItem.service}</small>
        </div>
        {isMobile ? (
          <RowActionsMenu
            className="package-row-actions"
            itemId={packageItem.id}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(packageItem)}
            onEdit={() => onEdit(packageItem)}
          />
        ) : null}
      </div>
      {isMobile ? (
        <div className="package-client-mobile-body">
          <div className="client-package-progress">
            <div className="package-progress-top">
              <strong>{getPackageRemainingLabel(packageItem)}</strong>
              <span>{archived ? "исп." : "ост."}</span>
            </div>
            <progress
              max={Math.max(Number(packageItem.totalVisits) || 1, 1)}
              value={getPackageUsedVisits(packageItem)}
            />
          </div>
          <div className="client-package-meta">
            <span>{formatMoney(packageItem.price)}</span>
            <b>{packageItem.status}</b>
          </div>
        </div>
      ) : (
        <>
          <div className="client-package-progress">
            <div>
              <span>{archived ? "Использовано сеансов" : "Осталось сеансов"}</span>
              <strong>{getPackageRemainingLabel(packageItem)}</strong>
            </div>
            <progress
              max={Math.max(Number(packageItem.totalVisits) || 1, 1)}
              value={getPackageUsedVisits(packageItem)}
            />
          </div>
          <div className="client-package-meta">
            <span>{formatMoney(packageItem.price)}</span>
            <b>{packageItem.status}</b>
          </div>
        </>
      )}
      {!isMobile ? (
        <div className="employee-actions">
          <button
            aria-label="Редактировать пакет клиента"
            className="compact-icon-button"
            title="Редактировать"
            type="button"
            onClick={() => onEdit(packageItem)}>
            <Pencil size={16} />
          </button>
          <button
            aria-label="Удалить пакет клиента"
            className="compact-icon-button danger"
            title="Удалить"
            type="button"
            onClick={() => onDelete(packageItem)}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function CertificateCard({
  certificate,
  isMobile,
  onDelete,
  onEdit,
  openMenuId,
  setOpenMenuId,
}) {
  const archived = isArchivedCertificate(certificate);

  return (
    <article
      className={`client-package-card certificate-card${archived ? " is-archived" : ""}${
        isMobile ? " package-mobile-card" : ""
      }`}>
      <div className="package-card-head">
        <div className="client-package-main">
          <strong>{certificate.code}</strong>
          <span>{certificate.client || "Без покупателя"}</span>
          <small>
            {certificate.recipient && certificate.recipient !== certificate.client
              ? `Получатель: ${certificate.recipient}`
              : `До ${certificate.expiryDate || "—"}`}
          </small>
        </div>
        {isMobile ? (
          <RowActionsMenu
            className="package-row-actions"
            itemId={certificate.id}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(certificate)}
            onEdit={() => onEdit(certificate)}
          />
        ) : null}
      </div>
      <div className="client-package-progress">
        <div>
          <span>{archived ? "Использовано" : "Остаток"}</span>
          <strong>{getCertificateBalanceLabel(certificate)}</strong>
        </div>
        <progress
          max={Math.max(Number(certificate.nominal) || 1, 1)}
          value={Math.max(
            0,
            Number(certificate.nominal) - Number(certificate.remainingBalance),
          )}
        />
      </div>
      <div className="client-package-meta">
        <span>{certificate.purchaseDate}</span>
        <b>{certificate.status}</b>
      </div>
      {!isMobile ? (
        <div className="employee-actions">
          <button
            aria-label="Редактировать сертификат"
            className="compact-icon-button"
            title="Редактировать"
            type="button"
            onClick={() => onEdit(certificate)}>
            <Pencil size={16} />
          </button>
          <button
            aria-label="Удалить сертификат"
            className="compact-icon-button danger"
            title="Удалить"
            type="button"
            onClick={() => onDelete(certificate)}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function PackageTemplateCard({
  isMobile,
  onDelete,
  onEdit,
  openMenuId,
  packageItem,
  setOpenMenuId,
}) {
  return (
    <motion.article
      animate={{opacity: 1, y: 0}}
      className={`catalog-card catalog-row-card ${
        isMobile ? "package-template-mobile-card" : ""
      }`}
      initial={{opacity: 0, y: 6}}
      key={packageItem.id}>
      <div className="package-card-head package-template-head">
        <div className="package-template-copy">
          <h3>{packageItem.name}</h3>
          <span>{packageItem.service}</span>
        </div>
        {isMobile ? (
          <RowActionsMenu
            className="package-row-actions"
            itemId={packageItem.id}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(packageItem)}
            onEdit={() => onEdit(packageItem)}
          />
        ) : null}
      </div>
      <div className="catalog-prices">
        <span>
          {isMobile ? (
            <>
              <strong>{packageItem.visitsCount}</strong> виз.
            </>
          ) : (
            <>
              Визитов <strong>{packageItem.visitsCount}</strong>
            </>
          )}
        </span>
        <span>
          {isMobile ? (
            <strong>{formatMoney(packageItem.price)}</strong>
          ) : (
            <>
              Стоимость <strong>{formatMoney(packageItem.price)}</strong>
            </>
          )}
        </span>
        <span>
          {isMobile ? (
            <>
              <strong>{packageItem.validityDays}</strong> дн.
            </>
          ) : (
            <>
              Срок <strong>{packageItem.validityDays} дней</strong>
            </>
          )}
        </span>
        <span>
          {isMobile ? (
            <strong>{packageItem.status}</strong>
          ) : (
            <>
              Статус <strong>{packageItem.status}</strong>
            </>
          )}
        </span>
      </div>
      {!isMobile ? (
        <div className="employee-actions">
          <button
            aria-label="Редактировать шаблон пакета"
            className="compact-icon-button"
            title="Редактировать"
            type="button"
            onClick={() => onEdit(packageItem)}>
            <Pencil size={16} />
          </button>
          <button
            aria-label="Удалить шаблон пакета"
            className="compact-icon-button danger"
            title="Удалить"
            type="button"
            onClick={() => onDelete(packageItem)}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </motion.article>
  );
}

function PackagesPage({
  packages,
  clientPackages,
  certificates,
  certificateSalesIncome,
  onAdd,
  onEdit,
  onDelete,
  packageSalesIncome,
  onSellPackage,
  onSellCertificate,
  onEditClientPackage,
  onDeleteClientPackage,
  onEditCertificate,
  onDeleteCertificate,
}) {
  const {isMobile} = useBreakpoint();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [certificateArchiveOpen, setCertificateArchiveOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("clientPackages");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const activeClientPackages = useMemo(
    () => clientPackages.filter(isActiveClientPackage),
    [clientPackages],
  );
  const archivedClientPackages = useMemo(
    () => clientPackages.filter(isArchivedClientPackage),
    [clientPackages],
  );
  const activeCertificates = useMemo(
    () => certificates.filter(isActiveCertificate),
    [certificates],
  );
  const archivedCertificates = useMemo(
    () => certificates.filter(isArchivedCertificate),
    [certificates],
  );
  const remainingVisits = activeClientPackages.reduce(
    (sum, packageItem) => sum + (Number(packageItem.remainingVisits) || 0),
    0,
  );
  const activeCertificateBalance = activeCertificates.reduce(
    (sum, certificate) => sum + (Number(certificate.remainingBalance) || 0),
    0,
  );

  const filterByQuery = (values, fields) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return values;
    }

    return values.filter((item) =>
      fields
        .map((field) => String(item[field] ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  };

  const filteredActiveCertificates = useMemo(
    () =>
      filterByQuery(activeCertificates, [
        "code",
        "client",
        "recipient",
        "status",
        "purchaseDate",
      ]),
    [activeCertificates, search],
  );
  const filteredArchivedCertificates = useMemo(
    () =>
      filterByQuery(archivedCertificates, [
        "code",
        "client",
        "recipient",
        "status",
      ]),
    [archivedCertificates, search],
  );
  const filteredActiveClientPackages = useMemo(
    () =>
      filterByQuery(activeClientPackages, [
        "client",
        "packageName",
        "service",
        "status",
      ]),
    [activeClientPackages, search],
  );
  const filteredArchivedClientPackages = useMemo(
    () =>
      filterByQuery(archivedClientPackages, [
        "client",
        "packageName",
        "service",
        "status",
      ]),
    [archivedClientPackages, search],
  );
  const filteredTemplates = useMemo(
    () =>
      filterByQuery(packages, ["name", "service", "status"]).filter((item) => {
        const query = search.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return [String(item.visitsCount), String(item.price), String(item.validityDays)]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [packages, search],
  );

  useEffect(() => {
    setOpenMenuId(null);
  }, [mobileSection, search]);

  const mobileDescription =
    mobileSection === "clientPackages"
      ? `${filteredActiveClientPackages.length} активных пакетов`
      : mobileSection === "templates"
        ? `${filteredTemplates.length} из ${packages.length} шаблонов`
        : `${filteredActiveCertificates.length} активных сертификатов`;

  return (
    <section
      className={`catalog-page packages-page ${
        isMobile ? "packages-page-mobile" : ""
      }`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        collapsedMeta={mobileDescription}
        collapsible={isMobile}
        defaultExpanded={!isMobile}
        actions={
          isMobile ? (
            <>
              <div className="packages-page-tabs">
                <button
                  className={mobileSection === "clientPackages" ? "active" : ""}
                  type="button"
                  onClick={() => setMobileSection("clientPackages")}>
                  Пакеты
                </button>
                <button
                  className={mobileSection === "templates" ? "active" : ""}
                  type="button"
                  onClick={() => setMobileSection("templates")}>
                  Шаблоны
                </button>
                <button
                  className={mobileSection === "certificates" ? "active" : ""}
                  type="button"
                  onClick={() => setMobileSection("certificates")}>
                  Сертификаты
                </button>
              </div>
              <label className="packages-search">
                <Search size={16} />
                <input
                  placeholder={
                    mobileSection === "clientPackages"
                      ? "Поиск пакета клиента"
                      : mobileSection === "templates"
                        ? "Поиск шаблона"
                        : "Поиск сертификата"
                  }
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setOpenMenuId(null);
                  }}
                />
                {search ? (
                  <button
                    aria-label="Очистить поиск"
                    type="button"
                    onClick={() => setSearch("")}>
                    <X size={15} />
                  </button>
                ) : null}
              </label>
              <div className="packages-summary">
                <article
                  className={`packages-summary-card${
                    mobileSection === "certificates" ? " is-active" : ""
                  }`}>
                  <span>Сертификаты</span>
                  <strong>{activeCertificates.length}</strong>
                </article>
                <article
                  className={`packages-summary-card${
                    mobileSection === "clientPackages" ? " is-active" : ""
                  }`}>
                  <span>Пакеты</span>
                  <strong>{activeClientPackages.length}</strong>
                </article>
                <article
                  className={`packages-summary-card${
                    mobileSection === "templates" ? " is-active" : ""
                  }`}>
                  <span>Шаблоны</span>
                  <strong>{packages.length}</strong>
                </article>
                <article className="packages-summary-card">
                  <span>Сеансов</span>
                  <strong>{remainingVisits}</strong>
                </article>
              </div>
              {mobileSection === "clientPackages" ? (
                <button
                  className="add-visit-button"
                  type="button"
                  onClick={onSellPackage}>
                  <Plus size={18} />
                  Продать пакет
                </button>
              ) : null}
              {mobileSection === "templates" ? (
                <button className="add-visit-button" type="button" onClick={onAdd}>
                  <Plus size={18} />
                  Добавить пакет
                </button>
              ) : null}
              {mobileSection === "certificates" ? (
                <button
                  className="add-visit-button"
                  type="button"
                  onClick={onSellCertificate}>
                  <Gift size={18} />
                  Продать сертификат
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={onSellCertificate}>
                <Gift size={18} />
                Продать сертификат
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={onSellPackage}>
                <Plus size={18} />
                Продать пакет
              </button>
              <button className="add-visit-button" type="button" onClick={onAdd}>
                <Plus size={18} />
                Добавить пакет
              </button>
            </>
          )
        }
        description={
          isMobile
            ? mobileDescription
            : `${packages.length} шаблонов · ${activeClientPackages.length} активных пакетов · ${activeCertificates.length} активных сертификатов`
        }
        title="Пакеты"
      />

      {!isMobile ? (
        <div className="package-summary-grid">
          <article className="catalog-card">
            <span>Пакетов продано</span>
            <h3>{clientPackages.length}</h3>
          </article>
          <article className="catalog-card">
            <span>Доход от пакетов</span>
            <h3>{formatMoney(packageSalesIncome)}</h3>
          </article>
          <article className="catalog-card">
            <span>Сертификатов продано</span>
            <h3>{certificates.length}</h3>
          </article>
          <article className="catalog-card">
            <span>Доход от сертификатов</span>
            <h3>{formatMoney(certificateSalesIncome)}</h3>
          </article>
          <article className="catalog-card">
            <span>Активный остаток сертификатов</span>
            <h3>{formatMoney(activeCertificateBalance)}</h3>
          </article>
          <article className="catalog-card">
            <span>Осталось визитов в пакетах</span>
            <h3>{remainingVisits}</h3>
          </article>
        </div>
      ) : null}

      <div className="packages-grid">
        <div
          className={`panel client-packages-panel packages-panel packages-panel-client-packages ${
            isMobile && mobileSection !== "clientPackages"
              ? "packages-panel-hidden-mobile"
              : ""
          }`}>
          <div className="panel-header">
            <h2>Активные пакеты клиентов</h2>
            <span>{activeClientPackages.length}</span>
          </div>
          <div className="packages-scroll client-packages-list">
            {filteredActiveClientPackages.map((packageItem) => (
              <ClientPackageCard
                key={packageItem.id}
                isMobile={isMobile}
                openMenuId={openMenuId}
                packageItem={packageItem}
                setOpenMenuId={setOpenMenuId}
                onDelete={onDeleteClientPackage}
                onEdit={onEditClientPackage}
              />
            ))}
            {filteredActiveClientPackages.length === 0 && (
              <div className="clients-empty">
                <strong>
                  {search.trim() ? "Пакеты не найдены" : "Активных пакетов нет"}
                </strong>
                <span>
                  {search.trim()
                    ? "Попробуйте изменить запрос."
                    : "Продайте пакет клиенту или верните нужный пакет из архива."}
                </span>
              </div>
            )}
          </div>

          {archivedClientPackages.length > 0 ? (
            <div className="client-packages-archive-panel">
              <button
                className="client-packages-archive-toggle"
                type="button"
                onClick={() => setArchiveOpen((current) => !current)}>
                <span>
                  <Archive size={16} />
                  Архив завершённых пакетов
                </span>
                <strong>{archivedClientPackages.length}</strong>
                <ChevronDown className={archiveOpen ? "open" : ""} size={16} />
              </button>
              {archiveOpen ? (
                <div className="client-packages-list client-packages-archive-list">
                  {filteredArchivedClientPackages.map((packageItem) => (
                    <ClientPackageCard
                      key={packageItem.id}
                      isMobile={isMobile}
                      openMenuId={openMenuId}
                      packageItem={packageItem}
                      setOpenMenuId={setOpenMenuId}
                      onDelete={onDeleteClientPackage}
                      onEdit={onEditClientPackage}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={`packages-panel packages-panel-templates ${
            isMobile && mobileSection !== "templates"
              ? "packages-panel-hidden-mobile"
              : ""
          }`}>
          <h2 className="catalog-section-heading">Шаблоны пакетов</h2>
          <div className="packages-scroll catalog-grid packages-templates-grid">
            {filteredTemplates.length === 0 ? (
              <div className="clients-empty">
                <strong>
                  {search.trim() ? "Шаблоны не найдены" : "Шаблонов пока нет"}
                </strong>
                <span>
                  {search.trim()
                    ? "Попробуйте изменить запрос."
                    : "Добавьте первый шаблон пакета в каталог."}
                </span>
              </div>
            ) : (
              filteredTemplates.map((packageItem) => (
                <PackageTemplateCard
                  key={packageItem.id}
                  isMobile={isMobile}
                  openMenuId={openMenuId}
                  packageItem={packageItem}
                  setOpenMenuId={setOpenMenuId}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        </div>

        <div
          className={`panel client-packages-panel packages-panel packages-panel-certificates ${
            isMobile && mobileSection !== "certificates"
              ? "packages-panel-hidden-mobile"
              : ""
          }`}>
          <div className="panel-header">
            <h2>Активные сертификаты</h2>
            <span>{activeCertificates.length}</span>
          </div>
          <div className="packages-scroll client-packages-list">
            {filteredActiveCertificates.map((certificate) => (
              <CertificateCard
                key={certificate.id}
                certificate={certificate}
                isMobile={isMobile}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onDelete={onDeleteCertificate}
                onEdit={onEditCertificate}
              />
            ))}
            {filteredActiveCertificates.length === 0 && (
              <div className="clients-empty">
                <strong>
                  {search.trim()
                    ? "Сертификаты не найдены"
                    : "Активных сертификатов нет"}
                </strong>
                <span>
                  {search.trim()
                    ? "Попробуйте изменить запрос."
                    : "Продайте сертификат клиенту — код, номинал и остаток будут отслеживаться автоматически."}
                </span>
              </div>
            )}
          </div>

          {archivedCertificates.length > 0 ? (
            <div className="client-packages-archive-panel">
              <button
                className="client-packages-archive-toggle"
                type="button"
                onClick={() => setCertificateArchiveOpen((current) => !current)}>
                <span>
                  <Archive size={16} />
                  Архив сертификатов
                </span>
                <strong>{archivedCertificates.length}</strong>
                <ChevronDown
                  className={certificateArchiveOpen ? "open" : ""}
                  size={16}
                />
              </button>
              {certificateArchiveOpen ? (
                <div className="client-packages-list client-packages-archive-list">
                  {filteredArchivedCertificates.map((certificate) => (
                    <CertificateCard
                      key={certificate.id}
                      certificate={certificate}
                      isMobile={isMobile}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onDelete={onDeleteCertificate}
                      onEdit={onEditCertificate}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default PackagesPage;
