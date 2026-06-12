/**
 * Booksy Pro UI selectors.
 *
 * TODO: Replace placeholder selectors with real ones from your Booksy account.
 * Recommended workflow:
 * 1. Run worker with BOOKSY_HEADLESS=0
 * 2. Use Playwright codegen against Booksy Pro calendar
 * 3. Paste stable selectors here
 */
export const selectors = {
  login: {
    emailInput: 'input[type="email"], input[name="email"], #email',
    passwordInput: 'input[type="password"], input[name="password"], #password',
    submitButton: 'button[type="submit"], button:has-text("Log in"), button:has-text("Zaloguj")',
  },
  navigation: {
    calendarLink: 'a[href*="calendar"], nav >> text=Calendar, nav >> text=Kalendarz',
    newAppointmentButton:
      'button:has-text("New appointment"), button:has-text("Nowa wizyta"), button:has-text("Dodaj")',
    blockTimeButton:
      'button:has-text("Block time"), button:has-text("Zablokuj"), button:has-text("Blokada")',
  },
  appointmentForm: {
    clientNameInput: 'input[name="clientName"], input[placeholder*="Client"], input[placeholder*="Klient"]',
    clientPhoneInput: 'input[type="tel"], input[name="phone"], input[placeholder*="Phone"]',
    serviceInput: 'input[placeholder*="Service"], input[placeholder*="Usługa"], [data-testid="service-select"]',
    staffSelect: 'select[name="staff"], [data-testid="staff-select"], input[placeholder*="Staff"]',
    dateInput: 'input[type="date"], input[name="date"]',
    timeInput: 'input[type="time"], input[name="time"]',
    durationInput: 'input[name="duration"], input[placeholder*="Duration"], input[placeholder*="Czas"]',
    noteInput: 'textarea[name="note"], textarea[placeholder*="Note"], textarea[placeholder*="Notatka"]',
    saveButton:
      'button:has-text("Save"), button:has-text("Zapisz"), button:has-text("Create"), button:has-text("Utwórz")',
    successToast: '[role="alert"], .toast, .notification-success',
  },
};

export const booksyUrls = {
  login: "https://booksy.com/pro/login",
  calendar: "https://booksy.com/pro/calendar",
};
