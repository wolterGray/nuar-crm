import {booksySync} from "../../api/functions.js";

const serverBooksyUnavailable = () => {
  throw new Error("Серверный Booksy Gmail Sync на Hetzner пока не подключён");
};

export const areBooksyGmailFunctionsAvailable = async () => false;

export const fetchBooksyGmailDashboard = async () => ({
  connection: null,
  parseErrors: [],
  pendingEvents: [],
});

export const startBooksyGmailOAuth = async (returnUrl = window.location.href) => {
  void returnUrl;
  return serverBooksyUnavailable();
};

export const disconnectBooksyGmail = async () => serverBooksyUnavailable();

export const runBooksyGmailSync = async ({employees = [], services = []} = {}) => {
  const data = await booksySync({employees, services});
  return {data, error: null};
};

export const logBooksyGmailDecision = async ({
  action,
  details = {},
  eventId,
  linkedCalendarEntryId = null,
}) => {
  void action;
  void details;
  void eventId;
  void linkedCalendarEntryId;
  return {skipped: true, success: true};
};
