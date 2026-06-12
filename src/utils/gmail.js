const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GMAIL_TOKEN_STORAGE_KEY = "nuar-crm-gmail-access-token";

let identityScriptPromise;

export const getStoredGmailAccessToken = () => {
  try {
    return sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const storeGmailAccessToken = (token = "") => {
  try {
    if (token) {
      sessionStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, token);
      return;
    }

    sessionStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};

export const clearStoredGmailAccessToken = () => {
  storeGmailAccessToken("");
};

const loadIdentityScript = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (identityScriptPromise) return identityScriptPromise;

  identityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Не удалось загрузить Google Identity Services"));
    document.head.append(script);
  });

  return identityScriptPromise;
};

export const requestGmailAccessToken = async (
  clientId,
  {prompt = "consent"} = {},
) => {
  const trimmedClientId = String(clientId ?? "").trim();

  if (!trimmedClientId) {
    throw new Error("Укажите Google OAuth Client ID в настройках CRM");
  }

  await loadIdentityScript();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: trimmedClientId,
      scope: GMAIL_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        storeGmailAccessToken(response.access_token);
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Подключение Gmail отменено")),
    });

    tokenClient.requestAccessToken({prompt});
  });
};

const decodeBase64Url = (value = "") => {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(normalized);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
};

const htmlToText = (html) => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("br, p, div, tr, li").forEach((element) => {
    element.append("\n");
  });
  return parsed.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
};

const extractPayload = (payload) => {
  const textParts = [];
  const htmlParts = [];
  const attachments = [];

  const visit = (part) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size ?? 0,
      });
    }

    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") textParts.push(decoded);
      if (part.mimeType === "text/html") htmlParts.push(decoded);
    }

    part.parts?.forEach(visit);
  };

  visit(payload);

  return {
    attachments,
    text: textParts.join("\n").trim() || htmlToText(htmlParts.join("\n")),
  };
};

const getHeader = (headers, name) =>
  headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";

const buildGmailApiError = async (response) => {
  let detail = "";

  try {
    const body = await response.json();
    detail =
      body?.error?.message ??
      body?.error?.errors?.[0]?.message ??
      body?.message ??
      "";
  } catch {
    // ignore parse errors
  }

  if (response.status === 403) {
    return new Error(
      [
        "Gmail API: нет доступа (403).",
        "1) В Google Cloud включите Gmail API.",
        "2) В OAuth добавьте scope gmail.readonly.",
        "3) В CRM → Настройки укажите OAuth Client ID (Web).",
        "4) В Client ID добавьте origin https://nuar-crm.vercel.app",
        detail ? `Google: ${detail}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return new Error(
    detail ? `Gmail API: ${response.status} — ${detail}` : `Gmail API: ${response.status}`,
  );
};

const gmailFetch = async (accessToken, path) => {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (!response.ok) {
    throw await buildGmailApiError(response);
  }

  return response.json();
};

const fetchGmailMessageList = async (accessToken, query) => {
  const searchQuery = encodeURIComponent(query);
  const list = await gmailFetch(accessToken, `messages?q=${searchQuery}&maxResults=100`);

  return Promise.all(
    (list.messages ?? []).map(async ({id}) => {
      const message = await gmailFetch(accessToken, `messages/${id}?format=full`);
      const content = extractPayload(message.payload);
      const headers = message.payload.headers ?? [];

      return {
        id,
        threadId: message.threadId,
        from: getHeader(headers, "From"),
        messageId: getHeader(headers, "Message-ID"),
        subject: getHeader(headers, "Subject"),
        receivedAt: new Date(Number(message.internalDate)).toISOString(),
        ...content,
      };
    }),
  );
};

export const resolveGmailAccessToken = async ({
  clientId = "",
  providerAccessToken = "",
  forceRefresh = false,
} = {}) => {
  const storedToken = getStoredGmailAccessToken();
  const trimmedClientId = String(clientId ?? "").trim();

  if (!forceRefresh && storedToken) {
    return storedToken;
  }

  if (trimmedClientId) {
    return requestGmailAccessToken(trimmedClientId, {
      prompt: forceRefresh ? "consent" : "consent",
    });
  }

  if (providerAccessToken) {
    try {
      await gmailFetch(providerAccessToken, "profile");
      storeGmailAccessToken(providerAccessToken);
      return providerAccessToken;
    } catch (error) {
      if (error instanceof Error && error.message.includes("403")) {
        throw error;
      }
      throw error;
    }
  }

  throw new Error(
    "Подключите Gmail: укажите Google OAuth Client ID в настройках CRM и нажмите «Подключить Gmail».",
  );
};

export const syncGmailMessages = async (clientId = "", providerAccessToken = "", query) => {
  const searchQuery =
    query ??
    "newer_than:120d (from:(booksy.com) OR from:(allegro.pl) OR from:(ipos.pl) OR filename:pdf)";

  let accessToken = await resolveGmailAccessToken({
    clientId,
    providerAccessToken,
  });

  try {
    const messages = await fetchGmailMessageList(accessToken, searchQuery);
    return messages.sort((first, second) => first.receivedAt.localeCompare(second.receivedAt));
  } catch (error) {
    if (
      String(clientId ?? "").trim() &&
      error instanceof Error &&
      error.message.includes("403")
    ) {
      clearStoredGmailAccessToken();
      accessToken = await requestGmailAccessToken(String(clientId).trim(), {
        prompt: "consent",
      });
      const messages = await fetchGmailMessageList(accessToken, searchQuery);
      return messages.sort((first, second) => first.receivedAt.localeCompare(second.receivedAt));
    }

    throw error;
  }
};
