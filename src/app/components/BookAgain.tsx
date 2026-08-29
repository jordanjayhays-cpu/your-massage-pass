/**
 * "Book again" entry points for returning customers.
 *
 * Rendered only when someone is signed in and has a booking that was not
 * cancelled. Every variant deep links into the studio's booking wizard with the
 * same service preselected, landing on the "Day and time" step.
 */
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { studioImage, studioImageFallback } from "@/lib/studioImages";
import { bookAgainHref, useLastBooking, type LastBooking } from "@/lib/useLastBooking";
import { useFlowLang } from "@/lib/flowLang";
import { localizedServiceName } from "@/lib/serviceTypeI18n";

const photoFor = (b: LastBooking, width = 200) =>
  studioImage({ id: b.partnerId, name: b.studioName, imageUrl: b.coverUrl, services: [b.serviceName] }, width);

const COPY = {
  en: {
    bookAgain: "Book again",
    serviceAt: (service: string, studio: string) => `${service} at ${studio}`,
    bookAgainAt: (studio: string) => `Book again at ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Welcome back${name}. Book your ${service} again?`,
  },
  es: {
    bookAgain: "Reservar otra vez",
    serviceAt: (service: string, studio: string) => `${service} en ${studio}`,
    bookAgainAt: (studio: string) => `Reservar otra vez en ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Hola de nuevo${name}. ¿Reservas otra vez tu ${service}?`,
  },
  fr: {
    bookAgain: "Réserver à nouveau",
    serviceAt: (service: string, studio: string) => `${service} chez ${studio}`,
    bookAgainAt: (studio: string) => `Réserver à nouveau chez ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Bon retour${name}. Réservez à nouveau votre ${service} ?`,
  },
  de: {
    bookAgain: "Erneut buchen",
    serviceAt: (service: string, studio: string) => `${service} bei ${studio}`,
    bookAgainAt: (studio: string) => `Erneut buchen bei ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Willkommen zurück${name}. Deine ${service} erneut buchen?`,
  },
  it: {
    bookAgain: "Prenota di nuovo",
    serviceAt: (service: string, studio: string) => `${service} da ${studio}`,
    bookAgainAt: (studio: string) => `Prenota di nuovo da ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Bentornato/a${name}. Prenoti di nuovo il tuo ${service}?`,
  },
  pt: {
    bookAgain: "Reservar outra vez",
    serviceAt: (service: string, studio: string) => `${service} em ${studio}`,
    bookAgainAt: (studio: string) => `Reservar outra vez em ${studio}`,
    welcomeBack: (name: string, service: string) =>
      `Bem-vindo de volta${name}. Reservar outra vez a tua ${service}?`,
  },
  zh: {
    bookAgain: "再次预约",
    serviceAt: (service: string, studio: string) => `${service}，位于 ${studio}`,
    bookAgainAt: (studio: string) => `在 ${studio} 再次预约`,
    welcomeBack: (name: string, service: string) =>
      `欢迎回来${name}。要再次预约你的${service}吗？`,
  },
} as const;

/** Compact card for the top of the public home page. */
export function BookAgainCard({ className = "" }: { className?: string }) {
  const { lastBooking } = useLastBooking();
  const lang = useFlowLang();
  const c = COPY[lang];
  if (!lastBooking) return null;
  const serviceName = localizedServiceName(lastBooking.serviceName, lang);

  return (
    <Link
      to={bookAgainHref(lastBooking)}
      className={`group flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-soft motion-safe:transition hover:border-primary hover:bg-accent/40 ${className}`}
    >
      <img
        src={photoFor(lastBooking)}
        alt=""
        className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
        onError={(e) => studioImageFallback(e, 200)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <RotateCcw className="h-3.5 w-3.5" /> {c.bookAgain}
        </span>
        <span className="block text-sm text-foreground truncate mt-0.5">
          {c.serviceAt(serviceName, lastBooking.studioName)}
        </span>
      </span>
    </Link>
  );
}

/** Small chip, styled like the map's locate chip, for the studios page. */
export function BookAgainChip({ className = "" }: { className?: string }) {
  const { lastBooking } = useLastBooking();
  const lang = useFlowLang();
  const c = COPY[lang];
  if (!lastBooking) return null;

  return (
    <Link
      to={bookAgainHref(lastBooking)}
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/95 pl-3 pr-4 py-1.5 shadow-soft backdrop-blur-sm motion-safe:transition hover:bg-card ${className}`}
    >
      <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <RotateCcw className="h-3 w-3 text-primary" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
          {c.bookAgainAt(lastBooking.studioName)}
        </span>
      </span>
    </Link>
  );
}

/**
 * Slim banner for the studio page of a studio this customer already booked.
 * `onRebook` receives the previous booking id so the page can preselect the
 * same service and jump straight to "Day and time".
 */
export function BookAgainBanner({
  partnerId,
  onRebook,
}: {
  partnerId: string;
  onRebook: (bookingId: string) => void;
}) {
  const { lastBooking } = useLastBooking(partnerId);
  const lang = useFlowLang();
  const c = COPY[lang];
  if (!lastBooking) return null;
  const serviceName = localizedServiceName(lastBooking.serviceName, lang);
  const name = lastBooking.firstName ? `, ${lastBooking.firstName}` : "";

  return (
    <div className="mb-3 rounded-2xl border border-[#C4622D]/40 bg-[#C4622D]/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{c.welcomeBack(name, serviceName)}</p>
      </div>
      <button
        type="button"
        onClick={() => onRebook(lastBooking.id)}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#C4622D] text-white text-sm font-semibold shadow-sm motion-safe:transition hover:opacity-90"
      >
        <RotateCcw className="h-3.5 w-3.5" /> {c.bookAgain}
      </button>
    </div>
  );
}
