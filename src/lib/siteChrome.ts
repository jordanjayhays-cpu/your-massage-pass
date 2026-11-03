import { useEffect, useState } from "react";
import type { FlowLang } from "@/lib/flowLang";
import { supabase } from "@/lib/supabase";

/**
 * Words shared by SiteHeader and SiteFooter. Sentence case, 13px or larger,
 * no tracked capitals (design system 3.2). "Studios" is "Centros" in Spanish
 * (customer word, design system 6.1). The other labels reuse strings already
 * on the site (AccountHeaderLink, the studio page footer, How it works).
 */
export const SITE_COPY: Record<
  FlowLang,
  {
    nav: string;
    home: string;
    studios: string;
    howItWorks: string;
    forStudios: string;
    signIn: string;
    myAccount: string;
    book: string;
    allStudios: string;
    massages: string;
    studiosHeading: string;
    studioLogin: string;
    privacy: string;
    terms: string;
    oneLine: string;
  }
> = {
  en: {
    nav: "Main",
    home: "Massage Club, home",
    studios: "Studios",
    howItWorks: "How it works",
    forStudios: "For studios",
    signIn: "Sign in",
    myAccount: "My account",
    book: "Book a massage",
    allStudios: "All studios",
    massages: "Massages",
    studiosHeading: "Studios",
    studioLogin: "Studio login",
    privacy: "Privacy",
    terms: "Terms",
    oneLine: "Massages in Madrid. You tell us in English, we ask the studios in Spanish. Free to use.",
  },
  es: {
    nav: "Principal",
    home: "Massage Club, inicio",
    studios: "Centros",
    howItWorks: "Cómo funciona",
    forStudios: "Para centros",
    signIn: "Entrar",
    myAccount: "Mi cuenta",
    book: "Reservar un masaje",
    allStudios: "Todos los centros",
    massages: "Masajes",
    studiosHeading: "Centros",
    studioLogin: "Acceso para centros",
    privacy: "Privacidad",
    terms: "Términos",
    oneLine: "Masajes en Madrid. Nos lo cuentas en tu idioma y preguntamos a los centros en español. Gratis.",
  },
  fr: {
    nav: "Principal",
    home: "Massage Club, accueil",
    studios: "Centres",
    howItWorks: "Comment ça marche",
    forStudios: "Pour les centres",
    signIn: "Se connecter",
    myAccount: "Mon compte",
    book: "Réserver un massage",
    allStudios: "Tous les centres",
    massages: "Massages",
    studiosHeading: "Centres",
    studioLogin: "Accès centres",
    privacy: "Confidentialité",
    terms: "Conditions",
    oneLine: "Massages à Madrid. Vous nous écrivez dans votre langue, nous demandons aux centres en espagnol. Gratuit.",
  },
  de: {
    nav: "Hauptnavigation",
    home: "Massage Club, Startseite",
    studios: "Studios",
    howItWorks: "So funktioniert's",
    forStudios: "Für Studios",
    signIn: "Anmelden",
    myAccount: "Mein Konto",
    book: "Massage buchen",
    allStudios: "Alle Studios",
    massages: "Massagen",
    studiosHeading: "Studios",
    studioLogin: "Studio-Login",
    privacy: "Datenschutz",
    terms: "AGB",
    oneLine: "Massagen in Madrid. Du schreibst uns in deiner Sprache, wir fragen die Studios auf Spanisch. Kostenlos.",
  },
  it: {
    nav: "Principale",
    home: "Massage Club, home",
    studios: "Centri",
    howItWorks: "Come funziona",
    forStudios: "Per i centri",
    signIn: "Accedi",
    myAccount: "Il mio account",
    book: "Prenota un massaggio",
    allStudios: "Tutti i centri",
    massages: "Massaggi",
    studiosHeading: "Centri",
    studioLogin: "Accesso centri",
    privacy: "Privacy",
    terms: "Termini",
    oneLine: "Massaggi a Madrid. Ci scrivi nella tua lingua, noi chiediamo ai centri in spagnolo. Gratis.",
  },
  pt: {
    nav: "Principal",
    home: "Massage Club, início",
    studios: "Estúdios",
    howItWorks: "Como funciona",
    forStudios: "Para estúdios",
    signIn: "Entrar",
    myAccount: "A minha conta",
    book: "Marcar uma massagem",
    allStudios: "Todos os estúdios",
    massages: "Massagens",
    studiosHeading: "Estúdios",
    studioLogin: "Acesso estúdios",
    privacy: "Privacidade",
    terms: "Termos",
    oneLine: "Massagens em Madrid. Dizes-nos no teu idioma, nós perguntamos aos estúdios em espanhol. Grátis.",
  },
  zh: {
    nav: "主导航",
    home: "Massage Club 首页",
    studios: "按摩店",
    howItWorks: "如何运作",
    forStudios: "商家入驻",
    signIn: "登录",
    myAccount: "我的账户",
    book: "预约按摩",
    allStudios: "全部按摩店",
    massages: "按摩",
    studiosHeading: "商家",
    studioLogin: "商家登录",
    privacy: "隐私政策",
    terms: "条款",
    oneLine: "马德里的按摩。您用自己的语言告诉我们，我们用西班牙语询问按摩店。完全免费。",
  },
};

/**
 * true / false once known, null while loading. Reads the stored session
 * (no network call), then follows sign-in and sign-out.
 */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSignedIn(!!data.session);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}
