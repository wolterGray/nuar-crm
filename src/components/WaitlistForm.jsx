import {useState} from "react";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {FieldLabel} from "./HintIcon.jsx";
import {findClientByName} from "../utils/clientLinks.js";
import {summarizeWaitlistEntry} from "../utils/waitlist.js";

function getInitialClientName(clientProfiles, defaults, editingEntry) {
  if (editingEntry?.clientName) {
    return editingEntry.clientName;
  }

  if (defaults?.clientId) {
    return (
      clientProfiles.find(
        (client) => String(client.id) === String(defaults.clientId),
      )?.name ?? ""
    );
  }

  return defaults?.clientName ?? "";
}

function WaitlistForm({
  clientProfiles,
  defaults = null,
  editingEntry = null,
  employees = [],
  serviceCatalog = [],
  onClose,
  onSubmit,
}) {
  const [clientName, setClientName] = useState(() =>
    getInitialClientName(clientProfiles, defaults, editingEntry),
  );
  const [preferredDate, setPreferredDate] = useState(
    editingEntry?.preferredDate ?? defaults?.preferredDate ?? "",
  );
  const [preferredMaster, setPreferredMaster] = useState(
    editingEntry?.preferredMaster ?? defaults?.preferredMaster ?? "",
  );
  const [preferredService, setPreferredService] = useState(
    editingEntry?.preferredService ?? defaults?.preferredService ?? "",
  );
  const [preferredTimeFrom, setPreferredTimeFrom] = useState(
    editingEntry?.preferredTimeFrom ?? defaults?.preferredTimeFrom ?? "",
  );
  const [preferredTimeTo, setPreferredTimeTo] = useState(
    editingEntry?.preferredTimeTo ?? defaults?.preferredTimeTo ?? "",
  );
  const [note, setNote] = useState(editingEntry?.note ?? defaults?.note ?? "");

  const handleSubmit = (event) => {
    event.preventDefault();
    const client = findClientByName(clientProfiles, clientName);

    onSubmit?.({
      client,
      note,
      preferredDate,
      preferredMaster,
      preferredService,
      preferredTimeFrom,
      preferredTimeTo,
    });
  };

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <label>
        Клиент
        <ClientAutocomplete
          clients={clientProfiles}
          disabled={Boolean(editingEntry)}
          id="waitlist-client-options"
          required={!editingEntry}
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
        />
      </label>
      <label>
        <FieldLabel hint="Пусто — любая дата">Предпочитаемая дата</FieldLabel>
        <input
          type="date"
          value={preferredDate}
          onChange={(event) => setPreferredDate(event.target.value)}
        />
      </label>
      <label>
        Мастер
        <select
          value={preferredMaster}
          onChange={(event) => setPreferredMaster(event.target.value)}>
          <option value="">Любой мастер</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.name}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Услуга
        <select
          value={preferredService}
          onChange={(event) => setPreferredService(event.target.value)}>
          <option value="">Любая услуга</option>
          {serviceCatalog.map((service) => (
            <option key={service.id} value={service.name}>
              {service.name}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-options-grid">
        <label>
          Время от
          <input
            type="time"
            value={preferredTimeFrom}
            onChange={(event) => setPreferredTimeFrom(event.target.value)}
          />
        </label>
        <label>
          Время до
          <input
            type="time"
            value={preferredTimeTo}
            onChange={(event) => setPreferredTimeTo(event.target.value)}
          />
        </label>
      </div>
      <label>
        Заметка
        <textarea
          rows="3"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {editingEntry ? (
        <p className="field-hint">Текущие пожелания: {summarizeWaitlistEntry(editingEntry)}</p>
      ) : null}
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Отмена
        </button>
        <button className="add-visit-button" type="submit">
          {editingEntry ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </form>
  );
}

export default WaitlistForm;
