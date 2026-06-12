import {chromium} from "playwright";
import {booksyUrls, selectors} from "../config/selectors.js";
import {workerConfig} from "./supabaseClient.js";

const firstMatch = async (page, selectorList, action) => {
  const candidates = String(selectorList)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const selector of candidates) {
    const locator = page.locator(selector).first();

    try {
      if ((await locator.count()) > 0) {
        await action(locator, selector);
        return selector;
      }
    } catch {
      // try next selector candidate
    }
  }

  throw new Error(`Booksy selector not found: ${selectorList}`);
};

const loginToBooksy = async (page) => {
  await page.goto(workerConfig.booksyLoginUrl || booksyUrls.login, {
    waitUntil: "domcontentloaded",
  });

  await firstMatch(page, selectors.login.emailInput, async (locator) => {
    await locator.fill(workerConfig.booksyEmail);
  });

  await firstMatch(page, selectors.login.passwordInput, async (locator) => {
    await locator.fill(workerConfig.booksyPassword);
  });

  await firstMatch(page, selectors.login.submitButton, async (locator) => {
    await locator.click();
  });

  await page.waitForLoadState("networkidle", {timeout: 30000});
};

const openCalendar = async (page) => {
  if (workerConfig.booksyBusinessId) {
    // TODO: navigate to specific business/location if Booksy requires business switcher.
  }

  await page.goto(booksyUrls.calendar, {waitUntil: "domcontentloaded"});

  try {
    await firstMatch(page, selectors.navigation.calendarLink, async (locator) => {
      await locator.click();
    });
  } catch {
    // already on calendar
  }
};

const createVisitInBooksy = async (page, payload) => {
  await firstMatch(page, selectors.navigation.newAppointmentButton, async (locator) => {
    await locator.click();
  });

  if (payload.clientName) {
    await firstMatch(page, selectors.appointmentForm.clientNameInput, async (locator) => {
      await locator.fill(payload.clientName);
    });
  }

  if (payload.clientPhone) {
    await firstMatch(page, selectors.appointmentForm.clientPhoneInput, async (locator) => {
      await locator.fill(payload.clientPhone);
    });
  }

  if (payload.serviceName) {
    await firstMatch(page, selectors.appointmentForm.serviceInput, async (locator) => {
      await locator.fill(payload.serviceName);
    });
  }

  if (payload.masterName) {
    await firstMatch(page, selectors.appointmentForm.staffSelect, async (locator) => {
      await locator.fill(payload.masterName);
    });
  }

  if (payload.date) {
    await firstMatch(page, selectors.appointmentForm.dateInput, async (locator) => {
      await locator.fill(payload.date);
    });
  }

  if (payload.time) {
    await firstMatch(page, selectors.appointmentForm.timeInput, async (locator) => {
      await locator.fill(payload.time);
    });
  }

  if (payload.durationMinutes) {
    await firstMatch(page, selectors.appointmentForm.durationInput, async (locator) => {
      await locator.fill(String(payload.durationMinutes));
    });
  }

  if (payload.note) {
    await firstMatch(page, selectors.appointmentForm.noteInput, async (locator) => {
      await locator.fill(payload.note);
    });
  }

  await firstMatch(page, selectors.appointmentForm.saveButton, async (locator) => {
    await locator.click();
  });

  await page.waitForTimeout(1500);

  // TODO: parse real Booksy appointment ID from URL, toast or API response.
  const externalId = `booksy-demo-${payload.calendarEntryId}-${Date.now()}`;

  return {booksyExternalId: externalId};
};

export const runBooksyBot = async (job) => {
  const payload = job.payload ?? {};

  if (workerConfig.dryRun) {
    console.info("[booksy-worker] DRY_RUN enabled — skipping Playwright");
    return {
      booksyExternalId: `dry-run-${job.calendar_entry_id}`,
    };
  }

  const browser = await chromium.launch({headless: workerConfig.headless});
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginToBooksy(page);
    await openCalendar(page);
    return await createVisitInBooksy(page, payload);
  } finally {
    await browser.close();
  }
};
