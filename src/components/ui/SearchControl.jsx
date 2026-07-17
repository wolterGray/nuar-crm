import {useEffect, useRef} from "react";
import AppIcon from "./AppIcon.jsx";
import IconButton from "./IconButton.jsx";

export default function SearchControl({
  className = "",
  placeholder = "Поиск",
  value,
  onChange,
  onClear,
  clearLabel = "Очистить поиск",
  ...props
}) {
  const showClear = Boolean(String(value ?? ""));
  const fieldRef = useRef(null);

  useEffect(() => {
    const field = fieldRef.current;

    if (field && field.textContent !== String(value ?? "")) {
      field.textContent = String(value ?? "");
    }
  }, [value]);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {value: nextValue},
      currentTarget: {value: nextValue},
    });
  };

  const handleInput = (event) => {
    emitChange(event.currentTarget.textContent ?? "");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  return (
    <label className={`crm-search-input-control ${className}`.trim()}>
      <AppIcon className="crm-search-input-icon" name="search" size="sm" />
      <span
        aria-label={placeholder}
        className="crm-search-input-value"
        contentEditable
        data-empty={showClear ? "false" : "true"}
        data-placeholder={placeholder}
        ref={fieldRef}
        role="searchbox"
        spellCheck="false"
        tabIndex={0}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {showClear ? (
        <IconButton
          aria-label={clearLabel}
          className="crm-search-input-clear"
          icon="x"
          label={clearLabel}
          size="sm"
          type="button"
          variant="ghost"
          onClick={onClear}
        />
      ) : (
        <span aria-hidden="true" className="crm-search-input-spacer" />
      )}
    </label>
  );
}
