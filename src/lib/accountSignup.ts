import { supabase } from "@/lib/supabase";

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
      .catch(() => {});
  } catch {
    /* never block the flow */
  }
}
