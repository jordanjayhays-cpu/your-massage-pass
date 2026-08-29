import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const COPY = {
  en: {
    deals: "Get massage deals in Madrid",
    confirmPre: "Want to hear about good prices?",
    confirmLink: "Join the list",
    homeLine: "Good prices on the massage you want, in your part of Madrid. One email when a deal lands, never spam.",
    homeCta: "Join free",
  },
  es: {
    deals: "Recibe ofertas de masajes en Madrid",
    confirmPre: "¿Quieres enterarte de los buenos precios?",
    confirmLink: "Únete a la lista",
    homeLine: "Buenos precios en el masaje que quieres, en tu zona de Madrid. Un email cuando salga una oferta, nada de spam.",
    homeCta: "Únete gratis",
  },
} as const;

function useLang() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || "en").slice(0, 2) === "es" ? "es" : "en";
  return COPY[lang];
}

/** Single quiet footer line pointing to /notify. */
export function DealsFooterLine({ className = "" }: { className?: string }) {
  const t = useLang();
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      <Link to="/notify" className="hover:text-primary transition underline-offset-2 hover:underline">
        {t.deals}
      </Link>
    </p>
  );
}

/** Post-booking confirmation line: "Want to hear about good prices? Join the list". */
export function DealsConfirmationLine({ className = "" }: { className?: string }) {
  const t = useLang();
  return (
    <p className={`text-center text-sm text-muted-foreground ${className}`}>
      {t.confirmPre}{" "}
      <Link to="/notify" className="underline underline-offset-2 hover:text-primary transition">
        {t.confirmLink}
      </Link>
    </p>
  );
}

/** Quiet home-page section: one short line plus a "Join free" button. */
export function DealsJoinSection({ className = "" }: { className?: string }) {
  const t = useLang();
  return (
    <section className={`text-center ${className}`}>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-snug">{t.homeLine}</p>
      <Link
        to="/notify"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-primary text-primary px-8 text-xs font-bold tracking-[0.14em] uppercase hover:bg-primary/5 transition"
      >
        {t.homeCta}
      </Link>
    </section>
  );
}
