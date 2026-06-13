import {
  getTelegramChatId,
  isTelegramConfigured,
  sendTelegramMessage,
} from "./telegram.ts";
import {isSmsConfigured, sendSms} from "./smsapi.ts";
import {getOwnerNotifyPhone, isWhatsappConfigured, sendWhatsappMessage} from "./whatsapp.ts";

export type SiteBookingNotificationPayload = {
  clientEmail?: string;
  clientName: string;
  clientPhone: string;
  durationMinutes: number;
  note?: string;
  preferredDate: string;
  preferredMaster?: string;
  preferredTime: string;
  serviceName: string;
};

export const formatSiteBookingOwnerMessage = (
  booking: SiteBookingNotificationPayload,
) => {
  const [year, month, day] = String(booking.preferredDate ?? "").split("-");
  const dateLabel =
    year && month && day ? `${day}.${month}.${year}` : booking.preferredDate;
  const timeLabel = String(booking.preferredTime ?? "").slice(0, 5);
  const lines = [
    "Nowa rezerwacja z nuarr.pl",
    "",
    booking.clientName,
    booking.clientPhone,
  ];

  if (booking.clientEmail) {
    lines.push(booking.clientEmail);
  }

  lines.push(`${dateLabel} · ${timeLabel}`);
  lines.push(`${booking.serviceName} · ${booking.durationMinutes} min`);

  if (booking.preferredMaster) {
    lines.push(`Master: ${booking.preferredMaster}`);
  }

  if (booking.note) {
    lines.push(`Uwagi: ${booking.note}`);
  }

  lines.push("", "CRM -> Site -> Zgloszenia");

  return lines.join("\n");
};

export const notifyOwnerAboutSiteBooking = async ({
  appSettings = {},
  booking,
}: {
  appSettings?: Record<string, unknown>;
  booking: SiteBookingNotificationPayload;
}) => {
  const message = formatSiteBookingOwnerMessage(booking);
  const results: Record<string, {ok: boolean; error?: string}> = {};

  if (appSettings.siteBookingNotifyTelegramEnabled !== false) {
    const chatId = getTelegramChatId(appSettings);

    if (!isTelegramConfigured()) {
      results.telegram = {
        ok: false,
        error: "TELEGRAM_BOT_TOKEN is not configured",
      };
    } else if (!chatId) {
      results.telegram = {
        ok: false,
        error: "Telegram chat id is not configured",
      };
    } else {
      results.telegram = await sendTelegramMessage({chatId, message});
    }
  }

  if (appSettings.siteBookingNotifyWhatsappEnabled !== false) {
    const ownerPhone = getOwnerNotifyPhone(appSettings);

    if (ownerPhone) {
      if (isWhatsappConfigured()) {
        results.whatsapp = await sendWhatsappMessage({message, to: ownerPhone});
      } else if (isSmsConfigured()) {
        results.whatsapp = await sendSms({
          from: String(appSettings.smsSenderName ?? ""),
          message,
          to: ownerPhone,
        });
      } else {
        results.whatsapp = {
          ok: false,
          error: "WhatsApp API or SMSAPI is not configured",
        };
      }
    }
  }

  return results;
};
