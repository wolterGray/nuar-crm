import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {corsHeaders, handleOptions, jsonResponse} from "../_shared/cors.ts";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGmailProfile,
} from "../_shared/gmail.ts";

const encodeState = (payload: Record<string, unknown>) =>
  btoa(JSON.stringify(payload));

const decodeState = (value: string) => {
  try {
    return JSON.parse(atob(value)) as {
      userId: string;
      returnUrl?: string;
    };
  } catch {
    return null;
  }
};

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  const url = new URL(request.url);

  if (request.method === "GET" && url.searchParams.get("code")) {
    const code = url.searchParams.get("code") ?? "";
    const state = decodeState(url.searchParams.get("state") ?? "");

    if (!state?.userId) {
      return jsonResponse({error: "Invalid OAuth state"}, 400);
    }

    try {
      const tokens = await exchangeGoogleCode(code);
      const profile = await fetchGmailProfile(tokens.access_token);
      const admin = createAdminClient();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const {data: existing} = await admin
        .from("google_connections")
        .select("refresh_token")
        .eq("user_id", state.userId)
        .maybeSingle();

      const refreshToken = tokens.refresh_token || existing?.refresh_token;

      if (!refreshToken) {
        throw new Error("Google did not return refresh token");
      }

      await admin.from("google_connections").upsert({
        user_id: state.userId,
        google_email: profile.emailAddress,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        scopes: tokens.scope,
        status: "active",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      });

      const returnUrl = state.returnUrl || "/";
      const redirectTarget = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}booksy_gmail=connected`;

      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectTarget,
          ...corsHeaders,
        },
      });
    } catch (error) {
      return jsonResponse(
        {error: error instanceof Error ? error.message : "OAuth callback failed"},
        500,
      );
    }
  }

  if (request.method !== "POST") {
    return jsonResponse({error: "Method not allowed"}, 405);
  }

  try {
    const {user} = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "start");
    const admin = createAdminClient();

    if (action === "disconnect") {
      await admin.from("google_connections").delete().eq("user_id", user.id);
      return jsonResponse({ok: true});
    }

    if (action === "start") {
      const returnUrl = String(body.returnUrl ?? "");
      const authUrl = buildGoogleAuthUrl(
        encodeState({userId: user.id, returnUrl}),
      );
      return jsonResponse({authUrl});
    }

    return jsonResponse({error: "Unknown action"}, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse(
      {error: error instanceof Error ? error.message : "OAuth failed"},
      500,
    );
  }
});
