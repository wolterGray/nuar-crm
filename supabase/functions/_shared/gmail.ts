const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const getGoogleOAuthConfig = () => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const redirectUri =
    Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/booksy-gmail-oauth`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  return {clientId, clientSecret, redirectUri};
};

export const buildGoogleAuthUrl = (state: string) => {
  const {clientId, redirectUri} = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const exchangeGoogleCode = async (code: string) => {
  const {clientId, clientSecret, redirectUri} = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
};

export const refreshGoogleAccessToken = async (refreshToken: string) => {
  const {clientId, clientSecret} = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    scope: string;
  }>;
};

export const fetchGmailProfile = async (accessToken: string) => {
  const response = await fetch(`${GMAIL_API}/profile`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{emailAddress: string}>;
};

export const listGmailMessages = async (
  accessToken: string,
  query: string,
  maxResults = 100,
) => {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const response = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json() as {messages?: Array<{id: string}>};
  return payload.messages ?? [];
};

export const fetchGmailMessage = async (accessToken: string, messageId: string) => {
  const response = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<Record<string, unknown>>;
};

export const ensureFreshAccessToken = async (
  connection: {
    access_token?: string | null;
    refresh_token: string;
    token_expires_at?: string | null;
  },
) => {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const isExpired = !connection.access_token || Date.now() >= expiresAt - 60_000;

  if (!isExpired) {
    return {
      accessToken: connection.access_token as string,
      expiresAt: connection.token_expires_at,
    };
  }

  const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
  const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  return {
    accessToken: refreshed.access_token,
    expiresAt: nextExpiresAt,
  };
};
