import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BookingProvider } from "./BookingContext";
import { MobileFrame } from "./MobileFrame";
import { supabase } from "@/lib/supabase";
import { captureReferralFromUrl } from "@/lib/referral";

export default function AppLayout() {
  const { i18n } = useTranslation();

  // Capture ?ref=CODE from any inbound link so it survives sign-in + booking.
  useEffect(() => {
    captureReferralFromUrl();
  }, []);


  // Sync preferred language from the signed-in user's profile (once per session).
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", user.id)
          .maybeSingle();
        const lang = (data as any)?.preferred_language;
        if (!cancelled && (lang === "es" || lang === "en") && lang !== i18n.resolvedLanguage) {
          i18n.changeLanguage(lang);
        }
      } catch {
        /* column may not exist yet — ignore */
      }
    };
    sync();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") sync();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BookingProvider>
      <MobileFrame>
        <Outlet />
      </MobileFrame>
    </BookingProvider>
  );
}
