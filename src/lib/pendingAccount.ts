/**
 * Account as a by-product of booking.
 *
 * When someone asks for an account from a confirmation screen we already know
 * their name, phone and which request they just sent - but they are not signed
 * in yet (the magic link lands later, possibly on another device tab). We park
 * those details here and apply them the moment a session appears.
 */
import { supabase } from "@/lib/supabase";
import { trackFunnel } from "@/lib/funnel";

const LS_KEY = "mc_pending_account";

export type PendingAccount = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  /** whatsapp_requests row to attach to the new account, when we have one. */
  requestId?: string | null;
  source?: string | null;
};

export function savePendingAccount(data: PendingAccount) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadPendingAccount(): PendingAccount | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PendingAccount) : null;
  } catch {
    return null;
  }
}

export function clearPendingAccount() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Called whenever a session exists: fills the profile from the booking details
 * and connects the booking request to the account so My bookings shows it.
 * Best effort - never throws, never blocks a screen.
 */
export async function applyPendingAccount(): Promise<void> {
  const pending = loadPendingAccount();
  if (!pending) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const first = (pending.firstName || "").trim();
    const last = (pending.lastName || "").trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    const patch: Record<string, unknown> = { id: user.id };
    if (first) patch.first_name = first;
    if (last) patch.last_name = last;
    if (fullName) patch.full_name = fullName;
    if ((pending.phone || "").trim()) patch.phone = (pending.phone || "").trim();
    if (user.email) patch.email = user.email;

    await supabase.from("profiles").upsert(patch as any, { onConflict: "id" });

    // Attach the request they just sent, by id when we have it, otherwise by
    // the email they typed into the booking form.
    const email = (pending.email || user.email || "").trim().toLowerCase();
    if (pending.requestId) {
      // requestId is the client-generated `client_ref` uuid, not the bigint id.
      await supabase
        .from("whatsapp_requests")
        .update({ user_id: user.id } as any)
        .eq("client_ref", pending.requestId);
    } else if (email) {
      await supabase
        .from("whatsapp_requests")
        .update({ user_id: user.id } as any)
        .is("user_id", null)
        .eq("contact_email", email);
    }
    trackFunnel("account_created", { how: "booking-offer", source: pending.source || null });
  } catch {
    /* the account still exists, the linking is a bonus */
  } finally {
    clearPendingAccount();
  }
}

/** Links a request to an already signed-in user, straight away. */
export async function linkRequestToUser(requestId: string | null, email?: string | null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (requestId) {
      // requestId is the client-generated `client_ref` uuid, not the bigint id.
      await supabase.from("whatsapp_requests").update({ user_id: user.id } as any).eq("client_ref", requestId);
    } else if (email) {
      await supabase
        .from("whatsapp_requests")
        .update({ user_id: user.id } as any)
        .is("user_id", null)
        .eq("contact_email", email.trim().toLowerCase());
    }
  } catch {
    /* ignore */
  }
}
