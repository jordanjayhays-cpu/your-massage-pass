/**
 * "Book again" data source.
 *
 * Looks up the signed-in customer's most recent booking that was not cancelled,
 * so the app can offer a one tap repeat of it. Returns null for guests and for
 * first timers, which is what every "Book again" surface keys off.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type LastBooking = {
  id: string;
  serviceName: string;
  studioName: string;
  /** Slug when the studio has one, partner id otherwise. Always link-safe. */
  studioKey: string;
  partnerId: string;
  coverUrl: string | null;
  firstName: string;
};

/** Deep link that reopens the booking wizard on "Day and time" with the same service. */
export const bookAgainHref = (b: LastBooking) =>
  `/${b.studioKey}?rebook=${b.id}&step=2`;

const firstNameFrom = (...candidates: (string | null | undefined)[]) => {
  for (const c of candidates) {
    const name = (c || "").trim();
    if (name) return name.split(/\s+/)[0];
  }
  return "";
};

/**
 * @param partnerId when given, only returns a booking made at that studio.
 */
export function useLastBooking(partnerId?: string | null) {
  const [lastBooking, setLastBooking] = useState<LastBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (user: any) => {
      if (!user) {
        if (!cancelled) { setLastBooking(null); setLoading(false); }
        return;
      }
      // Two shapes: the strict one filters test bookings server side. If the
      // is_test column is not present we fall back to the same query without
      // it, so the feature degrades instead of disappearing.
      const build = (withTest: boolean) => {
        let q = supabase
          .from("bookings")
          .select(
            `id, massage_type, spa_name, partner_id, client_name, status, created_at${withTest ? ", is_test" : ""}, partners!inner ( id, slug, business_name, cover_url, status )`,
          )
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .eq("partners.status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (withTest) q = q.not("is_test", "is", true);
        if (partnerId) q = q.eq("partner_id", partnerId);
        return q;
      };

      let { data, error } = await build(true).maybeSingle();
      if (error) ({ data, error } = await build(false).maybeSingle());
      if (cancelled) return;
      if (error || !data) { setLastBooking(null); setLoading(false); return; }

      const row = data as any;
      const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
      // Belt and braces: never surface test data or non-active studios.
      if (row.is_test === true || !partner || partner.status !== "active") {
        setLastBooking(null); setLoading(false); return;
      }
      const key = partner?.slug || row.partner_id;
      if (!key) { setLastBooking(null); setLoading(false); return; }

      setLastBooking({
        id: row.id,
        serviceName: row.massage_type || "massage",
        studioName: partner?.business_name || row.spa_name || "your studio",
        studioKey: key,
        partnerId: row.partner_id,
        coverUrl: partner?.cover_url || null,
        firstName: firstNameFrom(
          user.user_metadata?.full_name,
          user.user_metadata?.name,
          row.client_name,
          user.email,
        ),
      });
      setLoading(false);
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      load(session?.user ?? null);
    })();

    // The session can land after first paint (magic link, OAuth return).
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) load(session.user);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [partnerId]);

  return { lastBooking, loading };
}
