import { MassageTypeVideo } from "@/components/MassageTypeVideo";
import { trackEvent } from "@/lib/siteVisit";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Info, X, ExternalLink, Sparkles, Shirt, Droplet, Droplets, Footprints, Smile,
  Globe, Hand, Circle, Flame, Feather, MoveDiagonal, ArrowDownToLine, Sun, Moon,
  Armchair, Users, Baby, Activity, Clock, Waves, Wind, Leaf, Heart, Gem, Rows3,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  findMassageType,
  vitalsFor,
  factsFor,
  pressureColor,
  PRESSURE_LABELS,
  BEST_FOR_LABELS,
  BEST_FOR_COLORS,
  CLOTHING_LABELS,
  OIL_LABELS,
  type MassageTypeContent,
  type Fact,
  type WhoFact,
  type FactIcon,
} from "@/lib/massageTypes";


/**
 * Massage type education, without ever losing your place in the booking flow.
 *
 * The (i) button opens an overlay ON TOP of the current page (bottom sheet on
 * mobile, centered modal on desktop). It never selects or deselects the
 * service card it sits inside, and closing it returns you exactly where you
 * were. The "Open full page" link opens the standalone page in a new tab.
 */

/** Five dot pressure scale, filled left to right, coloured by intensity. */
export function PressureDots({ level, size = 9 }: { level: number; size?: number }) {
  const color = pressureColor(level);
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            background: i <= level ? color : "transparent",
            border: `1px solid ${i <= level ? color : "#E0D6C8"}`,
          }}
        />
      ))}
    </span>
  );
}

function QuickFact({ icon, en, es }: { icon: React.ReactNode; en: string; es: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DCCF] bg-[#FAF6F1] px-2.5 py-1 text-xs text-[#5a4736]">
      <span className="text-[#8a7460]">{icon}</span>
      {en} <span className="text-[#8a7460]">/ {es}</span>
    </span>
  );
}

/** The vitals block: pressure meter, best-for chips, quick facts. */
export function MassageTypeVitals({ type }: { type: MassageTypeContent }) {
  const v = vitalsFor(type.slug);
  if (!v) return null;
  const label = PRESSURE_LABELS[Math.min(Math.max(v.pressure, 1), 5) - 1];
  const clothingIcon =
    v.clothing === "dressed" ? <Shirt size={13} />
    : v.clothing === "face-only" ? <Smile size={13} />
    : v.clothing === "feet-only" ? <Footprints size={13} />
    : null;

  return (
    <div className="rounded-2xl border border-[#E6DCCF] bg-[#FDFBF8] p-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#8a7460]">
          Pressure <span className="font-medium normal-case tracking-normal">/ Presión</span>
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <PressureDots level={v.pressure} size={11} />
          <span className="text-sm font-semibold text-[#4a4038]">
            {label.en} <span className="font-normal text-[#8a7460]">/ {label.es}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.bestFor.map((k) => {
          const c = BEST_FOR_COLORS[k];
          return (
            <span
              key={k}
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
            >
              {BEST_FOR_LABELS[k].en} <span className="font-normal opacity-70">/ {BEST_FOR_LABELS[k].es}</span>
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.clothing && clothingIcon && (
          <QuickFact icon={clothingIcon} en={CLOTHING_LABELS[v.clothing].en} es={CLOTHING_LABELS[v.clothing].es} />
        )}
        <QuickFact
          icon={v.oil === "none" ? <Droplet size={13} /> : <Droplets size={13} />}
          en={OIL_LABELS[v.oil].en}
          es={OIL_LABELS[v.oil].es}
        />
        {type.firstTimer && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEFE8] px-2.5 py-1 text-xs font-semibold text-[#B85C38]">
            <Sparkles size={13} /> Great first massage <span className="font-normal opacity-80">/ Ideal primer masaje</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Icon lookup for the fact chips. */
const FACT_ICONS: Record<FactIcon, React.ReactNode> = {
  mat: <Rows3 size={13} />,
  shirt: <Shirt size={13} />,
  sparkles: <Sparkles size={13} />,
  globe: <Globe size={13} />,
  oil: <Droplets size={13} />,
  "no-oil": <Droplet size={13} />,
  hands: <Hand size={13} />,
  stone: <Circle size={13} />,
  heat: <Flame size={13} />,
  feather: <Feather size={13} />,
  stretch: <MoveDiagonal size={13} />,
  pressure: <ArrowDownToLine size={13} />,
  sun: <Sun size={13} />,
  moon: <Moon size={13} />,
  chair: <Armchair size={13} />,
  feet: <Footprints size={13} />,
  face: <Smile size={13} />,
  users: <Users size={13} />,
  baby: <Baby size={13} />,
  run: <Activity size={13} />,
  clock: <Clock size={13} />,
  waves: <Waves size={13} />,
  wind: <Wind size={13} />,
  leaf: <Leaf size={13} />,
  heart: <Heart size={13} />,
  tool: <Gem size={13} />,
};

function FactChip({ fact }: { fact: Fact }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DCCF] bg-[#FAF6F1] px-2.5 py-1 text-xs text-[#4a4038]">
      <span className="text-[#8a7460]">{FACT_ICONS[fact.icon]}</span>
      <span className="font-semibold">{fact.en}</span>
      <span className="text-[#8a7460]">/ {fact.es}</span>
    </span>
  );
}

function WhoChip({ fact }: { fact: WhoFact }) {
  const c = BEST_FOR_COLORS[fact.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {FACT_ICONS[fact.icon]}
      <span className="font-semibold">{fact.en}</span>
      <span className="opacity-70">/ {fact.es}</span>
    </span>
  );
}

function SectionKicker({ en, es }: { en: string; es: string }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-[1.2px] text-[#B85C38]">
      {en} <span className="font-medium normal-case tracking-normal text-[#8a7460]">/ {es}</span>
    </h3>
  );
}

/** The write-up itself, shared by the overlay and the standalone page. */
export function MassageTypeBody({
  type,
  es,
  videoVariant = "page",
}: {
  type: MassageTypeContent;
  es?: boolean;
  videoVariant?: "page" | "overlay";
}) {
  const facts = factsFor(type.slug);

  if (!facts) {
    const sections: { en: string; esLabel: string; body: { en: string; es: string } }[] = [
      { en: "What it is", esLabel: "Qué es", body: type.what },
      { en: "Where it comes from", esLabel: "De dónde viene", body: type.from },
      { en: "Who it's for", esLabel: "Para quién es", body: type.who },
      { en: "What to expect", esLabel: "Qué esperar", body: type.expect },
    ];
    return (
      <div className="space-y-4">
        <MassageTypeVitals type={type} />
      <MassageTypeVideo slug={type.slug} variant={videoVariant} />
        <MassageTypeVideo slug={type.slug} variant={videoVariant} />
        {sections.map((s) => (
          <div key={s.en}>
            <SectionKicker en={s.en} es={s.esLabel} />
            <p className="mt-1 text-[15px] leading-relaxed text-[#4a4038]">{s.body.en}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-[#8a7460]">{s.body.es}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MassageTypeVitals type={type} />

      <div>
        <SectionKicker en="What it is" es="Qué es" />
        <p className="mt-1 text-[15px] font-semibold leading-snug text-[#4a4038]">{facts.line.en}</p>
        <p className="text-[15px] leading-snug text-[#8a7460]">{facts.line.es}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {facts.what.map((f) => <FactChip key={f.en} fact={f} />)}
        </div>
      </div>

      <div>
        <SectionKicker en="Where it comes from" es="De dónde viene" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FactChip fact={facts.origin} />
        </div>
      </div>

      <div>
        <SectionKicker en="Who it's for" es="Para quién es" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {facts.who.map((f) => <WhoChip key={f.en} fact={f} />)}
        </div>
      </div>

      <div>
        <SectionKicker en="What to expect" es="Qué esperar" />
        <ul className="mt-2 space-y-1.5">
          {facts.expect.slice(0, 3).map((f) => (
            <li key={f.en} className="flex items-center gap-2 text-[15px] text-[#4a4038]">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#FAF6F1] text-[#B85C38]">
                {FACT_ICONS[f.icon]}
              </span>
              <span className="font-semibold">{f.en}</span>
              <span className="text-[#8a7460]">/ {f.es}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}



function Overlay({ type, onClose }: { type: MassageTypeContent; onClose: () => void }) {
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").startsWith("es");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center min-[900px]:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={type.name.en}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl min-[900px]:max-w-[560px] min-[900px]:rounded-3xl min-[900px]:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky -top-5 -mx-5 -mt-5 mb-3 flex items-start justify-between gap-3 bg-white px-5 pb-3 pt-5 min-[900px]:-top-7 min-[900px]:-mx-7 min-[900px]:-mt-7 min-[900px]:px-7 min-[900px]:pt-7">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight text-[#2b2b2b]">{type.name.en}</h2>
            <p className="text-sm text-[#8a7460]">{type.name.es}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close / Cerrar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#E6DCCF] bg-[#FAF6F1] text-[#7A7068]"
          >
            <X size={18} />
          </button>
        </div>

        <MassageTypeBody type={type} es={es} />

        <a
          href={`/massages/${type.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#B85C38] underline underline-offset-2"
        >
          Open full page <span className="font-normal text-[#8a7460]">/ Ver página completa</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Small round (i) button for a service card. Renders nothing when the service
 * name matches no known massage type.
 */
export default function MassageTypeInfoButton({
  names,
  className = "",
}: {
  names: (string | null | undefined)[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const type = findMassageType(...names);
  if (!type) return null;
  
  const openSheet = () => {
    trackEvent("info_sheet_open", { meta: { type: type.slug } });
    setOpen(true);
  };

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {/* Pressure dots deliberately live inside the overlay and on the massage
          type pages only. Menu rows stay clean: name, duration, price, info. */}

      {/* Not a <button>: these sit inside clickable service cards that are
          themselves buttons, and nested buttons are invalid HTML. */}

      <span
        role="button"
        tabIndex={0}
        aria-label={`About ${type.name.en} / Sobre ${type.name.es}`}
        onClick={(e) => {
          stop(e);
          openSheet();
        }}
        onPointerDown={stop}
        onMouseDown={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            stop(e);
            openSheet();
          }
        }}
        className={`inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E6DCCF] bg-[#FAF6F1] text-[#B85C38] motion-safe:transition hover:bg-[#F6EFE6] ${className}`}
      >
        <Info size={16} />
      </span>
      {open && <Overlay type={type} onClose={() => setOpen(false)} />}
    </>
  );
}
