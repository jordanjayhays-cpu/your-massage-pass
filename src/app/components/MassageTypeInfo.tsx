import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X, ExternalLink, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { findMassageType, type MassageTypeContent } from "@/lib/massageTypes";

/**
 * Massage type education, without ever losing your place in the booking flow.
 *
 * The (i) button opens an overlay ON TOP of the current page (bottom sheet on
 * mobile, centered modal on desktop). It never selects or deselects the
 * service card it sits inside, and closing it returns you exactly where you
 * were. The "Open full page" link opens the standalone page in a new tab.
 */

/** The write-up itself, shared by the overlay and the standalone page. */
export function MassageTypeBody({ type, es }: { type: MassageTypeContent; es: boolean }) {
  const sections: { en: string; esLabel: string; body: { en: string; es: string } }[] = [
    { en: "What it is", esLabel: "Qué es", body: type.what },
    { en: "Where it comes from", esLabel: "De dónde viene", body: type.from },
    { en: "Who it's for", esLabel: "Para quién es", body: type.who },
    { en: "What to expect", esLabel: "Qué esperar", body: type.expect },
  ];
  return (
    <div className="space-y-4">
      {type.firstTimer && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEFE8] px-3 py-1 text-xs font-semibold text-[#B85C38]">
          <Sparkles size={13} /> Great first massage / Ideal primer masaje
        </span>
      )}
      {sections.map((s) => (
        <div key={s.en}>
          <h3 className="text-sm font-bold uppercase tracking-[1.2px] text-[#B85C38]">
            {s.en} <span className="font-medium normal-case tracking-normal text-[#8a7460]">/ {s.esLabel}</span>
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-[#4a4038]">{s.body.en}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-[#8a7460]">{s.body.es}</p>
        </div>
      ))}
      {es && null}
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

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {/* Not a <button>: these sit inside clickable service cards that are
          themselves buttons, and nested buttons are invalid HTML. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`About ${type.name.en} / Sobre ${type.name.es}`}
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
        onPointerDown={stop}
        onMouseDown={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            stop(e);
            setOpen(true);
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
