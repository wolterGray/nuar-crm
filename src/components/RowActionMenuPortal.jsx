import {createPortal} from "react-dom";
import {useRowActionMenu} from "../hooks/useRowActionMenu.js";
import {Button, IconButton} from "./ui/index.js";

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
  onView,
  openMenuId,
  setOpenMenuId,
}) {
  const isOpen = openMenuId === itemId;
  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });
  const runMenuAction = (event, action) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenMenuId(null);
    window.setTimeout(() => action?.(), 0);
  };

  return (
    <div
      className={`row-actions row-action-trigger-wrap client-row-actions${className ? ` ${className}` : ""}`}
      onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        className="row-action row-action-trigger"
        icon="more"
        label="Действия"
        type="button"
        onClick={() =>
          setOpenMenuId(openMenuId === itemId ? null : itemId)
        }
      />

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        {onView ? (
          <Button
            className="row-action-menu-item"
            fullWidth
            leftIcon="eye"
            size="sm"
            type="button"
            variant="ghost"
            onPointerDown={(event) => runMenuAction(event, onView)}>
            Посмотреть
          </Button>
        ) : null}
        <Button
          className="row-action-menu-item"
          fullWidth
          leftIcon="edit"
          size="sm"
          type="button"
          variant="ghost"
          onPointerDown={(event) => runMenuAction(event, onEdit)}>
          Редактировать
        </Button>
        <Button
          className="danger row-action-menu-item"
          fullWidth
          leftIcon="trash"
          size="sm"
          type="button"
          variant="ghost"
          onPointerDown={(event) => runMenuAction(event, onDelete)}>
          Удалить
        </Button>
      </RowActionMenuPortal>
    </div>
  );
}
