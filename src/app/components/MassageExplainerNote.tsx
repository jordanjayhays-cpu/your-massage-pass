import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { findExplainer } from "@/lib/massageExplainers";

/**
 * One Massage Club explainer line for a massage style, with a "Learn more"
 * toggle. Renders nothing when the service name matches no known style.
 *
 * Copy is descriptive only: never any health, detox or immunity claim.
 */
export default function MassageExplainerNote({
  names,
  className = "",
}: {
  /** Service names to match on, English first. */
  names: (string | null | undefined)[];
  className?: string;
}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const es = (i18n.language || "en").startsWith("es");
  const explainer = findExplainer(...names);
  if (!explainer) return null;

  const summary = es ? explainer.summary.es : explainer.summary.en;
  const more = es ? explainer.more.es : explainer.more.en;

  return (
    <div className={`card-auto rounded-2xl border border-[#E6DCCF] bg-[#FAF6F1] p-3 min-[900px]:p-4 ${className}`}>
      <div className="flex gap-2">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[#C4622D]" />
        <div className="min-w-0">
          <p className="text-[11px] min-[900px]:text-xs font-bold uppercase tracking-[1.5px] text-[#C4622D]">
            Massage Club
          </p>
          <p className="mt-1 text-sm min-[900px]:text-base text-[#5a4736] leading-snug">{summary}</p>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1 text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline underline-offset-2"
          >
            {open ? "Show less" : "Learn more"}
            <span className="font-normal">{open ? "/ Ver menos" : "/ Saber más"}</span>
            <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {open && (
            <p className="mt-2 text-sm min-[900px]:text-base text-[#5a4736] leading-relaxed">{more}</p>
          )}
        </div>
      </div>
    </div>
  );
}
