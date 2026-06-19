import {
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";
import {mobileNavItems, navGroups, navItems} from "../constants/navigation.js";

export default function AppNavigation({
  activePage,
  onOpenClientSearch,
  sidebarVisible,
  onPageChange,
  onSidebarVisibleChange,
  onLogout,
  studioName = "NUAR",
  ownerName = "Влад",
}) {
  const closeSidebar = () => onSidebarVisibleChange(false);
  const openSidebar = () => onSidebarVisibleChange(true);

  const handleDesktopPageChange = (page) => {
    onPageChange(page);

    if (window.innerWidth <= MOBILE_MAX_WIDTH) {
      closeSidebar();
    }
  };

  const handleSheetPageChange = (page) => {
    onPageChange(page);
    closeSidebar();
  };

  const hiddenMobileItems = navItems.filter(
    (item) => !mobileNavItems.some((mobileItem) => mobileItem.page === item.page),
  );

  return (
    <>
      <aside className="sidebar">
        <div className="logo" aria-label={`${studioName} CRM`}>
          <span className="logo-mark">N</span>
          <div className="logo-wordmark">
            <strong>{studioName}</strong>
            <small>CRM</small>
          </div>
        </div>
        <button
          aria-label="Скрыть меню"
          className="sidebar-collapse-button"
          title="Скрыть меню"
          type="button"
          onClick={closeSidebar}>
          <PanelLeftClose size={17} />
        </button>

        <nav className="nav-list" aria-label="Главное меню">
          <button
            className="client-search-trigger"
            type="button"
            onClick={onOpenClientSearch}>
            <Search size={18} />
            <span>Поиск клиентов</span>
            <kbd>{typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘K" : "Ctrl+K"}</kbd>
          </button>
          {navGroups.map((group, groupIndex) => (
            <div
              aria-label={group.label}
              className="nav-group"
              key={group.id}>
              {groupIndex > 0 ? <span aria-hidden="true" className="nav-group-divider" /> : null}
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    aria-label={item.label}
                    data-label={item.label}
                    className={activePage === item.page ? "active" : ""}
                    key={item.page}
                    type="button"
                    onClick={() => handleDesktopPageChange(item.page)}>
                    <Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="owner-card">
          <div className="owner-avatar">В</div>
          <div>
            <strong>{ownerName}</strong>
            <span>Владелец</span>
          </div>
          <button
            className="logout-button"
            type="button"
            aria-label="Выйти"
            onClick={onLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {sidebarVisible && (
        <button
          aria-label="Закрыть меню"
          className="mobile-sidebar-backdrop"
          type="button"
          onClick={closeSidebar}
        />
      )}

      {sidebarVisible && (
        <section className="mobile-more-sheet" aria-label="Все разделы">
          <button
            aria-label="Закрыть разделы"
            className="mobile-more-sheet-close"
            type="button"
            onClick={closeSidebar}>
            <X size={16} />
          </button>
          <nav className="mobile-more-sheet-nav">
            {hiddenMobileItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className={activePage === item.page ? "active" : ""}
                  key={item.page}
                  type="button"
                  onClick={() => handleSheetPageChange(item.page)}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </section>
      )}

      {!sidebarVisible && (
        <button
          className="sidebar-restore-button"
          type="button"
          aria-label="Показать меню"
          onClick={openSidebar}>
          <Menu className="mobile-menu-icon" size={20} />
          <PanelLeftOpen className="desktop-menu-icon" size={18} />
        </button>
      )}

      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              className={activePage === item.page ? "active" : ""}
              key={item.page}
              type="button"
              onClick={() => handleSheetPageChange(item.page)}>
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          className={sidebarVisible ? "active" : ""}
          type="button"
          onClick={() => onSidebarVisibleChange(!sidebarVisible)}>
          <MoreHorizontal size={21} />
          <span>Еще</span>
        </button>
      </nav>
    </>
  );
}
