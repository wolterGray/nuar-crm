import { memo, useCallback } from "react";
import RowActionMenuPortal from "../../RowActionMenuPortal.jsx";
import AppIcon from "../../ui/AppIcon.jsx";
import IconButton from "../../ui/IconButton.jsx";
import { useRowActionMenu } from "../../../hooks/useRowActionMenu.js";

function ClientRowActions({
  client,
  handleAddToWaitlist,
  handleMessageClient,
  onDeleteClient,
  onEditClient,
  openClientMenuId,
  setOpenClientMenuId,
  onSelectClient,
  isWorkspace = false,
}) {
  const isOpen = openClientMenuId === client.id;
  const { menuRef, menuStyle, triggerRef } = useRowActionMenu({
    isOpen,
    setOpenMenuId: setOpenClientMenuId,
  });

  const handleToggleMenu = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(openClientMenuId === client.id ? null : client.id);
  }, [openClientMenuId, client.id, setOpenClientMenuId]);

  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(null);
    onSelectClient?.(client);
  }, [client, onSelectClient, setOpenClientMenuId]);

  const handleMessage = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(null);
    handleMessageClient?.(client);
  }, [client, handleMessageClient, setOpenClientMenuId]);

  const handleAddWaitlist = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(null);
    handleAddToWaitlist?.(client);
  }, [client, handleAddToWaitlist, setOpenClientMenuId]);

  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(null);
    onEditClient?.(client);
  }, [client, onEditClient, setOpenClientMenuId]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setOpenClientMenuId(null);
    onDeleteClient?.(client);
  }, [client, onDeleteClient, setOpenClientMenuId]);

  return (
    <div
      className="relative flex items-center justify-end"
      onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        className="clients-row-menu-button opacity-70 hover:opacity-100 transition-opacity"
        icon="more"
        label="Действия"
        size="sm"
        variant="ghost"
        onClick={handleToggleMenu}
      />

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        <div className="clients-row-menu" role="menu">
          {isWorkspace ? (
            <>
              <button
                className="clients-row-menu-item"
                role="menuitem"
                type="button"
                onClick={handleAddWaitlist}>
                <AppIcon name="clock" size="xs" />
                <span>В лист ожидания</span>
              </button>
              <button
                className="clients-row-menu-item is-danger"
                role="menuitem"
                type="button"
                onClick={handleDelete}>
                <AppIcon name="trash" size="xs" />
                <span>Удалить клиента</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="clients-row-menu-item"
                role="menuitem"
                type="button"
                onClick={handleSelect}>
                <AppIcon name="user" size="xs" />
                <span>Профиль</span>
              </button>
              <button
                className="clients-row-menu-item"
                role="menuitem"
                type="button"
                onClick={handleMessage}>
                <AppIcon name="message" size="xs" />
                <span>Написать</span>
              </button>
              <button
                className="clients-row-menu-item"
                role="menuitem"
                type="button"
                onClick={handleAddWaitlist}>
                <AppIcon name="calendarPlus" size="xs" />
                <span>Записать</span>
              </button>
              <button
                className="clients-row-menu-item"
                role="menuitem"
                type="button"
                onClick={handleEdit}>
                <AppIcon name="edit" size="xs" />
                <span>Редактировать</span>
              </button>
              <button
                className="clients-row-menu-item is-danger"
                role="menuitem"
                type="button"
                onClick={handleDelete}>
                <AppIcon name="trash" size="xs" />
                <span>Удалить</span>
              </button>
            </>
          )}
        </div>
      </RowActionMenuPortal>
    </div>
  );
}

export default memo(ClientRowActions);
