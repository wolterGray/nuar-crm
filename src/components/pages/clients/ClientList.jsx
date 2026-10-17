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
      {/* 1. Primary Filter Bar: Search (Left) + Dropdown Selects (Right) */}
      <div className="clients-toolbar-primary flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border/50 shrink-0 bg-surface flex-wrap sm:flex-nowrap">
        {/* Search Field */}
        <div className="clients-search-box flex items-center flex-1 min-w-[200px] max-w-[340px]">
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

        {/* Dropdown Filters (Sort, Status, Segment) */}
        <div className="clients-filter-dropdown-group flex items-center gap-2 shrink-0">
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
            <option value="Редко">Редко</option>
            <option value="Давно">Давно</option>
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

      {/* 2. Secondary Filter Bar: Quick Indicator Tabs Underneath */}
      <div className="clients-toolbar-secondary flex items-center gap-1.5 px-3.5 py-2 border-b border-border/50 shrink-0 bg-surface overflow-x-auto scrollbar-none">
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

      {/* 2. Structured Table-Like Header (Aligned Columns on Desktop) */}
      <div className="clients-list-header-row hidden sm:grid grid-cols-[minmax(0,1fr)_90px_110px_130px_36px] items-center gap-3 px-3.5 py-2 border-b border-border/50 text-[10px] text-textMuted uppercase font-bold tracking-wider shrink-0 bg-surface">
        <div>Клиент</div>
        <div className="text-right">Визиты</div>
        <div className="text-right">Выручка</div>
        <div className="text-right">Последний визит</div>
        <div></div>
      </div>

      {/* 3. Client Rows List (Unified Modern Card/Row) */}
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
              className={`clients-list-item flex sm:grid sm:grid-cols-[minmax(0,1fr)_90px_110px_130px_36px] items-center justify-between sm:justify-normal gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2.5 transition-colors cursor-pointer text-left select-none ${
                isSelected
                  ? "is-selected bg-surface-2 border-l-2 border-accent"
                  : "hover:bg-white/[0.02] border-l-2 border-transparent"
              } ${isFocused ? "animate-pulse ring-1 ring-accent" : ""}`}>
              {/* Col 1 / Mobile Main: Small Avatar (28px) + Full Unclipped Name + Subtitle */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-initial">
                <span className={`client-list-avatar shrink-0 grid place-items-center w-7 h-7 rounded-full text-[10.5px] font-bold ${
                  isSelected ? "bg-accent/15 text-accent" : "bg-surface-2 border border-white/5 text-textMuted"
                }`}>
                  {getClientInitials(client.name || client.phone)}
                </span>

                <div className="flex flex-col min-w-0 flex-1 justify-center">
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <strong className="text-sm font-semibold text-textPrimary leading-snug break-words sm:truncate" title={client.name}>
                      {client.name || client.phone || "Без имени"}
                    </strong>

                    {client.isVip ? (
                      <span className="hidden sm:inline-flex client-badge-vip shrink-0 items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold text-amber-400 bg-amber-400/10">
                        <AppIcon name="crown" size="xs" />
                        <span>VIP</span>
                      </span>
                    ) : null}

                    <span className={`hidden sm:inline-flex shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                      client.autoStatus === "Новый"
                        ? "text-blue-400 bg-blue-400/10"
                        : client.autoStatus === "Активный"
                        ? "text-emerald-400 bg-emerald-400/10"
                        : client.autoStatus === "Редко"
                        ? "text-amber-400 bg-amber-400/10"
                        : "text-rose-400 bg-rose-400/10"
                    }`}>
                      {client.autoStatus}
                    </span>

                    {client.hasDebt ? (
                      <span className="hidden sm:inline-flex client-badge-debt shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold text-rose-400 bg-rose-400/10" title={`Долг: ${formatMoney(client.totalDebt)}`}>
                        Долг
                      </span>
                    ) : null}
                  </div>

                  {/* Desktop sub-line: Phone + Note */}
                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-textMuted mt-0.5">
                    <span className="truncate">{client.phone || "Без телефона"}</span>
                    {client.hasNote ? (
                      <span title={client.note} className="text-textFaint flex items-center gap-0.5">
                        <AppIcon name="fileText" size="xs" />
                        <span className="hidden xl:inline text-[10px] truncate max-w-[160px]">{client.note}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Mobile sub-line: Revenue • Visits count • Note (No phone in preview) */}
                  <div className="flex sm:hidden items-center gap-1.5 text-xs text-textMuted mt-0.5 truncate">
                    <span className="shrink-0 text-textPrimary font-semibold">{formatMoney(client.totalIncome)}</span>
                    <span className="text-textFaint shrink-0">•</span>
                    <span className="shrink-0">{client.visitsCount} {client.visitsCount === 1 ? "визит" : client.visitsCount >= 2 && client.visitsCount <= 4 ? "визита" : "визитов"}</span>
                    {client.hasNote ? (
                      <span className="text-textFaint flex items-center gap-1 shrink-0 ml-1" title={client.note}>
                        <AppIcon name="fileText" size="xs" />
                        <span className="text-[11px] truncate max-w-[120px]">{client.note}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Col 2 (Desktop): Visits Count */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {client.visitsCount} виз.
                </span>
                <span className="text-[10px] text-textMuted truncate">
                  {client.packagesCount > 0 ? "пакет" : `${client.completedVisitsCount} оконч.`}
                </span>
              </div>

              {/* Col 3 (Desktop): Revenue */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {formatMoney(client.totalIncome)}
                </span>
              </div>

              {/* Col 4 (Desktop): Last Visit */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-textPrimary">
                  {hasLastVisit ? client.lastVisit : "—"}
                </span>
                <span className={`text-[10px] ${isChurnRisk ? "text-amber-400 font-semibold" : "text-textMuted"}`}>
                  {hasLastVisit && client.daysAbsent !== null ? `${client.daysAbsent} дн.` : "новый"}
                </span>
              </div>

              {/* Col 5 (Desktop): Actions button */}
              <div className="hidden sm:flex justify-end">
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

              {/* Mobile Right Section: Last visit date */}
              <div className="flex sm:hidden flex-col items-end text-right shrink-0 ml-2">
                <span className="text-xs font-semibold text-textPrimary">
                  {hasLastVisit ? client.lastVisit : "—"}
                </span>
                <span className={`text-[10.5px] ${isChurnRisk ? "text-amber-400 font-semibold" : "text-textMuted"}`}>
                  {hasLastVisit && client.daysAbsent !== null ? `${client.daysAbsent} дн.` : "новый"}
                </span>
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
