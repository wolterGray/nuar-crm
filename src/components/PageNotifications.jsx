import {createContext, useContext} from "react";

const PageNotificationsContext = createContext(() => {});

export function PageNotificationsProvider({children, onSlotChange}) {
  return (
    <PageNotificationsContext.Provider value={onSlotChange}>
      {children}
    </PageNotificationsContext.Provider>
  );
}

export function PageNotificationsSlot() {
  const setSlot = useContext(PageNotificationsContext);

  return <div className="page-notifications-slot" ref={setSlot} />;
}
