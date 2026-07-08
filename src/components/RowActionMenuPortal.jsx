import {createPortal} from "react-dom";
import {MoreVertical, Pencil, Trash2} from "lucide-react";
import {useRowActionMenu} from "../hooks/useRowActionMenu.js";

function getPortalRoot() {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector(".crm-shell") ?? document.body;
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
