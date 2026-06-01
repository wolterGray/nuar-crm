const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

let identityScriptPromise;

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

const requestToken = async (clientId) => {
  await loadIdentityScript();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Подключение Gmail отменено")),
    });

    tokenClient.requestAccessToken({prompt: ""});
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

const gmailFetch = async (accessToken, path) => {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (!response.ok) throw new Error(`Gmail API: ${response.status}`);
  return response.json();
};

export const syncGmailMessages = async (clientId) => {
  if (!clientId.trim()) throw new Error("Сначала укажите Google OAuth Client ID в настройках");

  const accessToken = await requestToken(clientId.trim());
  const query = encodeURIComponent(
    "newer_than:120d (from:(booksy.com) OR from:(allegro.pl) OR from:(ipos.pl) OR filename:pdf)",
  );
  const list = await gmailFetch(accessToken, `messages?q=${query}&maxResults=100`);
  const messages = await Promise.all(
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

  return messages.sort((first, second) => first.receivedAt.localeCompare(second.receivedAt));
};
