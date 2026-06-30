import {Archive, ChevronDown, Gift, Plus} from "lucide-react";
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
import Button from "../ui/Button.jsx";

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
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="grid gap-0.5 min-w-0">
          <strong className="text-text-main text-sm font-semibold truncate block">{packageItem.client}</strong>
          <span className="text-text-muted text-xs truncate block">{packageItem.packageName}</span>
          <span className="text-text-faint text-[10px] truncate block font-medium mt-0.5 uppercase tracking-wider">{packageItem.service}</span>
        </div>
        <RowActionsMenu
          itemId={packageItem.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(packageItem)}
          onEdit={() => onEdit(packageItem)}
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">{archived ? "Использовано" : "Осталось"}</span>
          <strong className="text-text-main font-semibold">{getPackageRemainingLabel(packageItem)}</strong>
        </div>
        <progress
          className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-field [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          max={Math.max(Number(packageItem.totalVisits) || 1, 1)}
          value={getPackageUsedVisits(packageItem)}
        />
      </div>

      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border-soft text-xs">
        <span className="text-text-muted font-medium">{formatMoney(packageItem.price)}</span>
        <span className={`package-status-pill ${packageItem.status === "Активен" ? "is-active" : ""}`}>
          {packageItem.status}
        </span>
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
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="grid gap-0.5 min-w-0">
          <strong className="text-text-main text-sm font-semibold truncate block">{certificate.code}</strong>
          <span className="text-text-muted text-xs truncate block">{certificate.client || "Без покупателя"}</span>
          <span className="text-text-faint text-[10px] truncate block font-medium mt-0.5">
            {certificate.recipient && certificate.recipient !== certificate.client
              ? `Получатель: ${certificate.recipient}`
              : `До ${certificate.expiryDate || "—"}`}
          </span>
        </div>
        <RowActionsMenu
          itemId={certificate.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(certificate)}
          onEdit={() => onEdit(certificate)}
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">{archived ? "Использовано" : "Остаток"}</span>
          <strong className="text-text-main font-semibold">{getCertificateBalanceLabel(certificate)}</strong>
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

      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border-soft text-xs">
        <span className="text-text-muted font-medium">{certificate.purchaseDate}</span>
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
      className="package-card package-template-card"
      initial={{opacity: 0, y: 6}}
      key={packageItem.id}>
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="grid gap-0.5 min-w-0">
          <h3 className="m-0 text-text-main text-sm font-semibold truncate leading-snug">{packageItem.name}</h3>
          <span className="text-text-muted text-xs truncate block">{packageItem.service}</span>
        </div>
        <RowActionsMenu
          itemId={packageItem.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(packageItem)}
          onEdit={() => onEdit(packageItem)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border-soft text-xs text-text-muted">
        <div>Визитов: <strong className="text-text-main font-semibold">{packageItem.visitsCount}</strong></div>
        <div>Стоимость: <strong className="text-text-main font-semibold">{formatMoney(packageItem.price)}</strong></div>
        <div>Срок: <strong className="text-text-main font-semibold">{packageItem.validityDays} дн.</strong></div>
        <div>Статус: <strong className="text-text-main font-semibold">{packageItem.status}</strong></div>
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

  const mobileDescription =
    mobileSection === "clientPackages"
      ? `${filteredActiveClientPackages.length} активных пакетов`
      : mobileSection === "templates"
        ? `${filteredTemplates.length} из ${packages.length} шаблонов`
        : `${filteredActiveCertificates.length} активных сертификатов`;

  return (
    <div
      className={`packages-page ${isMobile ? "packages-page-mobile" : ""}`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        className="packages-page-header"
        collapsedMeta={mobileDescription}
        collapsible={isMobile}
        actions={
          isMobile ? (
            <div className="flex flex-col gap-3 w-full">
              {/* Custom tabs */}
              <div className="flex w-full p-1 bg-field border border-border-soft rounded-lg gap-1">
                {[
                  {id: "clientPackages", label: "Пакеты"},
                  {id: "templates", label: "Шаблоны"},
                  {id: "certificates", label: "Сертификаты"},
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                      mobileSection === tab.id
                        ? "bg-surface text-text-main shadow-xs border border-border"
                        : "text-text-muted hover:text-text-main"
                    }`}
                    type="button"
                    onClick={() => {
                      setMobileSection(tab.id);
                      setOpenMenuId(null);
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <SearchControl
                placeholder={
                  mobileSection === "clientPackages"
                    ? "Поиск пакета клиента"
                    : mobileSection === "templates"
                      ? "Поиск шаблона"
                      : "Поиск сертификата"
                }
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOpenMenuId(null);
                }}
                onClear={() => setSearch("")}
              />

              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  {label: "Сертиф.", val: activeCertificates.length, active: mobileSection === "certificates"},
                  {label: "Пакеты", val: activeClientPackages.length, active: mobileSection === "clientPackages"},
                  {label: "Шаблоны", val: packages.length, active: mobileSection === "templates"},
                  {label: "Сеансы", val: remainingVisits},
                ].map((item, idx) => (
                  <div key={idx} className={`flex flex-col p-2 rounded-card border ${
                    item.active ? "border-accent bg-accent/5" : "border-border bg-surface"
                  }`}>
                    <span className="text-text-muted text-[8px] font-bold tracking-wider uppercase truncate">{item.label}</span>
                    <strong className="text-text-main text-sm font-extrabold mt-0.5">{item.val}</strong>
                  </div>
                ))}
              </div>

              {mobileSection === "clientPackages" && (
                <Button variant="primary" size="sm" onClick={onSellPackage} className="w-full">
                  <Plus size={16} />
                  Продать пакет
                </Button>
              )}
              {mobileSection === "templates" && (
                <Button variant="primary" size="sm" onClick={onAdd} className="w-full">
                  <Plus size={16} />
                  Добавить пакет
                </Button>
              )}
              {mobileSection === "certificates" && (
                <Button variant="primary" size="sm" onClick={onSellCertificate} className="w-full">
                  <Gift size={16} />
                  Продать сертификат
                </Button>
              )}
            </div>
          ) : (
            <div className="packages-page-toolbar">
              <SearchControl
                className="packages-page-search"
                placeholder="Поиск пакета"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOpenMenuId(null);
                }}
                onClear={() => setSearch("")}
              />
              <Button variant="secondary" size="sm" onClick={onSellCertificate}>
                <Gift size={16} />
                Продать сертификат
              </Button>
              <Button variant="secondary" size="sm" onClick={onSellPackage}>
                <Plus size={16} />
                Продать пакет
              </Button>
              <Button variant="primary" size="sm" onClick={onAdd}>
                <Plus size={16} />
                Добавить пакет
              </Button>
            </div>
          )
        }
        description={
          isMobile
            ? mobileDescription
            : `${packages.length} шаблонов · ${activeClientPackages.length} активных пакетов · ${activeCertificates.length} активных сертификатов`
        }
        title="Пакеты"
      />

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

      {/* Main Panels Layout */}
      {isMobile ? (
        <div className="w-full">
          {mobileSection === "clientPackages" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
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
                  <div className="text-center py-8 text-text-muted flex flex-col gap-1 max-w-sm mx-auto">
                    <strong className="text-text-main text-sm">Активных пакетов нет</strong>
                    <span className="text-xs">Продайте пакет клиенту или верните нужный из архива.</span>
                  </div>
                )}
              </div>

              {archivedClientPackages.length > 0 && (
                <div className="mt-2 border border-border rounded-lg bg-surface overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between p-4 text-sm font-semibold text-text-main hover:bg-field transition-colors"
                    type="button"
                    onClick={() => setArchiveOpen(!archiveOpen)}>
                    <span className="flex items-center gap-2">
                      <Archive size={16} className="text-text-muted" />
                      Архив завершённых пакетов ({archivedClientPackages.length})
                    </span>
                    <ChevronDown className={`transition-transform ${archiveOpen ? "rotate-180" : ""}`} size={16} />
                  </button>
                  {archiveOpen && (
                    <div className="p-4 border-t border-border-soft flex flex-col gap-3 bg-field/30">
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
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mobileSection === "templates" && (
            <div className="grid grid-cols-1 gap-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-text-muted flex flex-col gap-1 max-w-sm mx-auto">
                  <strong className="text-text-main text-sm">Шаблоны не найдены</strong>
                  <span className="text-xs">Добавьте первый шаблон пакета в каталог.</span>
                </div>
              ) : (
                filteredTemplates.map((packageItem) => (
                  <PackageTemplateCard
                    key={packageItem.id}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    openMenuId={openMenuId}
                    packageItem={packageItem}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))
              )}
            </div>
          )}

          {mobileSection === "certificates" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
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
                  <div className="text-center py-8 text-text-muted flex flex-col gap-1 max-w-sm mx-auto">
                    <strong className="text-text-main text-sm">Активных сертификатов нет</strong>
                    <span className="text-xs">Продайте сертификат клиенту.</span>
                  </div>
                )}
              </div>

              {archivedCertificates.length > 0 && (
                <div className="mt-2 border border-border rounded-lg bg-surface overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between p-4 text-sm font-semibold text-text-main hover:bg-field transition-colors"
                    type="button"
                    onClick={() => setCertificateArchiveOpen(!certificateArchiveOpen)}>
                    <span className="flex items-center gap-2">
                      <Archive size={16} className="text-text-muted" />
                      Архив сертификатов ({archivedCertificates.length})
                    </span>
                    <ChevronDown className={`transition-transform ${certificateArchiveOpen ? "rotate-180" : ""}`} size={16} />
                  </button>
                  {certificateArchiveOpen && (
                    <div className="p-4 border-t border-border-soft flex flex-col gap-3 bg-field/30">
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
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="packages-board">
          {/* Active Client Packages */}
          <div className="packages-panel packages-panel-active">
            <div className="packages-panel-header">
              <h2 className="m-0 text-text-main text-base font-semibold">Активные пакеты</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-field border border-border rounded-full text-text-muted">
                {activeClientPackages.length}
              </span>
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
                <div className="text-center py-10 text-text-muted">
                  <p className="font-semibold text-sm m-0 text-text-main">Активных пакетов нет</p>
                </div>
              )}
            </div>

            {archivedClientPackages.length > 0 && (
              <div className="packages-archive">
                <button
                  className="flex w-full items-center justify-between p-3.5 text-sm font-semibold text-text-main hover:bg-field transition-colors"
                  type="button"
                  onClick={() => setArchiveOpen(!archiveOpen)}>
                  <span className="flex items-center gap-2">
                    <Archive size={15} className="text-text-muted" />
                    Архив завершённых пакетов
                  </span>
                  <ChevronDown className={`transition-transform ${archiveOpen ? "rotate-180" : ""}`} size={15} />
                </button>
                {archiveOpen && (
                  <div className="p-3 border-t border-border-soft flex flex-col gap-3 bg-field/30 max-h-[300px] overflow-y-auto">
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Templates Catalog */}
          <div className="packages-panel packages-panel-templates">
            <div className="packages-panel-header">
              <h2 className="m-0 text-text-main text-base font-semibold">Шаблоны пакетов</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-field border border-border rounded-full text-text-muted">
                {packages.length}
              </span>
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
                <div className="text-center py-10 text-text-muted">
                  <p className="font-semibold text-sm m-0 text-text-main">Шаблоны не найдены</p>
                </div>
              )}
            </div>
          </div>

          {/* Active Certificates */}
          <div className="packages-panel packages-panel-certificates">
            <div className="packages-panel-header">
              <h2 className="m-0 text-text-main text-base font-semibold">Активные сертификаты</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-field border border-border rounded-full text-text-muted">
                {activeCertificates.length}
              </span>
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
                <div className="text-center py-10 text-text-muted">
                  <p className="font-semibold text-sm m-0 text-text-main">Активных сертификатов нет</p>
                </div>
              )}
            </div>

            {archivedCertificates.length > 0 && (
              <div className="packages-archive">
                <button
                  className="flex w-full items-center justify-between p-3.5 text-sm font-semibold text-text-main hover:bg-field transition-colors"
                  type="button"
                  onClick={() => setCertificateArchiveOpen(!certificateArchiveOpen)}>
                  <span className="flex items-center gap-2">
                    <Archive size={15} className="text-text-muted" />
                    Архив сертификатов
                  </span>
                  <ChevronDown className={`transition-transform ${certificateArchiveOpen ? "rotate-180" : ""}`} size={15} />
                </button>
                {certificateArchiveOpen && (
                  <div className="p-3 border-t border-border-soft flex flex-col gap-3 bg-field/30 max-h-[300px] overflow-y-auto">
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PackagesPage;
