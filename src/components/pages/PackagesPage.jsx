import {useCallback, useMemo, useState} from "react";
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
import PageHeader from "../ui/PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {Button, EmptyState} from "../ui/index.js";

function ClientPackageCard({
  onDelete,
  onEdit,
  openMenuId,
  packageItem,
  setOpenMenuId,
}) {
  const archived = isArchivedClientPackage(packageItem);

  return (
    <article
      className={`package-card client-package-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top">
        <div className="package-card-copy min-w-0">
          <strong className="text-text-main text-sm font-semibold block leading-tight break-words">{packageItem.client}</strong>
          <span className="text-text-muted text-xs block leading-tight break-words">{packageItem.packageName}</span>
          <span className="text-text-faint text-[10px] block font-medium uppercase tracking-wider leading-tight break-words">{packageItem.service}</span>
        </div>
      </div>

      <div className="package-card-progress">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-text-muted">{archived ? "Использовано" : "Осталось"}</span>
          <strong className="text-text-main font-semibold tabular-nums">{getPackageRemainingLabel(packageItem)}</strong>
        </div>
        <progress
          className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-field [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          max={Math.max(Number(packageItem.totalVisits) || 1, 1)}
          value={getPackageUsedVisits(packageItem)}
        />
      </div>

      <div className="package-card-footer">
        <span className="text-text-muted font-medium">{formatMoney(packageItem.price)}</span>
        <span className={`package-status-pill ${packageItem.status === "Активен" ? "is-active" : ""}`}>
          {packageItem.status}
        </span>
      </div>

      <div className="package-card-actions">
        <RowActionsMenu
          itemId={packageItem.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(packageItem)}
          onEdit={() => onEdit(packageItem)}
        />
      </div>
    </article>
  );
}

function CertificateCard({
  certificate,
  onDelete,
  onEdit,
  openMenuId,
  setOpenMenuId,
}) {
  const archived = isArchivedCertificate(certificate);

  return (
    <article
      className={`package-card certificate-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top">
        <div className="package-card-copy min-w-0">
          <strong className="text-text-main text-sm font-semibold block leading-tight break-words">{certificate.code}</strong>
          <span className="text-text-muted text-xs block leading-tight break-words">{certificate.client || "Без покупателя"}</span>
          <span className="text-text-faint text-[10px] block font-medium mt-0.5 leading-tight break-words">
            {certificate.recipient && certificate.recipient !== certificate.client
              ? `Получатель: ${certificate.recipient}`
              : `До ${certificate.expiryDate || "—"}`}
          </span>
        </div>
      </div>

      <div className="package-card-progress">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-text-muted">{archived ? "Использовано" : "Остаток"}</span>
          <strong className="text-text-main font-semibold tabular-nums">{getCertificateBalanceLabel(certificate)}</strong>
        </div>
        <progress
          className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-field [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          max={Math.max(Number(certificate.nominal) || 1, 1)}
          value={Math.max(
            0,
            Number(certificate.nominal) - Number(certificate.remainingBalance),
          )}
        />
      </div>

      <div className="package-card-footer">
        <span className="text-text-muted font-medium">{certificate.purchaseDate}</span>
        <span className={`package-status-pill ${certificate.status === "Активен" ? "is-active" : ""}`}>
          {certificate.status}
        </span>
      </div>

      <div className="package-card-actions">
        <RowActionsMenu
          itemId={certificate.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(certificate)}
          onEdit={() => onEdit(certificate)}
        />
      </div>
    </article>
  );
}

function PackageTemplateCard({
  onDelete,
  onEdit,
  openMenuId,
  packageItem,
  setOpenMenuId,
}) {
  return (
    <motion.article
      animate={{opacity: 1, y: 0}}
      className="package-card package-template-card"
      initial={{opacity: 0, y: 6}}
      key={packageItem.id}>
      <div className="package-card-top">
        <div className="package-card-copy min-w-0">
          <h3 className="m-0 text-text-main text-sm font-semibold leading-snug break-words">{packageItem.name}</h3>
          <span className="text-text-muted text-xs block leading-tight break-words">{packageItem.service}</span>
        </div>
        <RowActionsMenu
          itemId={packageItem.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(packageItem)}
          onEdit={() => onEdit(packageItem)}
        />
      </div>

      <div className="package-template-meta">
        <div>
          <span>Визитов</span>
          <strong>{packageItem.visitsCount}</strong>
        </div>
        <div>
          <span>Стоимость</span>
          <strong>{formatMoney(packageItem.price)}</strong>
        </div>
        <div>
          <span>Срок</span>
          <strong>{packageItem.validityDays} дн.</strong>
        </div>
        <div>
          <span>Статус</span>
          <strong>{packageItem.status}</strong>
        </div>
      </div>
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
  const [packageTab, setPackageTab] = useState("active");
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

  const filterByQuery = useCallback((values, fields) => {
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
  }, [search]);

  const filteredActiveCertificates = useMemo(
    () =>
      filterByQuery(activeCertificates, [
        "code",
        "client",
        "recipient",
        "status",
        "purchaseDate",
      ]),
    [activeCertificates, filterByQuery],
  );
  const filteredArchivedCertificates = useMemo(
    () =>
      filterByQuery(archivedCertificates, [
        "code",
        "client",
        "recipient",
        "status",
      ]),
    [archivedCertificates, filterByQuery],
  );
  const filteredActiveClientPackages = useMemo(
    () =>
      filterByQuery(activeClientPackages, [
        "client",
        "packageName",
        "service",
        "status",
      ]),
    [activeClientPackages, filterByQuery],
  );
  const filteredArchivedClientPackages = useMemo(
    () =>
      filterByQuery(archivedClientPackages, [
        "client",
        "packageName",
        "service",
        "status",
      ]),
    [archivedClientPackages, filterByQuery],
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
    [filterByQuery, packages, search],
  );

  const archiveCount = archivedClientPackages.length + archivedCertificates.length;
  const activeCount = activeClientPackages.length + activeCertificates.length;
  const tabDescription =
    packageTab === "active"
      ? `${filteredActiveClientPackages.length} пакетов · ${filteredActiveCertificates.length} сертификатов`
      : packageTab === "templates"
        ? `${filteredTemplates.length} из ${packages.length} шаблонов`
        : `${filteredArchivedClientPackages.length} пакетов · ${filteredArchivedCertificates.length} сертификатов`;
  const tabs = [
    {id: "active", label: "Активные", count: activeCount},
    {id: "templates", label: "Шаблоны", count: packages.length},
    {id: "archive", label: "Архив", count: archiveCount},
  ];
  const searchPlaceholder =
    packageTab === "active"
      ? "Поиск активных"
      : packageTab === "templates"
        ? "Поиск шаблона"
        : "Поиск архива";

  return (
    <div
      className={`packages-page ${isMobile ? "packages-page-mobile" : ""}`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        className="packages-page-header"
        collapsedMeta={tabDescription}
        collapsible={isMobile}
        actions={
          <div className="packages-page-toolbar">
            <SearchControl
              className="packages-page-search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenMenuId(null);
              }}
              onClear={() => setSearch("")}
            />
            {packageTab === "active" && (
              <>
                <Button leftIcon="gift" variant="secondary" size="sm" onClick={onSellCertificate}>
                  Продать сертификат
                </Button>
                <Button leftIcon="plus" variant="primary" size="sm" onClick={onSellPackage}>
                  Продать пакет
                </Button>
              </>
            )}
            {packageTab === "templates" && (
              <Button leftIcon="plus" variant="primary" size="sm" onClick={onAdd}>
                Добавить пакет
              </Button>
            )}
          </div>
        }
        description={tabDescription}
        title="Пакеты"
      />

      <div className="packages-page-tabs">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            className={packageTab === tab.id ? "is-active" : ""}
            size="sm"
            variant="ghost"
            onClick={() => {
              setPackageTab(tab.id);
              setOpenMenuId(null);
            }}>
            {tab.label} <span>{tab.count}</span>
          </Button>
        ))}
      </div>

      {/* Desktop stats cards */}
      {!isMobile && (
        <div className="packages-summary-grid">
          {[
            {label: "Пакетов продано", val: clientPackages.length},
            {label: "Доход от пакетов", val: formatMoney(packageSalesIncome)},
            {label: "Сертиф. продано", val: certificates.length},
            {label: "Доход от сертиф.", val: formatMoney(certificateSalesIncome)},
            {label: "Остаток сертиф.", val: formatMoney(activeCertificateBalance)},
            {label: "Визитов в пакетах", val: remainingVisits},
          ].map((item, idx) => (
            <div key={idx} className="packages-summary-card">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{item.label}</span>
              <strong className="text-base font-extrabold text-text-main mt-0.5">{item.val}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="packages-board">
        {packageTab === "active" && (
          <div className="packages-live-row">
            <div className="packages-panel packages-panel-active">
              <div className="packages-panel-header">
                <h2>Активные пакеты</h2>
                <span>{activeClientPackages.length}</span>
              </div>
              <div className="packages-list">
                {filteredActiveClientPackages.map((packageItem) => (
                  <ClientPackageCard
                    key={packageItem.id}
                    onDelete={onDeleteClientPackage}
                    onEdit={onEditClientPackage}
                    openMenuId={openMenuId}
                    packageItem={packageItem}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
                {filteredActiveClientPackages.length === 0 && (
                  <EmptyState
                    className="packages-empty-state"
                    icon="package"
                    title="Активных пакетов нет"
                  />
                )}
              </div>
            </div>

            <div className="packages-panel packages-panel-certificates">
              <div className="packages-panel-header">
                <h2>Активные сертификаты</h2>
                <span>{activeCertificates.length}</span>
              </div>
              <div className="packages-list">
                {filteredActiveCertificates.map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                    onDelete={onDeleteCertificate}
                    onEdit={onEditCertificate}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
                {filteredActiveCertificates.length === 0 && (
                  <EmptyState
                    className="packages-empty-state"
                    icon="gift"
                    title="Активных сертификатов нет"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {packageTab === "templates" && (
          <div className="packages-panel packages-panel-templates">
            <div className="packages-panel-header">
              <h2>Шаблоны пакетов</h2>
              <span>{packages.length}</span>
            </div>
            <div className="packages-list packages-list-tall">
              {filteredTemplates.map((packageItem) => (
                <PackageTemplateCard
                  key={packageItem.id}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  openMenuId={openMenuId}
                  packageItem={packageItem}
                  setOpenMenuId={setOpenMenuId}
                />
              ))}
              {filteredTemplates.length === 0 && (
                <EmptyState
                  className="packages-empty-state"
                  icon="package"
                  title="Шаблоны не найдены"
                />
              )}
            </div>
          </div>
        )}

        {packageTab === "archive" && (
          <div className="packages-live-row">
            <div className="packages-panel packages-panel-active">
              <div className="packages-panel-header">
                <h2>Архив пакетов</h2>
                <span>{archivedClientPackages.length}</span>
              </div>
              <div className="packages-list">
                {filteredArchivedClientPackages.map((packageItem) => (
                  <ClientPackageCard
                    key={packageItem.id}
                    onDelete={onDeleteClientPackage}
                    onEdit={onEditClientPackage}
                    openMenuId={openMenuId}
                    packageItem={packageItem}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
                {filteredArchivedClientPackages.length === 0 && (
                  <EmptyState
                    className="packages-empty-state"
                    icon="package"
                    title="Архив пакетов пуст"
                  />
                )}
              </div>
            </div>

            <div className="packages-panel packages-panel-certificates">
              <div className="packages-panel-header">
                <h2>Архив сертификатов</h2>
                <span>{archivedCertificates.length}</span>
              </div>
              <div className="packages-list">
                {filteredArchivedCertificates.map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                    onDelete={onDeleteCertificate}
                    onEdit={onEditCertificate}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
                {filteredArchivedCertificates.length === 0 && (
                  <EmptyState
                    className="packages-empty-state"
                    icon="gift"
                    title="Архив сертификатов пуст"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PackagesPage;
