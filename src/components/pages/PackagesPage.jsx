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
  getPackageUsedLabel,
  getPackageUsedVisits,
} from "../../utils/packages.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import PageHeader from "../ui/PageHeader.jsx";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {Button, EmptyState} from "../ui/index.js";
import "./PackagesPage.css";

function getClientPackageDisplay(item, packages = [], clients = []) {
  if (!item) return { client: "Клиент", packageName: "Пакет услуг", service: "", price: 0 };
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  const linkedPackage = packages.find((p) => String(p.id) === String(item.packageId || payload.packageId));
  const linkedClient = clients.find((c) => String(c.id) === String(item.clientId || payload.clientId));

  const clientName =
    (typeof item.client === "string" && item.client.trim()) ||
    (typeof item.clientName === "string" && item.clientName.trim()) ||
    (typeof item.client_name === "string" && item.client_name.trim()) ||
    (typeof item.customer === "string" && item.customer.trim()) ||
    (typeof item.customerName === "string" && item.customerName.trim()) ||
    (typeof item.client?.name === "string" && item.client.name.trim()) ||
    (typeof payload.client === "string" && payload.client.trim()) ||
    (typeof payload.clientName === "string" && payload.clientName.trim()) ||
    (typeof payload.client_name === "string" && payload.client_name.trim()) ||
    (typeof payload.client?.name === "string" && payload.client.name.trim()) ||
    (typeof linkedClient?.name === "string" && linkedClient.name.trim()) ||
    "Клиент";

  const packageName =
    (typeof item.packageName === "string" && item.packageName.trim()) ||
    (typeof item.package_name === "string" && item.package_name.trim()) ||
    (typeof item.name === "string" && item.name.trim()) ||
    (typeof item.title === "string" && item.title.trim()) ||
    (typeof item.package?.name === "string" && item.package.name.trim()) ||
    (typeof payload.packageName === "string" && payload.packageName.trim()) ||
    (typeof payload.package_name === "string" && payload.package_name.trim()) ||
    (typeof payload.name === "string" && payload.name.trim()) ||
    (typeof payload.package?.name === "string" && payload.package.name.trim()) ||
    (typeof linkedPackage?.name === "string" && linkedPackage.name.trim()) ||
    "Пакет услуг";

  const service =
    (typeof item.service === "string" && item.service.trim()) ||
    (typeof item.serviceName === "string" && item.serviceName.trim()) ||
    (typeof item.package?.service === "string" && item.package.service.trim()) ||
    (typeof payload.service === "string" && payload.service.trim()) ||
    (typeof payload.serviceName === "string" && payload.serviceName.trim()) ||
    (typeof linkedPackage?.service === "string" && linkedPackage.service.trim()) ||
    "";

  const price =
    item.price !== undefined && item.price !== null && Number(item.price) > 0
      ? Number(item.price)
      : payload.price !== undefined && payload.price !== null && Number(payload.price) > 0
        ? Number(payload.price)
        : Number(linkedPackage?.price) || Number(item.price) || 0;

  return { client: clientName, packageName, service, price };
}

function getCertificateDisplay(cert, clients = []) {
  if (!cert) return { client: "Без покупателя", recipient: "", nominal: 0, balance: 0 };
  const payload = cert.payload && typeof cert.payload === "object" ? cert.payload : {};
  const linkedClient = clients.find((c) => String(c.id) === String(cert.clientId || payload.clientId));
  const linkedRecipient = clients.find((c) => String(c.id) === String(cert.recipientId || payload.recipientId));

  const clientName =
    (typeof cert.client === "string" && cert.client.trim()) ||
    (typeof cert.clientName === "string" && cert.clientName.trim()) ||
    (typeof cert.client_name === "string" && cert.client_name.trim()) ||
    (typeof cert.buyer === "string" && cert.buyer.trim()) ||
    (typeof cert.client?.name === "string" && cert.client.name.trim()) ||
    (typeof payload.client === "string" && payload.client.trim()) ||
    (typeof payload.clientName === "string" && payload.clientName.trim()) ||
    (typeof linkedClient?.name === "string" && linkedClient.name.trim()) ||
    "Без покупателя";

  const recipientName =
    (typeof cert.recipient === "string" && cert.recipient.trim()) ||
    (typeof cert.recipientName === "string" && cert.recipientName.trim()) ||
    (typeof cert.recipient_name === "string" && cert.recipient_name.trim()) ||
    (typeof cert.recipient?.name === "string" && cert.recipient.name.trim()) ||
    (typeof payload.recipient === "string" && payload.recipient.trim()) ||
    (typeof payload.recipientName === "string" && payload.recipientName.trim()) ||
    (typeof linkedRecipient?.name === "string" && linkedRecipient.name.trim()) ||
    "";

  const nominal = Number(cert.nominal ?? cert.amount ?? payload.nominal ?? payload.amount ?? 0);
  const balance = Number(cert.remainingBalance ?? cert.balance ?? payload.remainingBalance ?? payload.balance ?? nominal);

  return { client: clientName, recipient: recipientName, nominal, balance };
}

function ClientPackageCard({
  clients = [],
  onDelete,
  onEdit,
  openMenuId,
  packageItem,
  packages = [],
  setOpenMenuId,
}) {
  const display = getClientPackageDisplay(packageItem, packages, clients);
  const archived = isArchivedClientPackage(packageItem);
  const progressLabel = archived
    ? getPackageUsedLabel(packageItem)
    : getPackageRemainingLabel(packageItem);

  const resolvedItem = {
    ...packageItem,
    client: display.client,
    clientName: display.client,
    packageName: display.packageName,
    service: display.service,
    price: display.price,
  };

  return (
    <article
      className={`package-card client-package-card nuar-pkg-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top nuar-pkg-card-top">
        <div className="package-card-copy nuar-pkg-card-copy min-w-0">
          <strong className="package-card-client-name text-text-main text-sm font-semibold block leading-tight break-words">
            {display.client}
          </strong>
          <span className="package-card-pkg-name text-text-muted text-xs block leading-tight break-words">
            {display.packageName}
          </span>
          {display.service ? (
            <span className="package-service-tag text-text-faint text-[10px] block font-medium uppercase tracking-wider leading-tight break-words">
              {display.service}
            </span>
          ) : null}
        </div>
        <RowActionsMenu
          itemId={packageItem.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete?.(resolvedItem)}
          onEdit={() => onEdit?.(resolvedItem)}
        />
      </div>

      <div className="package-card-progress nuar-pkg-card-progress">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-text-muted">{archived ? "Использовано" : "Осталось"}</span>
          <strong className="text-text-main font-semibold tabular-nums">{progressLabel}</strong>
        </div>
        <progress
          className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-field [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          max={Math.max(Number(packageItem.totalVisits) || 1, 1)}
          value={getPackageUsedVisits(packageItem)}
        />
      </div>

      <div className="package-card-footer nuar-pkg-card-footer">
        <span className="package-card-price text-text-muted font-medium">{formatMoney(display.price)}</span>
        <span className={`package-status-pill ${packageItem.status === "Активен" ? "is-active" : ""}`}>
          {packageItem.status}
        </span>
      </div>
    </article>
  );
}

function CertificateCard({
  certificate,
  clients = [],
  onDelete,
  onEdit,
  openMenuId,
  setOpenMenuId,
}) {
  const display = getCertificateDisplay(certificate, clients);
  const archived = isArchivedCertificate(certificate);
  const remainingBalance = certificate.remainingBalance !== undefined ? certificate.remainingBalance : display.balance;
  const nominal = certificate.nominal !== undefined ? certificate.nominal : display.nominal;

  const resolvedCert = {
    ...certificate,
    client: display.client,
    clientName: display.client,
    recipient: display.recipient,
    recipientName: display.recipient,
    remainingBalance,
    nominal,
  };

  return (
    <article
      className={`package-card certificate-card nuar-pkg-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top nuar-pkg-card-top">
        <div className="package-card-copy nuar-pkg-card-copy min-w-0">
          <strong className="package-card-client-name text-text-main text-sm font-semibold block leading-tight break-words">
            {certificate.code || "Сертификат"}
          </strong>
          <span className="package-card-pkg-name text-text-muted text-xs block leading-tight break-words">
            Покупатель: {display.client}
          </span>
          <span className="text-text-faint text-[10px] block font-medium mt-0.5 leading-tight break-words">
            {display.recipient && display.recipient !== display.client
              ? `Получатель: ${display.recipient}`
              : `До ${certificate.expiryDate || "—"}`}
          </span>
        </div>
        <RowActionsMenu
          itemId={certificate.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete?.(resolvedCert)}
          onEdit={() => onEdit?.(resolvedCert)}
        />
      </div>

      <div className="package-card-progress nuar-pkg-card-progress">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-text-muted">{archived ? "Использовано" : "Остаток"}</span>
          <strong className="text-text-main font-semibold tabular-nums">{getCertificateBalanceLabel(certificate)}</strong>
        </div>
        <progress
          className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-field [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          max={Math.max(Number(nominal) || 1, 1)}
          value={Math.max(
            0,
            Number(nominal) - Number(remainingBalance),
          )}
        />
      </div>

      <div className="package-card-footer nuar-pkg-card-footer">
        <span className="package-card-price text-text-muted font-medium">{formatMoney(nominal)}</span>
        <span className={`package-status-pill ${certificate.status === "Активен" ? "is-active" : ""}`}>
          {certificate.status}
        </span>
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
      className="package-card package-template-card nuar-pkg-card"
      initial={{opacity: 0, y: 6}}
      key={packageItem.id}>
      <div className="package-card-top nuar-pkg-card-top">
        <div className="package-card-copy nuar-pkg-card-copy min-w-0">
          <strong className="package-card-client-name text-text-main text-sm font-semibold leading-snug break-words">
            {packageItem.name}
          </strong>
          <span className="package-card-pkg-name text-text-muted text-xs block leading-tight break-words">
            {packageItem.service || "Общая услуга"}
          </span>
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
          <span>Визиты</span>
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
  packages = [],
  clientPackages = [],
  clientProfiles = [],
  clients = [],
  certificates = [],
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

  const allClients = useMemo(
    () => (clientProfiles.length ? clientProfiles : clients),
    [clientProfiles, clients],
  );

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

  const enrichedActiveClientPackages = useMemo(
    () =>
      activeClientPackages.map((item) => {
        const d = getClientPackageDisplay(item, packages, allClients);
        return {
          ...item,
          client: d.client,
          clientName: d.client,
          packageName: d.packageName,
          service: d.service,
          price: d.price,
        };
      }),
    [activeClientPackages, allClients, packages],
  );

  const enrichedArchivedClientPackages = useMemo(
    () =>
      archivedClientPackages.map((item) => {
        const d = getClientPackageDisplay(item, packages, allClients);
        return {
          ...item,
          client: d.client,
          clientName: d.client,
          packageName: d.packageName,
          service: d.service,
          price: d.price,
        };
      }),
    [archivedClientPackages, allClients, packages],
  );

  const enrichedActiveCertificates = useMemo(
    () =>
      activeCertificates.map((cert) => {
        const d = getCertificateDisplay(cert, allClients);
        return {
          ...cert,
          client: d.client,
          clientName: d.client,
          recipient: d.recipient,
        };
      }),
    [activeCertificates, allClients],
  );

  const enrichedArchivedCertificates = useMemo(
    () =>
      archivedCertificates.map((cert) => {
        const d = getCertificateDisplay(cert, allClients);
        return {
          ...cert,
          client: d.client,
          clientName: d.client,
          recipient: d.recipient,
        };
      }),
    [archivedCertificates, allClients],
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
      filterByQuery(enrichedActiveCertificates, [
        "code",
        "client",
        "clientName",
        "recipient",
        "status",
        "purchaseDate",
      ]),
    [enrichedActiveCertificates, filterByQuery],
  );
  const filteredArchivedCertificates = useMemo(
    () =>
      filterByQuery(enrichedArchivedCertificates, [
        "code",
        "client",
        "clientName",
        "recipient",
        "status",
      ]),
    [enrichedArchivedCertificates, filterByQuery],
  );
  const filteredActiveClientPackages = useMemo(
    () =>
      filterByQuery(enrichedActiveClientPackages, [
        "client",
        "clientName",
        "packageName",
        "service",
        "status",
      ]),
    [enrichedActiveClientPackages, filterByQuery],
  );
  const filteredArchivedClientPackages = useMemo(
    () =>
      filterByQuery(enrichedArchivedClientPackages, [
        "client",
        "clientName",
        "packageName",
        "service",
        "status",
      ]),
    [enrichedArchivedClientPackages, filterByQuery],
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
      className={`packages-page ${isMobile ? "packages-page-mobile" : ""} nuar-packages`}
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
                    clients={allClients}
                    packages={packages}
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
                    clients={allClients}
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
                    clients={allClients}
                    packages={packages}
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
                    clients={allClients}
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
