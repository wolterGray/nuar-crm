import {useEffect, useMemo, useRef, useState} from "react";
import {searchClients} from "../utils/clientSearch.js";
import MobileSheet from "./MobileSheet.jsx";
import {AppIcon, Button, IconButton, Input} from "./ui/index.js";

function ClientSearchDialog({
  clients,
  isOpen,
  onClose,
  onMessageClient,
  onOpenClient,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(
    () =>
      searchClients({
        clients,
        limit: 8,
        query,
      }),
    [clients, query],
  );
  const activeResultIndex =
    results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setActiveIndex(0);
  };

  const handleSelect = (client) => {
    onOpenClient?.(client);
  };

  const handleKeyDown = (event) => {
    if (results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const client = results[activeResultIndex];

      if (client) {
        handleSelect(client);
      }
    }
  };

  const shortcutLabel =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform)
      ? "⌘K"
      : "Ctrl+K";

  return (
    <MobileSheet
      className="client-search-sheet"
      fullscreen
      isOpen={isOpen}
      labelledBy="client-search-title"
      title="Поиск клиентов"
      onClose={onClose}
      footer={
        <div className="client-search-footer">
          <span>
            <AppIcon name="arrowUpDown" size="xs" />
            выбор
          </span>
          <span>Enter открыть</span>
          <span>Esc закрыть</span>
          <span>{shortcutLabel}</span>
        </div>
      }>
      <div className="client-search-header" onKeyDown={handleKeyDown}>
        <AppIcon name="search" size="sm" />
        <Input
          ref={inputRef}
          autoComplete="off"
          placeholder="Имя, телефон, email, Telegram…"
          spellCheck={false}
          type="search"
          value={query}
          onChange={handleQueryChange}
        />
      </div>

      <div className="client-search-results">
        {query.trim() && results.length === 0 ? (
          <p className="client-search-empty">Клиенты не найдены</p>
        ) : null}

        {!query.trim() ? (
          <p className="client-search-empty">
            Начните вводить имя, телефон или контакт
          </p>
        ) : null}

        <ul>
          {results.map((client, index) => (
            <li
              className={`client-search-item ${
                index === activeResultIndex ? "active" : ""
              }`}
              key={client.id}
              onMouseEnter={() => setActiveIndex(index)}>
              <Button
                className="client-search-row"
                type="button"
                variant="ghost"
                onClick={() => handleSelect(client)}>
                <span className="client-search-avatar">
                  <AppIcon name="user" size="sm" />
                </span>
                <span className="client-search-copy">
                  <strong>{client.name}</strong>
                  <small>
                    {client.phone || "—"}
                    {client.lastVisit && client.lastVisit !== "—"
                      ? ` · последний визит ${client.lastVisit}`
                      : ""}
                  </small>
                </span>
                <AppIcon name="chevronRight" size="sm" />
              </Button>
              <IconButton
                className="client-search-message"
                icon="message"
                label={`Написать ${client.name}`}
                size="sm"
                variant="secondary"
                onClick={() => onMessageClient?.(client)}>
              </IconButton>
            </li>
          ))}
        </ul>
      </div>
    </MobileSheet>
  );
}

export default ClientSearchDialog;
