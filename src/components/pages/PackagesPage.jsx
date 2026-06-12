import {Archive, ChevronDown, Pencil, Plus, Trash2} from "lucide-react";
import {useMemo, useState} from "react";
import {motion} from "framer-motion";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
} from "../../utils/clientPackages.js";
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

function PackagesPage({
  packages,
  clientPackages,
  certificates,
  onAdd,
  onEdit,
  onDelete,
  packageSalesIncome,
  onSellPackage,
  onEditClientPackage,
  onDeleteClientPackage,
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const activeClientPackages = useMemo(
    () => clientPackages.filter(isActiveClientPackage),
    [clientPackages],
  );
  const archivedClientPackages = useMemo(
    () => clientPackages.filter(isArchivedClientPackage),
    [clientPackages],
  );
  const remainingVisits = activeClientPackages.reduce(
    (sum, packageItem) => sum + (Number(packageItem.remainingVisits) || 0),
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
              onClick={onSellPackage}>
              <Plus size={18} />
              Продать клиенту
            </button>
            <button className="add-visit-button" type="button" onClick={onAdd}>
              <Plus size={18} />
              Добавить пакет
            </button>
          </>
        }
        description={`${packages.length} шаблонов · ${activeClientPackages.length} активных · ${archivedClientPackages.length} в архиве`}
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
          <span>Активных пакетов</span>
          <h3>{activeClientPackages.length}</h3>
        </article>
        <article className="catalog-card">
          <span>Осталось визитов</span>
          <h3>{remainingVisits}</h3>
        </article>
      </div>

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

      <div className="panel client-packages-panel">
        <div className="panel-header">
          <h2>Проданные сертификаты</h2>
          <span>{certificates.length}</span>
        </div>
        <div className="client-packages-list">
          {certificates.map((certificate) => (
            <article
              className="client-package-card certificate-card"
              key={certificate.id}>
              <div className="client-package-main">
                <strong>
                  {certificate.client || "Без привязки к клиенту"}
                </strong>
                <span>{certificate.service}</span>
                <small>{certificate.date}</small>
              </div>
              <div className="client-package-meta">
                <span>{formatMoney(certificate.extra)}</span>
                <b>{certificate.payment}</b>
              </div>
            </article>
          ))}
          {certificates.length === 0 && (
            <div className="clients-empty">
              <strong>Сертификаты пока не продавались</strong>
              <span>
                Продажа появится здесь после добавления поступления в разделе
                оплат.
              </span>
            </div>
          )}
        </div>
      </div>

      <h2>Шаблоны пакетов</h2>
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
