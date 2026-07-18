import {useMemo, useState} from "react";
import {Button, Input} from "./ui/index.js";

function ClientAutocomplete({
  clients,
  disabled = false,
  id,
  name = "client",
  placeholder = "Начните вводить имя",
  required = false,
  value,
  defaultValue,
  onChange,
}) {
  const [inputValue, setInputValue] = useState(value ?? defaultValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isControlled = value !== undefined;
  const displayValue = isControlled ? (value ?? "") : inputValue;

  const clientNames = useMemo(
    () =>
      [...new Set(
        clients
          .map((client) => (typeof client === "string" ? client : client.name))
          .filter(Boolean),
      )],
    [clients],
  );

  const visibleClients = useMemo(() => {
    const query = String(displayValue ?? "").trim().toLowerCase();

    if (!query) {
      return clientNames.slice(0, 8);
    }

    return clientNames
      .filter((client) => client.toLowerCase().includes(query))
      .slice(0, 8);
  }, [clientNames, displayValue]);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
      currentTarget: {
        name,
        value: nextValue,
      },
    });
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;

    if (!isControlled) {
      setInputValue(nextValue);
    }

    setIsOpen(true);
    setActiveIndex(-1);
    onChange?.(event);
  };

  const selectClient = (client) => {
    if (!isControlled) {
      setInputValue(client);
    }

    emitChange(client);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen || visibleClients.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleClients.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? visibleClients.length - 1 : current - 1,
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectClient(visibleClients[activeIndex]);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="client-autocomplete relative w-full">
      <Input
        aria-autocomplete="list"
        aria-controls={id}
        aria-expanded={isOpen && visibleClients.length > 0}
        autoComplete="off"
        disabled={disabled}
        name={name}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        role="combobox"
        value={displayValue}
      />
      {isOpen && visibleClients.length > 0 && !disabled && (
        <div
          className="client-autocomplete-listbox"
          id={id}
          role="listbox">
          {visibleClients.map((client, index) => (
            <Button
              aria-selected={index === activeIndex}
              className={`client-autocomplete-option ${
                index === activeIndex
                  ? "is-active"
                  : ""
              }`}
              fullWidth
              key={client}
              size="sm"
              variant="ghost"
              onMouseDown={(event) => {
                event.preventDefault();
                selectClient(client);
              }}
              type="button">
              {client}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientAutocomplete;
