import { Scale, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare, compareKey } from "@/lib/compare";
import { useFlowLang } from "@/lib/flowLang";

type Props = {
  studio: { slug?: string | null; partner_id?: string | null; id?: string | null; studio?: string | null; name?: string | null };
  className?: string;
  /** Compact variant for tight spots like map cards. */
  size?: "sm" | "md";
};

const COPY = {
  en: { compare: "Compare", limit: "You can compare up to 3 studios" },
  es: { compare: "Comparar", limit: "Puedes comparar hasta 3 estudios" },
  fr: { compare: "Comparer", limit: "Vous pouvez comparer jusqu'à 3 instituts" },
  de: { compare: "Vergleichen", limit: "Du kannst bis zu 3 Studios vergleichen" },
  it: { compare: "Confronta", limit: "Puoi confrontare fino a 3 centri" },
  pt: { compare: "Comparar", limit: "Podes comparar até 3 estúdios" },
  zh: { compare: "比较", limit: "最多可比较 3 家门店" },
} as const;

/**
 * Checkbox-like "Compare" toggle used on studio cards and map popups.
 * Never navigates: it only edits the compare selection.
 */
export default function CompareToggle({ studio, className, size = "md" }: Props) {
  const lang = useFlowLang();
  const t = COPY[lang];
  const { has, isFull, toggle } = useCompare();
  const selected = has(studio);
  const disabled = !selected && isFull;
  const key = compareKey(studio);
  if (!key) return null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(studio);
      }}
      title={disabled ? t.limit : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition",
        size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground/80 border-border hover:border-primary/60",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-[6px] border",
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          selected ? "bg-primary-foreground/95 border-primary-foreground/95" : "border-border bg-background"
        )}
      >
        {selected ? <Check className="h-3 w-3 text-primary" /> : <Scale className="h-2.5 w-2.5 text-muted-foreground" />}
      </span>
      <span className="font-semibold">{t.compare}</span>
    </button>
  );
}
