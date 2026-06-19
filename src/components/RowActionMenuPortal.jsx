import {createPortal} from "react-dom";
import {MoreVertical, Pencil, Trash2} from "lucide-react";
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";

const MENU_WIDTH = 156;

function getPortalRoot() {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector(".crm-shell") ?? document.body;
}

export function useRowActionMenu({isOpen, setOpenMenuId}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 76;
    let top = rect.top;
    let left = rect.left - MENU_WIDTH - 4;

    if (left < 8) {
      left = rect.right - MENU_WIDTH;
    }

    if (top + menuHeight > window.innerHeight - 12) {
      top = rect.top - menuHeight - 6;
    }

    if (top < 8) {
      top = rect.bottom + 6;
    }

    top = Math.max(8, top);
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));

    setMenuStyle({
      left: `${left}px`,
      minWidth: `${MENU_WIDTH}px`,
      top: `${top}px`,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    updateMenuPosition();
    return undefined;
  }, [isOpen, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) {
      return undefined;
    }

    updateMenuPosition();
    return undefined;
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updateMenuPosition();

    const closeMenu = (event) => {
      const target = event.target;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpenMenuId(null);
    };

    const handleLayoutChange = () => updateMenuPosition();

    document.addEventListener("pointerdown", closeMenu);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [isOpen, setOpenMenuId, updateMenuPosition]);

  return {menuRef, menuStyle, triggerRef};
}

export default function RowActionMenuPortal({children, isOpen, menuRef, menuStyle}) {
  if (!isOpen || !menuStyle) {
    return null;
  }

  const portalRoot = getPortalRoot();
  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="row-action-menu row-action-menu-portal"
      style={menuStyle}>
      {children}
    </div>,
    portalRoot,
  );
}

export function RowActionsMenu({
  className = "",
  itemId,
  onDelete,
  onEdit,
  openMenuId,
  setOpenMenuId,
}) {
  const isOpen = openMenuId === itemId;
  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });

  return (
    <div
      className={`row-actions row-action-trigger-wrap client-row-actions${className ? ` ${className}` : ""}`}
      onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        aria-label="Действия"
        aria-expanded={isOpen}
        className="row-action row-action-trigger"
        type="button"
        onClick={() =>
          setOpenMenuId(openMenuId === itemId ? null : itemId)
        }>
        <MoreVertical size={18} />
      </button>

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        <button
          type="button"
          onClick={() => {
            setOpenMenuId(null);
            onEdit();
          }}>
          <Pencil size={15} />
          Редактировать
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenMenuId(null);
            onDelete();
          }}>
          <Trash2 size={15} />
          Удалить
        </button>
      </RowActionMenuPortal>
    </div>
  );
}
