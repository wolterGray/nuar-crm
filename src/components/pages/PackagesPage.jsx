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
import {AppIcon, Button, EmptyState} from "../ui/index.js";
import "./PackagesPage.css";

function getClientPackageDisplay(item, packages = [], clients = []) {
  if (!item) return {client: "Клиент", packageName: "Пакет услуг", service: "", price: 0};
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

  return {client: clientName, packageName, service, price};
}

function getCertificateDisplay(cert, clients = []) {
  if (!cert) return {client: "Без покупателя", recipient: "", nominal: 0, balance: 0};
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

  return {client: clientName, recipient: recipientName, nominal, balance};
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

  const totalVisits = Math.max(Number(packageItem.totalVisits) || 1, 1);
  const usedVisits = getPackageUsedVisits(packageItem);
  const percentUsed = Math.min(100, Math.max(0, Math.round((usedVisits / totalVisits) * 100)));

  return (
    <article className={`package-card client-package-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top">
        <div className="package-card-copy">
          <strong className="package-card-client-name" title={display.client}>
            {display.client}
          </strong>
          <span className="package-card-pkg-name">
            {display.packageName}
          </span>
          {display.service ? (
            <span className="package-service-tag">
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

      <div className="package-card-progress">
        <div className="package-card-progress-header">
          <span className="package-card-progress-label">
            <AppIcon name="calendar" size="xs" />
            <span>{archived ? "Использовано" : "Осталось визитов"}</span>
          </span>
          <span className="package-card-progress-counter">{progressLabel}</span>
        </div>
        <div className="package-card-progress-track" role="progressbar" aria-valuenow={percentUsed} aria-valuemin="0" aria-valuemax="100">
          <div
            className="package-card-progress-fill"
            style={{width: `${percentUsed}%`}}
          />
        </div>
      </div>

      <div className="package-card-footer">
        <div className="package-card-cost-block">
          <span className="package-card-cost-label">Стоимость</span>
          <strong className="package-card-price">{formatMoney(display.price)}</strong>
        </div>
        <span className={`package-status-pill ${packageItem.status === "Активен" ? "is-active" : ""}`}>
          {packageItem.status || "Активен"}
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

  const safeNominal = Math.max(Number(nominal) || 1, 1);
  const usedAmount = Math.max(0, safeNominal - Number(remainingBalance));
  const percentUsed = Math.min(100, Math.max(0, Math.round((usedAmount / safeNominal) * 100)));

  return (
    <article className={`package-card certificate-card ${archived ? "is-archived" : ""}`}>
      <div className="package-card-top">
        <div className="package-card-copy">
          <strong className="package-card-client-name" title={certificate.code || "Сертификат"}>
            <AppIcon name="gift" size="xs" className="cert-code-icon" />
            <span>{certificate.code || "Сертификат"}</span>
          </strong>
          <span className="package-card-pkg-name">
            Покупатель: {display.client}
          </span>
          {display.recipient && display.recipient !== display.client ? (
            <span className="package-recipient-tag">
              Получатель: {display.recipient}
            </span>
          ) : (
            <span className="package-expiry-tag">
              До {certificate.expiryDate || "—"}
            </span>
          )}
        </div>
        <RowActionsMenu
          itemId={certificate.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete?.(resolvedCert)}
          onEdit={() => onEdit?.(resolvedCert)}
        />
      </div>

      <div className="package-card-progress">
        <div className="package-card-progress-header">
          <span className="package-card-progress-label">
            <AppIcon name="creditCard" size="xs" />
            <span>{archived ? "Использовано" : "Остаток баланса"}</span>
          </span>
          <span className="package-card-progress-counter">{getCertificateBalanceLabel(certificate)}</span>
        </div>
        <div className="package-card-progress-track" role="progressbar" aria-valuenow={percentUsed} aria-valuemin="0" aria-valuemax="100">
          <div
            className="package-card-progress-fill"
            style={{width: `${percentUsed}%`}}
          />
        </div>
      </div>

      <div className="package-card-footer">
        <div className="package-card-cost-block">
          <span className="package-card-cost-label">Номинал</span>
          <strong className="package-card-price">{formatMoney(nominal)}</strong>
        </div>
        <span className={`package-status-pill ${certificate.status === "Активен" ? "is-active" : ""}`}>
          {certificate.status || "Активен"}
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
      className="package-card package-template-card"
      initial={{opacity: 0, y: 6}}
      key={packageItem.id}>
      <div className="package-card-top">
        <div className="package-card-copy">
          <strong className="package-card-client-name">
            {packageItem.name}
          </strong>
          {packageItem.service ? (
            <span className="package-service-tag">
              {packageItem.service}
            </span>
          ) : (
            <span className="package-card-pkg-name">Общая услуга</span>
          )}
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
          <strong>{packageItem.status || "Активен"}</strong>
        </div>
      </div>
    </motion.article>
  );
}

function PackagesKpiGrid({
  clientPackagesCount,
  packageSalesIncome,
  certificatesCount,
  certificateSalesIncome,
  activeCertificateBalance,
  remainingVisits,
  isMobile,
}) {
  const stats = [
    {
      label: "Пакетов продано",
      val: clientPackagesCount,
      icon: "package",
      tone: "accent",
    },
    {
      label: "Доход от пакетов",
      val: formatMoney(packageSalesIncome),
      icon: "banknote",
      tone: "success",
    },
    {
      label: "Сертиф. продано",
      val: certificatesCount,
      icon: "gift",
      tone: "info",
    },
    {
      label: "Доход от сертиф.",
      val: formatMoney(certificateSalesIncome),
      icon: "wallet",
      tone: "success",
    },
    {
      label: "Остаток сертиф.",
      val: formatMoney(activeCertificateBalance),
      icon: "sparkles",
      tone: "warning",
    },
    {
      label: "Визитов в пакетах",
      val: remainingVisits,
      icon: "calendarClock",
      tone: "cyan",
    },
  ];

  return (
    <div className={`packages-summary-grid ${isMobile ? "is-mobile" : ""}`}>
      {stats.map((item, idx) => (
        <div key={idx} className="packages-summary-card" data-tone={item.tone}>
          <div className="packages-summary-icon">
            <AppIcon name={item.icon} size="sm" />
          </div>
          <div className="packages-summary-copy">
            <span className="packages-summary-label">{item.label}</span>
            <strong className="packages-summary-value">{item.val}</strong>
          </div>
        </div>
      ))}
    </div>
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
  const [packageTab, setPackageTab] = useState("active"); // "active" | "templates" | "archive"
  const [subFilter, setSubFilter] = useState("all"); // "all" | "packages" | "certificates"
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
      ? "Поиск по клиенту, пакету или коду..."
      : packageTab === "templates"
        ? "Поиск по шаблонам..."
        : "Поиск в архиве...";

  // Top action buttons for desktop header
  const desktopHeaderActions = (
    <div className="packages-desktop-header-actions">
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
          Добавить шаблон
        </Button>
      )}
    </div>
  );

  // Mobile header action buttons
  const mobileHeaderActions = (
    <div className="packages-mobile-actions-row">
      {packageTab === "active" && (
        <div className="packages-mobile-actions-grid">
          <Button leftIcon="gift" variant="secondary" size="md" fullWidth onClick={onSellCertificate}>
            Сертификат
          </Button>
          <Button leftIcon="plus" variant="primary" size="md" fullWidth onClick={onSellPackage}>
            Пакет
          </Button>
        </div>
      )}
      {packageTab === "templates" && (
        <Button leftIcon="plus" variant="primary" size="md" fullWidth onClick={onAdd}>
          Добавить шаблон пакета
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={`packages-page ${isMobile ? "packages-page-mobile" : ""} nuar-packages`}
      onClick={() => setOpenMenuId(null)}>
      {/* 1. Page Header */}
      <PageHeader
        className="packages-page-header"
        headerActions={isMobile ? null : desktopHeaderActions}
        actions={isMobile ? mobileHeaderActions : null}
        description={tabDescription}
        title={
          <span className="packages-title-row">
            <span>Пакеты</span>
            <span className="packages-title-count">
              ({packageTab === "active" ? activeCount : packageTab === "templates" ? packages.length : archiveCount})
            </span>
          </span>
        }
      />

      {/* 2. Top Controls Bar: Tabs, View Filter & Search */}
      <div className="packages-controls-bar">
        <div className="packages-nav-group">
          {/* Main Segmented Tabs */}
          <div className="packages-page-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={packageTab === tab.id}
                className={`packages-tab-btn ${packageTab === tab.id ? "is-active" : ""}`}
                type="button"
                onClick={() => {
                  setPackageTab(tab.id);
                  setSubFilter("all");
                  setOpenMenuId(null);
                }}>
                <span>{tab.label}</span>
                <span className="packages-tab-badge">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Sub-view Filter (For Active and Archive) */}
          {(packageTab === "active" || packageTab === "archive") && (
            <div className="packages-subfilter-group" role="group" aria-label="Фильтр элементов">
              <button
                type="button"
                className={`packages-subfilter-btn ${subFilter === "all" ? "is-active" : ""}`}
                onClick={() => setSubFilter("all")}>
                Все
              </button>
              <button
                type="button"
                className={`packages-subfilter-btn ${subFilter === "packages" ? "is-active" : ""}`}
                onClick={() => setSubFilter("packages")}>
                Пакеты ({packageTab === "active" ? filteredActiveClientPackages.length : filteredArchivedClientPackages.length})
              </button>
              <button
                type="button"
                className={`packages-subfilter-btn ${subFilter === "certificates" ? "is-active" : ""}`}
                onClick={() => setSubFilter("certificates")}>
                Сертификаты ({packageTab === "active" ? filteredActiveCertificates.length : filteredArchivedCertificates.length})
              </button>
            </div>
          )}
        </div>

        {/* Search Control */}
        <div className="packages-search-wrap">
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
        </div>
      </div>

      {/* 3. KPI Metrics Summary Cards */}
      <PackagesKpiGrid
        clientPackagesCount={clientPackages.length}
        packageSalesIncome={packageSalesIncome}
        certificatesCount={certificates.length}
        certificateSalesIncome={certificateSalesIncome}
        activeCertificateBalance={activeCertificateBalance}
        remainingVisits={remainingVisits}
        isMobile={isMobile}
      />

      {/* 4. Main Board Content */}
      <div className="packages-board">
        {/* Active Tab */}
        {packageTab === "active" && (
          <div className={`packages-live-row ${subFilter !== "all" ? "is-single-column" : ""}`}>
            {/* Active Packages Column */}
            {(subFilter === "all" || subFilter === "packages") && (
              <section className="packages-panel packages-panel-active" aria-label="Активные пакеты">
                <div className="packages-panel-header">
                  <div className="packages-panel-title-wrap">
                    <AppIcon name="package" size="sm" className="panel-title-icon" />
                    <h2>Активные пакеты</h2>
                  </div>
                  <span className="packages-panel-count">{filteredActiveClientPackages.length}</span>
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
                      title={search.trim() ? "Пакеты не найдены" : "Активных пакетов нет"}
                      description={search.trim() ? "Попробуйте изменить поисковый запрос" : "Клиенты пока не приобрели абонементы"}
                      actionLabel={search.trim() ? "Очистить поиск" : "Продать пакет"}
                      onAction={search.trim() ? () => setSearch("") : onSellPackage}
                    />
                  )}
                </div>
              </section>
            )}

            {/* Active Certificates Column */}
            {(subFilter === "all" || subFilter === "certificates") && (
              <section className="packages-panel packages-panel-certificates" aria-label="Активные сертификаты">
                <div className="packages-panel-header">
                  <div className="packages-panel-title-wrap">
                    <AppIcon name="gift" size="sm" className="panel-title-icon" />
                    <h2>Активные сертификаты</h2>
                  </div>
                  <span className="packages-panel-count">{filteredActiveCertificates.length}</span>
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
                      title={search.trim() ? "Сертификаты не найдены" : "Активных сертификатов нет"}
                      description={search.trim() ? "Попробуйте изменить поисковый запрос" : "Оформите подарочный сертификат для клиента"}
                      actionLabel={search.trim() ? "Очистить поиск" : "Продать сертификат"}
                      onAction={search.trim() ? () => setSearch("") : onSellCertificate}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {packageTab === "templates" && (
          <section className="packages-panel packages-panel-templates" aria-label="Шаблоны пакетов">
            <div className="packages-panel-header">
              <div className="packages-panel-title-wrap">
                <AppIcon name="package" size="sm" className="panel-title-icon" />
                <h2>Шаблоны пакетов услуг</h2>
              </div>
              <span className="packages-panel-count">{filteredTemplates.length}</span>
            </div>
            <div className="packages-list packages-templates-grid">
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
                  title={search.trim() ? "Шаблоны не найдены" : "Шаблонов ещё нет"}
                  description={search.trim() ? "Попробуйте изменить поисковый запрос" : "Создайте шаблон пакета услуг для быстрой продажи в CRM"}
                  actionLabel={search.trim() ? "Очистить поиск" : "Создать шаблон"}
                  onAction={search.trim() ? () => setSearch("") : onAdd}
                />
              )}
            </div>
          </section>
        )}

        {/* Archive Tab */}
        {packageTab === "archive" && (
          <div className={`packages-live-row ${subFilter !== "all" ? "is-single-column" : ""}`}>
            {/* Archived Packages */}
            {(subFilter === "all" || subFilter === "packages") && (
              <section className="packages-panel packages-panel-active" aria-label="Архив пакетов">
                <div className="packages-panel-header">
                  <div className="packages-panel-title-wrap">
                    <AppIcon name="package" size="sm" className="panel-title-icon" />
                    <h2>Архив пакетов</h2>
                  </div>
                  <span className="packages-panel-count">{filteredArchivedClientPackages.length}</span>
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
                      description="Использованные и закрытые абонементы будут отображаться здесь"
                    />
                  )}
                </div>
              </section>
            )}

            {/* Archived Certificates */}
            {(subFilter === "all" || subFilter === "certificates") && (
              <section className="packages-panel packages-panel-certificates" aria-label="Архив сертификатов">
                <div className="packages-panel-header">
                  <div className="packages-panel-title-wrap">
                    <AppIcon name="gift" size="sm" className="panel-title-icon" />
                    <h2>Архив сертификатов</h2>
                  </div>
                  <span className="packages-panel-count">{filteredArchivedCertificates.length}</span>
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
                      description="Погашенные и истёкшие сертификаты будут сохраняться здесь"
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PackagesPage;
