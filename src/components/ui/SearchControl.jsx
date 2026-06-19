import {useEffect, useRef} from "react";
import {Search, X} from "lucide-react";

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
      <Search aria-hidden="true" className="crm-search-input-icon" size={16} />
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
        <button
          aria-label={clearLabel}
          className="crm-search-input-clear"
          type="button"
          onClick={onClear}>
          <X size={15} />
        </button>
      ) : (
        <span aria-hidden="true" className="crm-search-input-spacer" />
      )}
    </label>
  );
}
