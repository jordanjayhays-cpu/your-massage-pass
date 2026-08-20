import { supabase } from "./supabase";

export type StudioBadgeVariant = "available_today" | "book_online" | "ask_whatsapp";

/** Derive the badge variant for a studio card.
 *  - claimed (status === "active") + a genuinely free slot today → available_today
 *  - claimed, no free slot today                                 → book_online
 *  - not claimed (no availability data, WhatsApp handoff)        → ask_whatsapp
 */
export function studioBadgeVariant(
  status: string | null | undefined,
  partnerId: string | null | undefined,
  freeTodayIds?: Set<string> | null
): StudioBadgeVariant {
  if (status !== "active") return "ask_whatsapp";
  if (partnerId && freeTodayIds?.has(partnerId)) return "available_today";
  return "book_online";
}

/** For the given claimed partner ids, return the subset that still has at least
 *  one free (not fully booked, not in the past) slot today. */
export async function fetchFreeTodayPartnerIds(partnerIds: string[]): Promise<Set<string>> {
  const free = new Set<string>();
  const ids = [...new Set(partnerIds.filter(Boolean))];
  if (ids.length === 0) return free;

  const now = new Date();
  const dow = now.getDay(); // 0 = Sunday
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  try {
    const [{ data: availability }, { data: partners }] = await Promise.all([
      supabase
        .from("partner_availability")
        .select("partner_id, day_of_week, time_slot, capacity")
        .in("partner_id", ids),
      supabase.from("partners").select("id, capacity").in("id", ids),
    ]);

    const defaultCapacity = new Map<string, number>();
    for (const p of (partners as any[]) ?? []) {
      defaultCapacity.set(p.id, Math.max(1, Number(p.capacity) || 1));
    }

    const todaySlots = ((availability as any[]) ?? []).filter(
      (a) => Number(a.day_of_week) === dow && a.time_slot
    );
    if (todaySlots.length === 0) return free;

    // Booked counts for today, per partner
    const bookedByPartner = new Map<string, Map<string, number>>();
    await Promise.all(
      ids.map(async (pid) => {
        try {
          const { data } = await supabase.rpc("booked_slot_counts", { p_partner_id: pid });
          const counts = new Map<string, number>();
          for (const b of (data as any[]) ?? []) {
            if (b.booking_date !== today) continue;
            const t = String(b.booking_time || "").slice(0, 5);
            counts.set(t, (counts.get(t) || 0) + 1);
          }
          bookedByPartner.set(pid, counts);
        } catch {
          bookedByPartner.set(pid, new Map());
        }
      })
    );

    for (const slot of todaySlots) {
      const pid = slot.partner_id as string;
      if (free.has(pid)) continue;
      const time = String(slot.time_slot).slice(0, 5);
      const [h, m] = time.split(":").map(Number);
      if (isNaN(h)) continue;
      if (h * 60 + (m || 0) <= nowMinutes) continue; // already passed
      const cap =
        slot.capacity != null
          ? Math.max(1, Number(slot.capacity))
          : defaultCapacity.get(pid) ?? 1;
      const booked = bookedByPartner.get(pid)?.get(time) ?? 0;
      if (booked < cap) free.add(pid);
    }
  } catch {
    // Never block rendering on availability lookups — fall back to "book online".
  }

  return free;
}
