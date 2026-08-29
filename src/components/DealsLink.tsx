import { Link } from "react-router-dom";
import { useFlowLang } from "@/lib/flowLang";

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
  fr: {
    deals: "Recevez des offres de massage à Madrid",
    confirmPre: "Vous voulez connaître les bons prix ?",
    confirmLink: "Rejoindre la liste",
    homeLine: "De bons prix sur le massage que vous voulez, dans votre quartier de Madrid. Un email quand une offre arrive, jamais de spam.",
    homeCta: "Rejoindre gratuitement",
  },
  de: {
    deals: "Massage-Angebote in Madrid erhalten",
    confirmPre: "Möchtest du von guten Preisen erfahren?",
    confirmLink: "Zur Liste anmelden",
    homeLine: "Gute Preise für die Massage, die du willst, in deinem Teil von Madrid. Eine E-Mail, wenn ein Angebot kommt, nie Spam.",
    homeCta: "Kostenlos anmelden",
  },
  it: {
    deals: "Ricevi offerte di massaggi a Madrid",
    confirmPre: "Vuoi sapere quando ci sono buoni prezzi?",
    confirmLink: "Iscriviti alla lista",
    homeLine: "Buoni prezzi sul massaggio che vuoi, nella tua zona di Madrid. Un'email quando arriva un'offerta, mai spam.",
    homeCta: "Iscriviti gratis",
  },
  pt: {
    deals: "Recebe ofertas de massagens em Madrid",
    confirmPre: "Queres saber quando há bons preços?",
    confirmLink: "Junta-te à lista",
    homeLine: "Bons preços na massagem que queres, na tua zona de Madrid. Um email quando sai uma oferta, nunca spam.",
    homeCta: "Junta-te grátis",
  },
  zh: {
    deals: "获取马德里按摩优惠信息",
    confirmPre: "想了解优惠价格吗？",
    confirmLink: "加入名单",
    homeLine: "在您所在的马德里地区，享受您想要的按摩的优惠价格。有优惠时才发一封邮件，绝不打扰。",
    homeCta: "免费加入",
  },
} as const;

function useLang() {
  const lang = useFlowLang();
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
