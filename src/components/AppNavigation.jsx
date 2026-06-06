import {
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

export default function AppNavigation({
  activePage,
  navItems,
  mobileNavItems,
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

    if (window.innerWidth <= 700) {
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
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                data-label={item.label}
                className={activePage === item.page ? "active" : ""}
                key={item.label}
                title={item.label}
                onClick={() => handleDesktopPageChange(item.page)}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
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
          <div>
            <strong>Разделы</strong>
            <button
              aria-label="Закрыть разделы"
              type="button"
              onClick={closeSidebar}>
              <X size={18} />
            </button>
          </div>
          <nav>
            {hiddenMobileItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className={activePage === item.page ? "active" : ""}
                  key={item.page}
                  type="button"
                  onClick={() => handleSheetPageChange(item.page)}>
                  <Icon size={19} />
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
