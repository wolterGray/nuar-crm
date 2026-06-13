import {BellRing} from "lucide-react";

function SiteBookingNotifySettings({settings}) {
  return (
    <div className="site-booking-notify-settings">
      <div className="settings-panel-heading">
        <BellRing size={18} />
        <div>
          <h2>Уведомления о заявках с сайта</h2>
          <p>Telegram и WhatsApp/SMS владельцу при новой брони на nuarr.pl</p>
        </div>
      </div>
      <div className="settings-options">
        <label>
          Telegram Chat ID
          <input
            name="telegramChatId"
            defaultValue={settings.telegramChatId ?? ""}
            placeholder="123456789"
          />
          <small>
            Напишите боту /start, затем возьмите id у @userinfobot или через getUpdates.
            Альтернатива: Supabase Secret TELEGRAM_CHAT_ID. После изменения нажмите
            «Сохранить настройки» внизу страницы.
          </small>
        </label>
        <label className="toggle-row">
          <input
            name="siteBookingNotifyTelegramEnabled"
            type="checkbox"
            defaultChecked={settings.siteBookingNotifyTelegramEnabled ?? true}
          />
          <span>
            Telegram при заявке с сайта
            <small>Мгновенное сообщение в чат владельца</small>
          </span>
        </label>
        <label className="toggle-row">
          <input
            name="siteBookingNotifyWhatsappEnabled"
            type="checkbox"
            defaultChecked={settings.siteBookingNotifyWhatsappEnabled ?? true}
          />
          <span>
            WhatsApp при заявке с сайта
            <small>
              Meta WhatsApp API или SMS на номер ниже, если WhatsApp API не настроен
            </small>
          </span>
        </label>
        <label>
          Телефон владельца для WhatsApp/SMS
          <input
            name="ownerNotifyPhone"
            defaultValue={settings.ownerNotifyPhone ?? ""}
            inputMode="tel"
            placeholder="600123456"
          />
          <small>
            Supabase Secrets: TELEGRAM_BOT_TOKEN, WHATSAPP_ACCESS_TOKEN,
            WHATSAPP_PHONE_NUMBER_ID или SMSAPI_TOKEN
          </small>
        </label>
      </div>
    </div>
  );
}

export default SiteBookingNotifySettings;
