import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";
import {navGroups} from "../constants/navigation.js";
import {getAllowedMobileNav, getAllowedNavigation} from "../utils/permissions.js";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const ROLE_LABELS = {
  owner: "Владелец",
  admin: "Администратор",
  manager: "Менеджер",
  staff: "Сотрудник",
  readonly: "Только чтение",
};

export default function AppNavigation({
  activePage,
  authUser = null,
  navBadges = {},
  onOpenClientSearch,
  sidebarVisible,
  onPageChange,
  onSidebarVisibleChange,
  onLogout,
  studioName = "NUAR",
  ownerName = "Влад",
}) {
  const closeSidebar = () => onSidebarVisibleChange(false);
  const displayUserName =
    String(authUser?.name ?? "").trim() ||
    (authUser?.role && authUser.role !== "owner"
      ? String(authUser.email ?? "").split("@")[0] || "Сотрудник"
      : ownerName);
  const displayRoleLabel = ROLE_LABELS[authUser?.role] || "Владелец";

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

  const allowedGroups = getAllowedNavigation(navGroups, authUser);
  const allowedItems = allowedGroups.flatMap((group) => group.items);
  const currentMobileNavItems = getAllowedMobileNav(authUser);
  const hiddenMobileItems = allowedItems.filter(
    (item) => !currentMobileNavItems.some((mobileItem) => mobileItem.page === item.page),
  );
  const getBadge = (page) => {
    const value = Number(navBadges?.[page]) || 0;
    if (value <= 0) return "";
    return value > 99 ? "99+" : String(value);
  };
  const renderLabel = (item) => {
    const badge = getBadge(item.page);

    return (
      <>
        <span className="nuar-nav-label">{item.label}</span>
        {badge ? (
          <span className="nuar-nav-badge" aria-label={`${item.label}: ${badge}`}>
            {badge}
          </span>
        ) : null}
      </>
    );
  };

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

          {allowedGroups.map((group, groupIndex) => (
            <div
              aria-label={group.label}
              className="flex flex-col gap-0"
              key={group.id}
            >
              {groupIndex > 0 ? <span aria-hidden="true" className="nuar-sidebar-separator" /> : null}
              {group.items.map((item) => {
                const isActive = activePage === item.page;
                const badge = getBadge(item.page);

                return (
                  <Button
                    aria-label={badge ? `${item.label}: ${badge}` : item.label}
                    data-label={item.label}
                    className={`nuar-sidebar-nav-item ${isActive ? "is-active" : ""}`}
                    key={item.page}
                    leftIcon={<AppIcon name={item.icon} size="md" />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDesktopPageChange(item.page)}
                  >
                    {renderLabel(item)}
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nuar-sidebar-user">
          <div>{(displayUserName?.[0] || "В").toUpperCase()}</div>
          <div>
            <strong>{displayUserName}</strong>
            <span>{displayRoleLabel}</span>
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
              const badge = getBadge(item.page);

              return (
                <Button
                  aria-label={badge ? `${item.label}: ${badge}` : item.label}
                  className={isActive ? "active" : ""}
                  key={item.page}
                  leftIcon={item.icon}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSheetPageChange(item.page)}
                >
                  {renderLabel(item)}
                </Button>
              );
            })}
          </nav>
        </section>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-45 flex select-none md:hidden" aria-label="Мобильная навигация">
        {currentMobileNavItems.map((item) => {
          const isActive = activePage === item.page;
          const badge = getBadge(item.page);

          return (
            <Button
              aria-label={badge ? `${item.label}: ${badge}` : item.label}
              className={isActive ? "active" : ""}
              key={item.page}
              leftIcon={item.icon}
              size="sm"
              variant="ghost"
              onClick={() => handleSheetPageChange(item.page)}
            >
              {renderLabel(item)}
            </Button>
          );
        })}
        {hiddenMobileItems.length > 0 && (
          <Button
            className={sidebarVisible ? "active" : ""}
            leftIcon="more"
            size="sm"
            variant="ghost"
            onClick={() => onSidebarVisibleChange(!sidebarVisible)}
          >
            <span className="nuar-nav-label">Ещё</span>
          </Button>
        )}
      </nav>
    </>
  );
}
