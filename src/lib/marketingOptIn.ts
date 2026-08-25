import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";

export type MarketingOptInSource = "booking_success" | "profile_setup";

/**
 * Records a marketing opt-in for a contact.
 * Signed-in users also get their profile flag flipped; everyone lands in
 * marketing_optins so the email is captured even without an account.
 * Never throws: opt-in is a nice-to-have, it must not break the screen.
 */
export async function submitMarketingOptIn(opts: {
  email: string | null;
  userId?: string | null;
  source: MarketingOptInSource;
  bookingRef?: string | null;
}): Promise<boolean> {
  const email = (opts.email || "").trim().toLowerCase() || null;
  const userId = opts.userId || null;
  if (!email && !userId) return false;

  let ok = false;
  try {
    const { error } = await supabase.from("marketing_optins").insert({
      email,
      user_id: userId,
      source: opts.source,
      booking_ref: opts.bookingRef || null,
    });
    if (!error) ok = true;
  } catch {
    /* ignore */
  }

  if (userId) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          marketing_opt_in: true,
          marketing_opt_in_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (!error) ok = true;
    } catch {
      /* ignore */
    }
  }

  trackEvent("marketing_opt_in", { meta: { source: opts.source, has_account: !!userId } });
  return ok;
}

/** Optional email + quiz result capture on the quiz result screen. */
export async function submitQuizLead(email: string, resultSlug: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  try {
    const { error } = await supabase
      .from("quiz_leads")
      .insert({ email: clean, result_slug: resultSlug });
    if (error) return false;
  } catch {
    return false;
  }
  trackEvent("quiz_email_captured", { meta: { result_slug: resultSlug } });
  return true;
}
