import {CalendarPlus, MessageSquareText, X} from "lucide-react";
import {formatWaitlistSlotLabel, summarizeWaitlistEntry} from "../utils/waitlist.js";

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
          <button aria-label="Закрыть" type="button" onClick={onClose}>
            <X size={18} />
          </button>
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
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onMessage?.(entry, slot)}>
                      <MessageSquareText size={14} />
                      Написать
                    </button>
                    <button
                      className="add-visit-button"
                      type="button"
                      onClick={() => onBook?.(entry, slot)}>
                      <CalendarPlus size={14} />
                      Записать
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </footer>
      </section>
    </div>
  );
}

export default WaitlistFreedSlotDialog;
