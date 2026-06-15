import FormCheckbox from "./FormCheckbox.jsx";

function SettingsToggle({defaultChecked, name, children}) {
  const label =
    typeof children === "string" ? (
      <span className="labeled-hint-row labeled-hint-row-nowrap">{children}</span>
    ) : (
      children
    );

  return (
    <FormCheckbox
      className="settings-toggle site-notify-toggle"
      defaultChecked={defaultChecked}
      name={name}>
      {label}
    </FormCheckbox>
  );
}

export default SettingsToggle;
