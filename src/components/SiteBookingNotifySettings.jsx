import {BellRing} from "lucide-react";
import HintIcon, {FieldLabel, SettingsPanelHeading} from "./HintIcon.jsx";

function SiteBookingNotifySettings({settings}) {
  return (
    <div className="site-booking-notify-settings">
      <SettingsPanelHeading
        hint="Telegram и WhatsApp/SMS владельцу при новой брони на nuarr.pl"
        icon={BellRing}
        title="Уведомления о заявках с сайта"
      />
      <div className="settings-options">
        <label>
          <FieldLabel hint="Напишите боту /start, затем возьмите id у @userinfobot или через getUpdates. Альтернатива: Supabase Secret TELEGRAM_CHAT_ID. После изменения нажмите «Сохранить настройки» внизу страницы.">
            Telegram Chat ID
          </FieldLabel>
          <input
            name="telegramChatId"
            defaultValue={settings.telegramChatId ?? ""}
            placeholder="123456789"
          />
        </label>
        <label className="toggle-row">
          <input
            name="siteBookingNotifyTelegramEnabled"
            type="checkbox"
            defaultChecked={settings.siteBookingNotifyTelegramEnabled ?? true}
          />
          <span className="labeled-hint-row">
            Telegram при заявке с сайта
            <HintIcon>Мгновенное сообщение в чат владельца</HintIcon>
          </span>
        </label>
        <label className="toggle-row">
          <input
            name="siteBookingNotifyWhatsappEnabled"
            type="checkbox"
            defaultChecked={settings.siteBookingNotifyWhatsappEnabled ?? true}
          />
          <span className="labeled-hint-row">
            WhatsApp при заявке с сайта
            <HintIcon>
              Meta WhatsApp API или SMS на номер ниже, если WhatsApp API не настроен
            </HintIcon>
          </span>
        </label>
        <label>
          <FieldLabel hint="Supabase → Project Settings → Edge Functions → Secrets. Обязательно: TELEGRAM_BOT_TOKEN (от @BotFather). Опционально: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, SMSAPI_TOKEN">
            Телефон владельца для WhatsApp/SMS
          </FieldLabel>
          <input
            name="ownerNotifyPhone"
            defaultValue={settings.ownerNotifyPhone ?? ""}
            inputMode="tel"
            placeholder="600123456"
          />
        </label>
      </div>
    </div>
  );
}

export default SiteBookingNotifySettings;
