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
  const clientNames = clients.map((client) =>
    typeof client === "string" ? client : client.name,
  );

  return (
    <>
      <input
        autoComplete="off"
        defaultValue={defaultValue}
        disabled={disabled}
        list={id}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        value={value}
      />
      <datalist id={id}>
        {clientNames.map((client) => (
          <option key={client} value={client} />
        ))}
      </datalist>
    </>
  );
}

export default ClientAutocomplete;
