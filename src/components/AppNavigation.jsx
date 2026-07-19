import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";
import {mobileNavItems, navGroups, navItems} from "../constants/navigation.js";
import {AppIcon, Button, IconButton} from "./ui/index.js";

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
      {/* Desktop Sidebar */}
      <aside className="nuar-sidebar hidden md:flex flex-col w-[240px] min-h-screen px-2.5 py-4 select-none">
        <div className="nuar-sidebar-brand" aria-label={`${studioName} CRM`}>
          <span>N</span>
          <div>
            <strong>{studioName}</strong>
            <small>CRM</small>
          </div>
        </div>
        <nav className="flex flex-col gap-2 mt-1" aria-label="Главное меню">
          <Button
            className="nuar-sidebar-search"
            leftIcon="search"
            size="sm"
            variant="ghost"
            onClick={onOpenClientSearch}
          >
            <span>Поиск</span>
            <kbd>
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
            </kbd>
          </Button>

          {navGroups.map((group, groupIndex) => (
            <div
              aria-label={group.label}
              className="flex flex-col gap-0"
              key={group.id}
            >
              {groupIndex > 0 ? <span aria-hidden="true" className="nuar-sidebar-separator" /> : null}
              {group.items.map((item) => {
                const isActive = activePage === item.page;

                return (
                  <Button
                    aria-label={item.label}
                    data-label={item.label}
                    className={`nuar-sidebar-nav-item ${isActive ? "is-active" : ""}`}
                    key={item.page}
                    leftIcon={<AppIcon name={item.icon} size="md" />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDesktopPageChange(item.page)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nuar-sidebar-user">
          <div>В</div>
          <div>
            <strong>{ownerName}</strong>
            <span>Владелец</span>
          </div>
          <IconButton
            className="nuar-sidebar-logout"
            icon="logout"
            label="Выйти"
            size="sm"
            variant="ghost"
            onClick={onLogout}
          />
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarVisible && (
        <button
          aria-label="Закрыть меню"
          className="mobile-sidebar-backdrop fixed inset-0 z-40 block md:hidden"
          type="button"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile More Sheet */}
      {sidebarVisible && (
        <section className="mobile-more-sheet fixed right-0 bottom-16 left-0 z-40 block md:hidden" aria-label="Все разделы">
          <div className="mobile-more-sheet-head">
            <span className="mobile-more-sheet-title">Все разделы</span>
            <IconButton
              className="mobile-more-sheet-close"
              icon="x"
              label="Закрыть разделы"
              size="sm"
              variant="ghost"
              onClick={closeSidebar}
            />
          </div>
          <nav className="mobile-more-sheet-nav grid grid-cols-2 gap-2">
            {hiddenMobileItems.map((item) => {
              const isActive = activePage === item.page;

              return (
                <Button
                  className={isActive ? "active" : ""}
                  key={item.page}
                  leftIcon={item.icon}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSheetPageChange(item.page)}
                >
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </section>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-45 flex select-none md:hidden" aria-label="Мобильная навигация">
        {mobileNavItems.map((item) => {
          const isActive = activePage === item.page;

          return (
            <Button
              className={isActive ? "active" : ""}
              key={item.page}
              leftIcon={item.icon}
              size="sm"
              variant="ghost"
              onClick={() => handleSheetPageChange(item.page)}
            >
              {item.label}
            </Button>
          );
        })}
        <Button
          className={sidebarVisible ? "active" : ""}
          leftIcon="more"
          size="sm"
          variant="ghost"
          onClick={() => onSidebarVisibleChange(!sidebarVisible)}
        >
          Еще
        </Button>
      </nav>
    </>
  );
}
