import {
  LogOut,
  MoreHorizontal,
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
      <aside className="nuar-sidebar hidden md:flex flex-col w-[240px] min-h-screen px-2.5 py-4 bg-[#0B0F14] border-r border-white/[0.07] select-none">
        <div className="flex items-center gap-3 min-h-[38px] px-1 pb-4" aria-label={`${studioName} CRM`}>
          <span className="grid w-9 h-9 place-items-center border border-white/[0.09] rounded-xl text-zinc-100 bg-white/[0.045] text-[17px] font-semibold">N</span>
          <div className="flex flex-col leading-tight">
            <strong className="text-zinc-100 text-sm font-semibold tracking-tight">{studioName}</strong>
            <small className="text-zinc-500 text-[10px] uppercase font-semibold tracking-wider">CRM</small>
          </div>
        </div>
        <nav className="flex flex-col gap-2 mt-1" aria-label="Главное меню">
          <button
            aria-label="Поиск клиентов"
            className="nuar-sidebar-search flex items-center justify-start gap-2.5 h-8 px-2 border border-white/[0.07] rounded-lg text-zinc-500 hover:text-zinc-300 bg-transparent cursor-pointer text-xs font-medium normal-case tracking-normal transition-colors"
            type="button"
            onClick={onOpenClientSearch}
          >
            <Search size={16} />
            <span>Поиск</span>
            <kbd className="ml-auto hidden text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>

          {navGroups.map((group, groupIndex) => (
            <div
              aria-label={group.label}
              className="flex flex-col gap-0"
              key={group.id}
            >
              {groupIndex > 0 ? <span aria-hidden="true" className="block my-1.5 border-t border-white/[0.045]" /> : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.page;

                return (
                  <button
                    aria-label={item.label}
                    data-label={item.label}
                    className={`nuar-sidebar-nav-item flex items-center justify-start gap-2.5 h-8 px-2 rounded-none text-[13px] font-medium cursor-pointer transition-colors ${
                      isActive
                        ? "is-active text-zinc-100 bg-white/[0.045] border-l border-white/[0.16] shadow-none"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    key={item.page}
                    type="button"
                    onClick={() => handleDesktopPageChange(item.page)}
                  >
                    <Icon size={18} className={isActive ? "text-zinc-100" : "text-zinc-500"} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3 mt-auto p-2 rounded-2xl bg-white/[0.035] border border-white/[0.07] min-h-[60px]">
          <div className="grid w-8 h-8 place-items-center rounded-full text-zinc-100 font-semibold bg-white/[0.08] text-xs">В</div>
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <strong className="text-zinc-200 text-xs font-bold truncate">{ownerName}</strong>
            <span className="text-zinc-500 text-[10px] font-semibold">Владелец</span>
          </div>
          <button
            className="grid w-8 h-8 place-items-center rounded bg-transparent text-zinc-500 hover:text-zinc-300 cursor-pointer"
            type="button"
            aria-label="Выйти"
            data-label="Выйти"
            onClick={onLogout}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarVisible && (
        <button
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-xs cursor-pointer block md:hidden"
          type="button"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile More Sheet */}
      {sidebarVisible && (
        <section className="fixed right-0 bottom-16 left-0 z-40 max-h-[70vh] overflow-y-auto border-t border-zinc-800 rounded-t-2xl bg-zinc-950 p-5 shadow-2xl block md:hidden" aria-label="Все разделы">
          <div className="flex justify-between items-center pb-3 mb-3 border-b border-zinc-900">
            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Все разделы</span>
            <button
              aria-label="Закрыть разделы"
              className="grid w-8 h-8 place-items-center border border-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-300 bg-transparent cursor-pointer"
              type="button"
              onClick={closeSidebar}
            >
              <X size={15} />
            </button>
          </div>
          <nav className="grid grid-cols-2 gap-2">
            {hiddenMobileItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.page;

              return (
                <button
                  className={`flex items-center gap-3 h-11 px-3 border rounded-xl text-xs font-semibold cursor-pointer ${
                    isActive
                      ? "text-zinc-100 bg-white/[0.065] border-white/[0.08]"
                      : "text-zinc-350 bg-zinc-900 border-zinc-850"
                  }`}
                  key={item.page}
                  type="button"
                  onClick={() => handleSheetPageChange(item.page)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </section>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-45 flex h-16 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-xs select-none md:hidden" aria-label="Мобильная навигация">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.page;

          return (
            <button
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
              isActive ? "text-zinc-100 font-semibold" : "text-zinc-500"
              }`}
              key={item.page}
              type="button"
              onClick={() => handleSheetPageChange(item.page)}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
        <button
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
            sidebarVisible ? "text-zinc-100 font-semibold" : "text-zinc-500"
          }`}
          type="button"
          onClick={() => onSidebarVisibleChange(!sidebarVisible)}
        >
          <MoreHorizontal size={19} />
          <span className="text-[10px] font-medium leading-none">Еще</span>
        </button>
      </nav>
    </>
  );
}
