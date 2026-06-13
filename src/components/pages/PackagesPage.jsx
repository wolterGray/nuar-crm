import {Archive, ChevronDown, Gift, Pencil, Plus, Trash2} from "lucide-react";
import {useMemo, useState} from "react";
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
import PageHeader from "../PageHeader.jsx";

function ClientPackageCard({onDelete, onEdit, packageItem}) {
  const archived = isArchivedClientPackage(packageItem);

  return (
    <article className={`client-package-card${archived ? " is-archived" : ""}`}>
      <div className="client-package-main">
        <strong>{packageItem.client}</strong>
        <span>{packageItem.packageName}</span>
        <small>{packageItem.service}</small>
      </div>
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
    </article>
  );
}

function CertificateCard({certificate, onDelete, onEdit}) {
  const archived = isArchivedCertificate(certificate);

  return (
    <article
      className={`client-package-card certificate-card${archived ? " is-archived" : ""}`}>
      <div className="client-package-main">
        <strong>{certificate.code}</strong>
        <span>{certificate.client || "Без покупателя"}</span>
        <small>
          {certificate.recipient && certificate.recipient !== certificate.client
            ? `Получатель: ${certificate.recipient}`
            : `До ${certificate.expiryDate || "—"}`}
        </small>
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
    </article>
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [certificateArchiveOpen, setCertificateArchiveOpen] = useState(false);
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

  return (
    <section className="catalog-page">
      <PageHeader
        actions={
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
        }
        description={`${packages.length} шаблонов · ${activeClientPackages.length} активных пакетов · ${activeCertificates.length} активных сертификатов`}
        title="Пакеты"
      />

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

      <div className="panel client-packages-panel">
        <div className="panel-header">
          <h2>Активные сертификаты</h2>
          <span>{activeCertificates.length}</span>
        </div>
        <div className="client-packages-list">
          {activeCertificates.map((certificate) => (
            <CertificateCard
              key={certificate.id}
              certificate={certificate}
              onDelete={onDeleteCertificate}
              onEdit={onEditCertificate}
            />
          ))}
          {activeCertificates.length === 0 && (
            <div className="clients-empty">
              <strong>Активных сертификатов нет</strong>
              <span>
                Продайте сертификат клиенту — код, номинал и остаток будут
                отслеживаться автоматически.
              </span>
            </div>
          )}
        </div>
      </div>

      {archivedCertificates.length > 0 ? (
        <div className="panel client-packages-panel client-packages-archive-panel">
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
              {archivedCertificates.map((certificate) => (
                <CertificateCard
                  key={certificate.id}
                  certificate={certificate}
                  onDelete={onDeleteCertificate}
                  onEdit={onEditCertificate}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="panel client-packages-panel">
        <div className="panel-header">
          <h2>Активные пакеты клиентов</h2>
          <span>{activeClientPackages.length}</span>
        </div>
        <div className="client-packages-list">
          {activeClientPackages.map((packageItem) => (
            <ClientPackageCard
              key={packageItem.id}
              packageItem={packageItem}
              onDelete={onDeleteClientPackage}
              onEdit={onEditClientPackage}
            />
          ))}
          {activeClientPackages.length === 0 && (
            <div className="clients-empty">
              <strong>Активных пакетов нет</strong>
              <span>
                Продайте пакет клиенту или верните нужный пакет из архива.
              </span>
            </div>
          )}
        </div>
      </div>

      {archivedClientPackages.length > 0 ? (
        <div className="panel client-packages-panel client-packages-archive-panel">
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
              {archivedClientPackages.map((packageItem) => (
                <ClientPackageCard
                  key={packageItem.id}
                  packageItem={packageItem}
                  onDelete={onDeleteClientPackage}
                  onEdit={onEditClientPackage}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 className="catalog-section-heading">Шаблоны пакетов</h2>
      <div className="catalog-grid">
        {packages.map((packageItem) => (
          <motion.article
            animate={{opacity: 1, y: 0}}
            className="catalog-card catalog-row-card"
            initial={{opacity: 0, y: 6}}
            key={packageItem.id}>
            <div>
              <h3>{packageItem.name}</h3>
              <span>{packageItem.service}</span>
            </div>
            <div className="catalog-prices">
              <span>
                Визитов <strong>{packageItem.visitsCount}</strong>
              </span>
              <span>
                Стоимость <strong>{formatMoney(packageItem.price)}</strong>
              </span>
              <span>
                Срок <strong>{packageItem.validityDays} дней</strong>
              </span>
              <span>
                Статус <strong>{packageItem.status}</strong>
              </span>
            </div>
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
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default PackagesPage;
