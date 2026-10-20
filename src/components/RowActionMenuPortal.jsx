import {createPortal} from "react-dom";
import {useState} from "react";
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
  extraActions = [],
  itemId,
  onDelete,
  onEdit,
  onView,
  openMenuId,
  setOpenMenuId,
}) {
  const isOpen = openMenuId === itemId;
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const currentSubmenu = isOpen ? activeSubmenu : null;

  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });
  const runMenuAction = (event, action) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveSubmenu(null);
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
        onClick={() => {
          setActiveSubmenu(null);
          setOpenMenuId(openMenuId === itemId ? null : itemId);
        }}
      />

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        {currentSubmenu ? (
          <>
            <Button
              className="row-action-menu-item"
              fullWidth
              leftIcon="chevronLeft"
              size="sm"
              type="button"
              variant="ghost"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveSubmenu(null);
              }}>
              Назад
            </Button>
            <div className="row-action-submenu-title">
              {currentSubmenu.title || currentSubmenu.label}
            </div>
            {currentSubmenu.subActions?.map((sub) => (
              <Button
                className="row-action-menu-item"
                disabled={sub.disabled}
                fullWidth
                key={sub.label}
                leftIcon={sub.icon}
                size="sm"
                title={sub.title}
                type="button"
                variant="ghost"
                onPointerDown={(event) => runMenuAction(event, sub.onClick)}>
                {sub.label}
              </Button>
            ))}
          </>
        ) : (
          <>
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
            {extraActions.map((action) => (
              <Button
                className="row-action-menu-item"
                disabled={action.disabled}
                fullWidth
                key={action.label}
                leftIcon={action.icon}
                rightIcon={action.subActions?.length ? "chevronRight" : undefined}
                size="sm"
                title={action.title}
                type="button"
                variant="ghost"
                onPointerDown={(event) => {
                  if (action.subActions?.length) {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveSubmenu(action);
                  } else {
                    runMenuAction(event, action.onClick);
                  }
                }}>
                {action.label}
              </Button>
            ))}
            {onEdit ? (
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
            ) : null}
            {onDelete ? (
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
            ) : null}
          </>
        )}
      </RowActionMenuPortal>
    </div>
  );
}
