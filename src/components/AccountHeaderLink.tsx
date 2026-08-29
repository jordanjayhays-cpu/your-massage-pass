import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

/**
 * Quiet account affordance for the booking screens: "Sign in" when signed out,
 * the person's first name when signed in. Deliberately small - it must never
 * compete with the booking CTA.
 */
export default function AccountHeaderLink({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const es = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2) === "es";
  const [name, setName] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setSignedIn(!!user);
      if (!user) {
        setName(null);
        return;
      }
      const meta = (user.user_metadata || {}) as Record<string, string>;
      const fallback = (meta.full_name || meta.name || user.email || "").split(/[ @]/)[0] || null;
      setName(fallback);
      const { data } = await supabase
        .from("profiles")
        .select("first_name, full_name")
        .eq("id", user.id)
        .maybeSingle();
      const p = data as any;
      const first = (p?.first_name || (p?.full_name || "").split(" ")[0] || "").trim();
      if (!cancelled && first) setName(first);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn === null) return null;

  return (
    <Link
      to={signedIn ? "/app/profile" : "/login"}
      className={`text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-primary transition ${className}`}
    >
      {signedIn ? name || (es ? "Mi cuenta" : "My account") : es ? "Entrar" : "Sign in"}
    </Link>
  );
}
