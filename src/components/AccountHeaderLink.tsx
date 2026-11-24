import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { useFlowLang } from "@/lib/flowLang";
import { supabase } from "@/lib/supabase";

const COPY = {
  en: { myAccount: "My account", signIn: "Sign in", enhance: "Enhance your massage experience", yourProfile: "Your profile" },
  es: { myAccount: "Mi cuenta", signIn: "Entrar", enhance: "Mejora tu experiencia de masaje", yourProfile: "Tu perfil" },
  fr: { myAccount: "Mon compte", signIn: "Se connecter", enhance: "Améliorez votre expérience de massage", yourProfile: "Votre profil" },
  de: { myAccount: "Mein Konto", signIn: "Anmelden", enhance: "Verbessern Sie Ihr Massageerlebnis", yourProfile: "Ihr Profil" },
  it: { myAccount: "Il mio account", signIn: "Accedi", enhance: "Migliora la tua esperienza di massaggio", yourProfile: "Il tuo profilo" },
  pt: { myAccount: "A minha conta", signIn: "Entrar", enhance: "Melhore a sua experiência de massagem", yourProfile: "O seu perfil" },
  zh: { myAccount: "我的账户", signIn: "登录", enhance: "提升您的按摩体验", yourProfile: "您的个人资料" },
} as const;

/**
 * Quiet account affordance for the booking screens: a soft pill prompting sign-in
 * when signed out, the person's first name when signed in. Deliberately small -
 * it must never compete with the booking CTA.
 */
export default function AccountHeaderLink({ className = "" }: { className?: string }) {
  const lang = useFlowLang();
  const t = COPY[lang];
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

  if (signedIn === false) {
    return (
      <Link
        to="/login"
        className={`inline-flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full border border-border/60 bg-background/80 text-foreground text-xs font-medium hover:border-primary/50 transition ${className}`}
      >
        <UserCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">{t.enhance}</span>
        <span className="inline sm:hidden">{t.yourProfile}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/app/profile"
      className={`text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-primary transition ${className}`}
    >
      {name || t.myAccount}
    </Link>
  );
}
