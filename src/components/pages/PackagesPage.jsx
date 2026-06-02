import {Pencil, Plus, Trash2} from "lucide-react";
import {motion} from "framer-motion";
import {formatMoney} from "../../utils/formatters.jsx";
import {getPackageProgressLabel, getPackageUsedVisits} from "../../utils/packages.jsx";

function PackagesPage({
  packages,
  clientPackages,
  onAdd,
  onEdit,
  onDelete,
  packageSalesIncome,
  onSellPackage,
  onEditClientPackage,
  onDeleteClientPackage,
}) {
  const activePackages = clientPackages.filter(
    (packageItem) => packageItem.status === "Активен",
  );
  const remainingVisits = clientPackages.reduce(
    (sum, packageItem) => sum + (Number(packageItem.remainingVisits) || 0),
    0,
  );

  return (
    <section className="catalog-page">
      <div className="employees-toolbar">
        <div>
          <h2>Пакеты</h2>
          <p>
            {packages.length} шаблонов · {clientPackages.length} у клиентов
          </p>
        </div>
        <div className="clients-toolbar-actions">
          <button className="secondary-button" type="button" onClick={onSellPackage}>
            <Plus size={18} />
            Продать клиенту
          </button>
          <button className="add-visit-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            Добавить шаблон
          </button>
        </div>
      </div>

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
          <h3>{activePackages.length}</h3>
        </article>
        <article className="catalog-card">
          <span>Осталось визитов</span>
          <h3>{remainingVisits}</h3>
        </article>
      </div>

      <div className="panel client-packages-panel">
        <div className="panel-header">
          <h2>Пакеты клиентов</h2>
        </div>
        <div className="client-packages-list">
          {clientPackages.map((packageItem) => (
            <article className="client-package-card" key={packageItem.id}>
              <div className="client-package-main">
                <strong>{packageItem.client}</strong>
                <span>{packageItem.packageName}</span>
                <small>{packageItem.service}</small>
              </div>
              <div className="client-package-progress">
                <div>
                  <span>Использовано сеансов</span>
                  <strong>{getPackageProgressLabel(packageItem)}</strong>
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
                  onClick={() => onEditClientPackage(packageItem)}>
                  <Pencil size={16} />
                </button>
                <button
                  aria-label="Удалить пакет клиента"
                  className="compact-icon-button danger"
                  title="Удалить"
                  type="button"
                  onClick={() => onDeleteClientPackage(packageItem)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {clientPackages.length === 0 && (
            <div className="clients-empty">
              <strong>Пока нет проданных пакетов</strong>
              <span>Продайте пакет клиенту, чтобы отслеживать остаток визитов.</span>
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
