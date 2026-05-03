// Supabase Edge Function: Google Calendar OAuth Callback
// Handles OAuth redirect from Google after user approves calendar access
// Deploy: supabase functions deploy google-calendar-oauth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // contains partner_id
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return Response.redirect(
      `${url.origin}/partner/connect-calendar?error=${encodeURIComponent(error)}`,
      302
    );
  }

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth`,
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    console.error("Token exchange failed:", err);
    return Response.redirect(
      `${url.origin}/partner/connect-calendar?error=token_exchange_failed`,
      302
    );
  }

  const tokens = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokens;

  // Get user's email to identify their calendar
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userInfo = await userInfoResponse.json();
  const calendarId = userInfo.email || "primary";

  // Calculate expiry timestamp
  const expiry = new Date(Date.now() + expires_in * 1000);

  // Update partner record with Google tokens
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error: updateError } = await supabase
    .from("partners")
    .update({
      google_calendar_connected: true,
      google_access_token: access_token,
      google_refresh_token: refresh_token,
      google_token_expiry: expiry.toISOString(),
      google_calendar_id: calendarId,
    })
    .eq("id", state);

  if (updateError) {
    console.error("Failed to update partner:", updateError);
    return Response.redirect(
      `${url.origin}/partner/connect-calendar?error=db_update_failed`,
      302
    );
  }

  // Redirect back to partner portal with success
  return Response.redirect(
    `${url.origin}/partner/connect-calendar?connected=true`,
    302
  );
});
