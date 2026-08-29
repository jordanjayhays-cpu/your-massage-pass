import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useFlowLang } from "@/lib/flowLang";
import { initClarity, loadClarity } from "@/lib/clarity";


const KEY = "mc_consent";

const COPY = {
  en: {
    dialogLabel: "Cookie choice",
    body: "We use cookies to see how people find and use Massage Club, so we can fix what does not work. Nothing is sold or shared.",
    accept: "Accept",
    decline: "Decline",
    privacy: "Privacy",
  },
  es: {
    dialogLabel: "Elección de cookies",
    body: "Usamos cookies para ver cómo la gente encuentra y usa Massage Club, así podemos arreglar lo que no funciona. No vendemos ni compartimos nada.",
    accept: "Aceptar",
    decline: "Rechazar",
    privacy: "Privacidad",
  },
  fr: {
    dialogLabel: "Choix des cookies",
    body: "Nous utilisons des cookies pour voir comment les gens trouvent et utilisent Massage Club, afin de corriger ce qui ne fonctionne pas. Rien n'est vendu ni partagé.",
    accept: "Accepter",
    decline: "Refuser",
    privacy: "Confidentialité",
  },
  de: {
    dialogLabel: "Cookie-Auswahl",
    body: "Wir verwenden Cookies, um zu sehen, wie Leute Massage Club finden und nutzen, damit wir reparieren können, was nicht funktioniert. Nichts wird verkauft oder geteilt.",
    accept: "Akzeptieren",
    decline: "Ablehnen",
    privacy: "Datenschutz",
  },
  it: {
    dialogLabel: "Scelta sui cookie",
    body: "Usiamo i cookie per capire come le persone trovano e usano Massage Club, così possiamo sistemare quello che non funziona. Non vendiamo né condividiamo nulla.",
    accept: "Accetta",
    decline: "Rifiuta",
    privacy: "Privacy",
  },
  pt: {
    dialogLabel: "Escolha de cookies",
    body: "Usamos cookies para ver como as pessoas encontram e usam a Massage Club, para podermos corrigir o que não funciona. Nada é vendido ou partilhado.",
    accept: "Aceitar",
    decline: "Recusar",
    privacy: "Privacidade",
  },
  zh: {
    dialogLabel: "Cookie 选择",
    body: "我们使用 Cookie 来了解人们如何发现和使用 Massage Club，以便改进不完善之处。我们不会出售或分享任何信息。",
    accept: "接受",
    decline: "拒绝",
    privacy: "隐私政策",
  },
} as const;

function gtagSafe(...args: unknown[]) {
  try {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.(...args);
  } catch {
    /* ignore */
  }
}

/**
 * Quiet bottom-corner cookie consent bar for the Google Ads tag.
 * - Fixed position, so it never pushes content (no layout shift).
 * - Hidden entirely for visitors with the personal opt-out flag (mc_nt).
 * - Denied defaults are set in index.html before the tag loads; this only upgrades them.
 */
export default function ConsentBanner() {
  const { pathname } = useLocation();
  const lang = useFlowLang();
  const t = COPY[lang];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Load Clarity for visitors who already accepted on a previous visit.
    initClarity();
    try {
      if (localStorage.getItem("mc_nt") === "1") return;
      if (localStorage.getItem(KEY)) return;
      setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  const decide = (granted: boolean) => {
    try {
      localStorage.setItem(KEY, granted ? "granted" : "denied");
    } catch {
      /* ignore */
    }
    if (granted) {
      gtagSafe("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
      // Start session replay right away — no reload needed.
      loadClarity();
    }
    setVisible(false);
  };

  // Keep clear of the bottom nav / sticky WhatsApp CTA on studio pages.
  const liftedForStickyCta =
    pathname.startsWith("/s/") || pathname.startsWith("/book/") || pathname.split("/").length === 2;
  const bottomClass = liftedForStickyCta ? "bottom-24" : "bottom-4";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t.dialogLabel}
      className={`fixed ${bottomClass} left-4 right-4 sm:right-auto sm:max-w-sm z-[60] motion-safe:animate-fade-up`}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-elegant p-4">
        <p className="text-sm text-foreground leading-snug">
          {t.body}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.accept}
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.decline}
          </button>
          <a
            href="/privacy"
            className="ml-auto text-xs text-muted-foreground underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t.privacy}
          </a>
        </div>
      </div>
    </div>
  );
}
