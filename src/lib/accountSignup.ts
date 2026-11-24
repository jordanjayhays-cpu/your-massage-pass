import { supabase } from "@/lib/supabase";
import { trackAccountCreatedConversion } from "@/lib/adsConversion";
import { trackFunnel } from "@/lib/funnel";

/**
 * Fire and forget: ask the backend to create a passwordless Massage Club
 * account and email a one-tap sign-in link. Never blocks the caller.
 */
export function requestAccountSignup(opts: { email: string; name?: string | null; lang?: string | null }) {
  const email = (opts.email || "").trim();
  if (!email) return;
  try {
    void supabase.functions
      .invoke("email-auth", {
        body: {
          action: "signup",
          email,
          name: (opts.name || "").trim() || null,
          lang: (opts.lang || localStorage.getItem("mm-lang") || navigator.language || "en").slice(0, 2),
        },
      })
      .then(({ data, error }) => {
        if (error) return;
        // Only count genuinely new accounts, never an existing user re-signing in.
        const d = data as Record<string, unknown> | null;
        const created = d?.created ?? d?.is_new ?? d?.new_user ?? d?.created_account;
        if (created === true) {
          trackAccountCreatedConversion();
          trackFunnel("account_created", { how: "email-booking" });
        }
      })
      .catch(() => {});
  } catch {
    /* never block the flow */
  }
}
