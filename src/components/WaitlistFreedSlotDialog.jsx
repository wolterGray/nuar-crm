import {formatWaitlistSlotLabel, summarizeWaitlistEntry} from "../utils/waitlist.js";
import {Button, IconButton} from "./ui/index.js";

function WaitlistFreedSlotDialog({
  buildOfferMessage,
  matches = [],
  slot,
  onBook,
  onClose,
  onMessage,
}) {
  if (!slot || matches.length === 0) {
    return null;
  }

  return (
    <div className="modal-backdrop waitlist-freed-backdrop">
      <section className="modal waitlist-freed-dialog" role="dialog">
        <header className="modal-header">
          <div>
            <h2>Освободился слот</h2>
            <p>{formatWaitlistSlotLabel(slot)}</p>
          </div>
          <IconButton
            icon="x"
            label="Закрыть"
            size="sm"
            type="button"
            variant="ghost"
            onClick={onClose}
          />
        </header>
        <div className="waitlist-freed-list">
          <strong>Подходят из листа ожидания ({matches.length})</strong>
          <ul>
            {matches.map((entry) => (
              <li key={entry.id}>
                <div className="waitlist-freed-item">
                  <div>
                    <strong>{entry.clientName}</strong>
                    <span>{summarizeWaitlistEntry(entry)}</span>
                    <small>{buildOfferMessage?.(entry, slot)}</small>
                  </div>
                  <div className="waitlist-freed-actions">
                    <Button
                      leftIcon="message"
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => onMessage?.(entry, slot)}>
                      Написать
                    </Button>
                    <Button
                      leftIcon="calendarPlus"
                      size="sm"
                      type="button"
                      variant="primary"
                      onClick={() => onBook?.(entry, slot)}>
                      Записать
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <footer className="modal-actions">
          <Button size="sm" type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </footer>
      </section>
    </div>
  );
}

export default WaitlistFreedSlotDialog;
