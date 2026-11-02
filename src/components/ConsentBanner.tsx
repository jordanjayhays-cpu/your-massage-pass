import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFlowLang } from "@/lib/flowLang";
import { initClarity, loadClarity } from "@/lib/clarity";


const KEY = "mc_consent";

/** CSS variable with the bar's height in px while it shows (see src/index.css). */
const HEIGHT_VAR = "--consent-h";

// Accept grants ad_storage, ad_user_data and ad_personalization as well as
// analytics, so the copy says plainly that cookies also measure our ads.
const COPY = {
  en: {
    dialogLabel: "Cookie choice",
    body: "We use cookies to see how the site is used and to measure our ads.",
    accept: "Accept",
    decline: "Decline",
    privacy: "Privacy",
  },
  es: {
    dialogLabel: "Elección de cookies",
    body: "Usamos cookies para ver cómo se usa la web y medir nuestros anuncios.",
    accept: "Aceptar",
    decline: "Rechazar",
    privacy: "Privacidad",
  },
  fr: {
    dialogLabel: "Choix des cookies",
    body: "Nous utilisons des cookies pour voir comment le site est utilisé et mesurer nos annonces.",
    accept: "Accepter",
    decline: "Refuser",
    privacy: "Confidentialité",
  },
  de: {
    dialogLabel: "Cookie-Auswahl",
    body: "Wir nutzen Cookies, um zu sehen, wie die Seite genutzt wird, und um unsere Anzeigen zu messen.",
    accept: "Akzeptieren",
    decline: "Ablehnen",
    privacy: "Datenschutz",
  },
  it: {
    dialogLabel: "Scelta sui cookie",
    body: "Usiamo i cookie per vedere come viene usato il sito e per misurare i nostri annunci.",
    accept: "Accetta",
    decline: "Rifiuta",
    privacy: "Privacy",
  },
  pt: {
    dialogLabel: "Escolha de cookies",
    body: "Usamos cookies para ver como o site é usado e para medir os nossos anúncios.",
    accept: "Aceitar",
    decline: "Recusar",
    privacy: "Privacidade",
  },
  zh: {
    dialogLabel: "Cookie 选择",
    body: "我们使用 Cookie 来了解网站的使用情况，并衡量我们的广告效果。",
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

/** Shown only to visitors who have not chosen yet and are not opted out (mc_nt). */
function needsChoice(): boolean {
  try {
    if (localStorage.getItem("mc_nt") === "1") return false;
    return !localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

function setHeightVar(px: number | null) {
  const root = document.documentElement;
  if (px == null) root.style.removeProperty(HEIGHT_VAR);
  else root.style.setProperty(HEIGHT_VAR, `${Math.ceil(px)}px`);
}

/** Room the bar takes from the bottom of the screen. From 900px it is a card
 *  16px above the bottom edge, so that gap counts too. */
function roomFor(el: HTMLElement): number {
  let desk = false;
  try {
    desk = window.matchMedia("(min-width: 900px)").matches;
  } catch {
    /* ignore */
  }
  return el.offsetHeight + (desk ? 16 : 0);
}

/**
 * Cookie consent bar for the Google Ads tag.
 * - Pinned to the very bottom, full width, at most about 104px tall on a phone,
 *   so it never sits on top of a page's main button.
 * - While it shows, its height is published as --consent-h on <html>: the body
 *   is padded by it, and anything fixed to the bottom sits above it.
 * - Read in the useState initialiser, so it never flashes in after first paint.
 * - Hidden entirely for visitors with the personal opt-out flag (mc_nt).
 * - Denied defaults are set in index.html before the tag loads; this only upgrades them.
 */
export default function ConsentBanner() {
  const lang = useFlowLang();
  const t = COPY[lang];
  const [visible, setVisible] = useState<boolean>(needsChoice);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Load Clarity for visitors who already accepted on a previous visit.
    initClarity();
  }, []);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!visible || !el) {
      setHeightVar(null);
      return;
    }
    setHeightVar(roomFor(el));
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => setHeightVar(roomFor(el)));
      ro.observe(el);
    }
    return () => {
      ro?.disconnect();
      setHeightVar(null);
    };
  }, [visible]);

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
      // Start session replay right away, no reload needed.
      loadClarity();
    }
    setVisible(false);
  };

  const btn =
    "h-11 min-w-0 flex-1 sm:flex-none sm:w-32 desk:flex-1 desk:w-auto rounded-full border border-primary/70 bg-card px-4 text-sm font-semibold text-primary hover:bg-primary/5 desk:hover:bg-brand-tint transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div
      ref={barRef}
      role="dialog"
      aria-live="polite"
      aria-label={t.dialogLabel}
      // Phones and tablets: a full-width bar at the bottom. From 900px (desktop
      // fix F20): a 360px card in the bottom-left corner, z 50. Either way its
      // room is published as --consent-h, so the page ends above it.
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-8px_24px_-12px_hsl(18_14%_11%/0.18)] desk:inset-x-auto desk:left-4 desk:bottom-4 desk:w-[360px] desk:z-consent desk:rounded-2xl desk:border desk:bg-card desk:backdrop-blur-none desk:shadow-sheet"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 sm:py-3 desk:flex-col desk:items-stretch desk:gap-3 desk:p-4">
        <p className="text-sm leading-[1.3] text-foreground sm:flex-1 desk:leading-5">{t.body}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => decide(true)} className={btn}>
            {t.accept}
          </button>
          <button type="button" onClick={() => decide(false)} className={btn}>
            {t.decline}
          </button>
          <a
            href="/privacy"
            className="flex min-h-11 flex-none items-center px-1.5 text-xs desk:text-caption desk:font-normal text-muted-foreground underline underline-offset-2 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t.privacy}
          </a>
        </div>
      </div>
    </div>
  );
}
