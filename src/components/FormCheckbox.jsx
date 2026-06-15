function FormCheckbox({
  boxClassName = "",
  checked,
  className = "",
  defaultChecked,
  labelClassName = "",
  name,
  onChange,
  value,
  children,
  disabled,
  ...props
}) {
  return (
    <label
      className={`form-checkbox ${className}${disabled ? " is-disabled" : ""}`.trim()}>
      <input
        className="form-checkbox-input"
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        name={name}
        type="checkbox"
        value={value}
        {...(checked === undefined ? {} : {checked})}
        onChange={onChange}
        {...props}
      />
      <span
        aria-hidden="true"
        className={`form-checkbox-box ${boxClassName}`.trim()}
      />
      {children != null ? (
        <span className={`form-checkbox-label ${labelClassName}`.trim()}>
          {children}
        </span>
      ) : null}
    </label>
  );
}

export default FormCheckbox;
