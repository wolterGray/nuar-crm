import FormCheckbox from "./FormCheckbox.jsx";
import HintIcon, {FieldLabel, SettingsPanelHeading} from "./HintIcon.jsx";
import {Field, Input} from "./ui/index.js";

function SiteBookingNotifySettings({settings}) {
  return (
    <div className="site-booking-notify-settings">
      <SettingsPanelHeading
        hint="Telegram и WhatsApp/SMS владельцу при новой брони на nuarr.pl"
        icon="bell"
        title="Уведомления о заявках с сайта"
      />
      <div className="settings-options site-booking-notify-options">
        <Field
          className="site-notify-field"
          label={
            <FieldLabel hint="Напишите боту /start, затем возьмите id у @userinfobot или через getUpdates. Альтернатива: переменная TELEGRAM_CHAT_ID в backend/.env на Hetzner. После изменения нажмите «Сохранить настройки» внизу страницы.">
              Telegram Chat ID
            </FieldLabel>
          }>
          <Input
            name="telegramChatId"
            defaultValue={settings.telegramChatId ?? ""}
            placeholder="123456789"
          />
        </Field>

        <div className="site-notify-toggles">
          <FormCheckbox
            className="site-notify-toggle"
            defaultChecked={settings.siteBookingNotifyTelegramEnabled ?? true}
            name="siteBookingNotifyTelegramEnabled">
            <span className="labeled-hint-row labeled-hint-row-nowrap">
              Telegram при заявке с сайта
              <HintIcon>Мгновенное сообщение в чат владельца</HintIcon>
            </span>
          </FormCheckbox>
          <FormCheckbox
            className="site-notify-toggle"
            defaultChecked={settings.siteBookingNotifyWhatsappEnabled ?? true}
            name="siteBookingNotifyWhatsappEnabled">
            <span className="labeled-hint-row labeled-hint-row-nowrap">
              WhatsApp при заявке с сайта
              <HintIcon>
                Meta WhatsApp API или SMS на номер ниже, если WhatsApp API не настроен
              </HintIcon>
            </span>
          </FormCheckbox>
        </div>

        <Field
          className="site-notify-field"
          label={
            <FieldLabel hint="Backend env. Обязательно: TELEGRAM_BOT_TOKEN (от @BotFather). Опционально: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, SMSAPI_TOKEN">
              Телефон владельца для WhatsApp/SMS
            </FieldLabel>
          }>
          <Input
            name="ownerNotifyPhone"
            defaultValue={settings.ownerNotifyPhone ?? ""}
            inputMode="tel"
            placeholder="600123456"
          />
        </Field>
      </div>
    </div>
  );
}

export default SiteBookingNotifySettings;
