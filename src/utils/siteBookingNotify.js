export const formatSiteBookingOwnerMessage = (booking = {}) => {
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
