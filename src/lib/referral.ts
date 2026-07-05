import { supabase } from "./supabase";

export const REFERRAL_REWARD_CENTS = 500; // €5
export const REFERRAL_REWARD_EUR = 5;
const REF_STORAGE_KEY = "mm_referral_code";

/** Read ?ref= from the current URL and stash it for later booking. */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && ref.length >= 4 && ref.length <= 32) {
      localStorage.setItem(REF_STORAGE_KEY, ref.trim().toLowerCase());
    }
  } catch {
    /* ignore */
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REF_STORAGE_KEY);
}

export function clearPendingReferral() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REF_STORAGE_KEY);
}

/** Get (or generate + persist) a stable referral code for the signed-in user. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (data?.referral_code) return data.referral_code as string;
  // Short code from user uuid — deterministic + collision-safe enough for MVP
  const code = userId.replace(/-/g, "").slice(0, 8);
  await supabase
    .from("profiles")
    .upsert({ id: userId, referral_code: code, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return code;
}

/** How many €5 credits the user has available (unused). */
export async function getUnusedCredits(userId: string): Promise<
  { id: number; amount_cents: number }[]
> {
  const { data } = await supabase
    .from("referral_credits")
    .select("id, amount_cents")
    .eq("user_id", userId)
    .is("used_at", null)
    .order("created_at", { ascending: true });
  return (data as any[]) ?? [];
}

/** Mark one credit as used against a booking. Returns cents redeemed. */
export async function redeemOneCredit(userId: string, bookingId: number): Promise<number> {
  const credits = await getUnusedCredits(userId);
  if (credits.length === 0) return 0;
  const c = credits[0];
  const { error } = await supabase
    .from("referral_credits")
    .update({ used_by_booking_id: bookingId, used_at: new Date().toISOString() })
    .eq("id", c.id)
    .eq("user_id", userId)
    .is("used_at", null);
  if (error) return 0;
  return c.amount_cents;
}

/**
 * Called after a signed-in user confirms a booking.
 * If a referral code is pending, records the referral and grants the referrer €5.
 * Idempotent (unique referrer_id + referred_user_id).
 */
export async function recordReferralOnBooking(
  refereeId: string,
  refereeEmail: string | null,
  bookingId: number,
): Promise<void> {
  const code = getPendingReferralCode();
  if (!code) return;

  // Look up referrer by code
  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  const referrerId = (referrerProfile as any)?.id;
  if (!referrerId || referrerId === refereeId) {
    clearPendingReferral();
    return;
  }

  // Skip if a referral row already exists for this referee
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referrer_id", referrerId)
    .eq("referred_user_id", refereeId)
    .maybeSingle();
  if (existing) {
    clearPendingReferral();
    return;
  }

  const { data: inserted, error: refErr } = await supabase
    .from("referrals")
    .insert({
      referrer_id: referrerId,
      referred_user_id: refereeId,
      referred_email: refereeEmail,
      first_booking_id: bookingId,
      credited: true,
      credited_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (refErr || !inserted) {
    clearPendingReferral();
    return;
  }

  await supabase.from("referral_credits").insert({
    user_id: referrerId,
    amount_cents: REFERRAL_REWARD_CENTS,
    referral_id: (inserted as any).id,
  });

  clearPendingReferral();
}
