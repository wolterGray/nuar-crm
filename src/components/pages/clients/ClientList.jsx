import { memo } from "react";
import AppIcon from "../../ui/AppIcon.jsx";
import Button from "../../ui/Button.jsx";
import PaginationBar from "../../ui/PaginationBar.jsx";
import ClientRowActions from "./ClientRowActions.jsx";

function ClientList({
  clients,
  totalFilteredCount,
  selectedClientId,
  onSelectClient,
  search,
  onSearchChange,
  onClearSearch,
  quickFilter,
  onQuickFilterChange,
  indicatorCounts,
  statusFilter,
  onStatusFilterChange,
  segmentFilter,
  onSegmentFilterChange,
  sortOrder,
  onSortOrderChange,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onAddClient,
  handleMessageClient,
  handleAddToWaitlist,
  onEditClient,
  onDeleteClient,
  openClientMenuId,
  setOpenClientMenuId,
  isFocusedClient,
  getClientInitials,
  formatMoney,
  inactiveClientDays,
}) {
  return (
    <div className="clients-list-pane flex flex-col h-full w-full min-h-0 bg-surface border border-border rounded-card overflow-hidden">
      {/* 1. Compact Single-Row Toolbar (Search + Quick Pills + Dropdowns) */}
      <div className="clients-toolbar flex items-center justify-between gap-2.5 px-3 py-2 border-b border-border/70 shrink-0 bg-surface">
        {/* Left Side: Search + Quick Pills */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
          {/* Compact Search */}
          <div className="clients-search-box flex items-center shrink-0 w-[190px] md:w-[230px]">
            <AppIcon className="clients-search-icon" name="search" size="xs" />
            <input
              aria-label="Поиск по клиентам"
              className="clients-search-input"
              placeholder="Поиск по клиентам..."
              type="text"
              value={search}
              onChange={onSearchChange}
            />
            {search ? (
              <button
                aria-label="Очистить поиск"
                className="clients-search-clear"
                type="button"
                onClick={onClearSearch}>
                <AppIcon name="x" size="xs" />
              </button>
            ) : null}
          </div>

          <div className="h-4 w-px bg-border/60 shrink-0 mx-0.5 hidden sm:block" />

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className={`clients-quick-pill ${!quickFilter ? "is-active" : ""}`}
              onClick={() => onQuickFilterChange(null)}>
              <span>Все</span>
              <span className="pill-count">{totalFilteredCount}</span>
            </button>

            <button
              type="button"
              className={`clients-quick-pill ${quickFilter === "vip" ? "is-active" : ""}`}
              onClick={() => onQuickFilterChange(quickFilter === "vip" ? null : "vip")}>
              <AppIcon name="crown" size="xs" className="text-amber-400" />
              <span>VIP</span>
              <span className="pill-count">{indicatorCounts.vip}</span>
            </button>

            <button
              type="button"
              className={`clients-quick-pill ${quickFilter === "note" ? "is-active" : ""}`}
              onClick={() => onQuickFilterChange(quickFilter === "note" ? null : "note")}>
              <AppIcon name="fileText" size="xs" className="text-textMuted" />
              <span>С заметкой</span>
              <span className="pill-count">{indicatorCounts.withNote}</span>
            </button>

            <button
              type="button"
              className={`clients-quick-pill ${quickFilter === "debt" ? "is-active" : ""}`}
              onClick={() => onQuickFilterChange(quickFilter === "debt" ? null : "debt")}>
              <AppIcon name="ban" size="xs" className="text-rose-400" />
              <span>С долгом</span>
              <span className="pill-count">{indicatorCounts.withDebt}</span>
            </button>

            <button
              type="button"
              className={`clients-quick-pill ${quickFilter === "active" ? "is-active" : ""}`}
              onClick={() => onQuickFilterChange(quickFilter === "active" ? null : "active")}>
              <span className="pill-dot pill-dot-green" />
              <span>Активные</span>
              <span className="pill-count">{indicatorCounts.active}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Compact Dropdown Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            aria-label="Сортировка"
            className="clients-filter-dropdown"
            value={sortOrder}
            onChange={onSortOrderChange}>
            <option value="recent">Визит ↓</option>
            <option value="oldest">Визит ↑</option>
            <option value="income">По сумме</option>
            <option value="name">По имени</option>
          </select>

          <select
            aria-label="Статус"
            className="clients-filter-dropdown"
            value={statusFilter}
            onChange={onStatusFilterChange}>
            <option value="all">Все статусы</option>
            <option value="Активный">Активные</option>
            <option value="Новый">Новые</option>
          </select>

          <select
            aria-label="Сегменты"
            className="clients-filter-dropdown"
            value={segmentFilter}
            onChange={onSegmentFilterChange}>
            <option value="all">Все сегменты</option>
            <option value="vip">VIP клиенты</option>
            <option value="packages">С пакетами</option>
            <option value="certificates">С сертифик.</option>
            <option value="inactive_30">&gt; 30 дней</option>
            <option value="inactive_90">&gt; 90 дней</option>
            <option value="new">Без визитов</option>
          </select>
        </div>
      </div>

      {/* 2. Structured Table-Like Header (Aligned Columns) */}
      <div className="clients-list-header-row hidden sm:grid grid-cols-[minmax(0,1fr)_90px_110px_130px_36px] items-center gap-3 px-3.5 py-2 border-b border-border/50 text-[10px] text-textMuted uppercase font-bold tracking-wider shrink-0 bg-surface">
        <div>Клиент</div>
        <div className="text-right">Визиты</div>
        <div className="text-right">Выручка</div>
        <div className="text-right">Последний визит</div>
        <div></div>
      </div>

      {/* 3. Client Rows List (Aligned Vertically in Columns) */}
      <div className="clients-list-scroll flex-1 min-h-0 overflow-y-auto">
        {clients.map((client) => {
          const isSelected = selectedClientId === client.id;
          const isFocused = isFocusedClient(client);
          const hasLastVisit = client.lastVisit && client.lastVisit !== "—";
          const isChurnRisk =
            client.visitsCount > 0 &&
            client.daysAbsent !== null &&
            client.daysAbsent >= (inactiveClientDays || 30);

          return (
            <div
              key={client.id}
              id={`alert-focus-client-${client.id}`}
              role="button"
              tabIndex="0"
              onClick={() => onSelectClient(client)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectClient(client);
                }
              }}
              className={`clients-list-item grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_90px_110px_130px_36px] items-center gap-3 px-3.5 py-2.5 transition-colors cursor-pointer text-left select-none ${
                isSelected
                  ? "is-selected bg-surface-2 border-l-2 border-accent"
                  : "hover:bg-field/70 border-l-2 border-transparent"
              } ${isFocused ? "animate-pulse ring-1 ring-accent" : ""}`}>
              {/* Col 1: Identity: Small Avatar (28px) + Name + Badges + Phone */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`client-list-avatar shrink-0 grid place-items-center w-7 h-7 rounded-full text-[10px] font-bold ${
                  isSelected ? "bg-accent/15 text-accent" : "bg-field text-textMuted"
                }`}>
                  {getClientInitials(client.name || client.phone)}
                </span>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-xs sm:text-sm font-semibold text-textPrimary truncate" title={client.name}>
                      {client.name || client.phone || "Без имени"}
                    </strong>

                    {client.isVip ? (
                      <span className="client-badge-vip flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold text-amber-400 bg-amber-400/10">
                        <AppIcon name="crown" size="xs" />
                        <span>VIP</span>
                      </span>
                    ) : null}

                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                      client.autoStatus === "Новый"
                        ? "text-blue-400 bg-blue-400/10"
                        : "text-emerald-400 bg-emerald-400/10"
                    }`}>
                      {client.autoStatus}
                    </span>

                    {client.hasDebt ? (
                      <span className="client-badge-debt px-1.5 py-0.2 rounded text-[10px] font-bold text-rose-400 bg-rose-400/10" title={`Долг: ${formatMoney(client.totalDebt)}`}>
                        Долг
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-textMuted mt-0.5">
                    <span className="truncate">{client.phone || "Без телефона"}</span>
                    {client.hasNote ? (
                      <span title={client.note} className="text-textFaint flex items-center gap-0.5">
                        <AppIcon name="fileText" size="xs" />
                        <span className="hidden xl:inline text-[10px] truncate max-w-[160px]">{client.note}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Col 2: Visits Count (Strictly aligned in column) */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {client.visitsCount} виз.
                </span>
                <span className="text-[10px] text-textMuted truncate">
                  {client.packagesCount > 0 ? "пакет" : `${client.completedVisitsCount} оконч.`}
                </span>
              </div>

              {/* Col 3: Revenue (Strictly aligned in column) */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {formatMoney(client.totalIncome)}
                </span>
              </div>

              {/* Col 4: Last Visit (Strictly aligned in column) */}
              <div className="flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {hasLastVisit ? client.lastVisit : "—"}
                </span>
                <span className={`text-[10px] ${isChurnRisk ? "text-amber-400 font-semibold" : "text-textMuted"}`}>
                  {hasLastVisit && client.daysAbsent !== null ? `${client.daysAbsent} дн.` : "новый"}
                </span>
              </div>

              {/* Col 5: Actions button */}
              <div className="flex justify-end">
                <ClientRowActions
                  client={client}
                  handleAddToWaitlist={handleAddToWaitlist}
                  handleMessageClient={handleMessageClient}
                  onDeleteClient={onDeleteClient}
                  onEditClient={onEditClient}
                  openClientMenuId={openClientMenuId}
                  setOpenClientMenuId={setOpenClientMenuId}
                  onSelectClient={onSelectClient}
                />
              </div>
            </div>
          );
        })}

        {clients.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-textMuted gap-2">
            <AppIcon name="search" size="md" className="opacity-40" />
            <strong className="text-textPrimary text-sm font-semibold">Клиенты не найдены</strong>
            <span className="text-xs text-textFaint">Попробуйте изменить запрос или сбросить фильтры</span>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={onClearSearch}>
              Сбросить поиск
            </Button>
          </div>
        )}
      </div>

      {/* 4. Pagination Bar pinned at bottom */}
      <div className="p-2 border-t border-border/40 shrink-0 bg-surface">
        <PaginationBar
          className="w-full"
          currentPage={page}
          itemLabel="клиентов"
          pageSize={pageSize}
          totalItems={totalFilteredCount}
          totalPages={pageCount}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}

export default memo(ClientList);
