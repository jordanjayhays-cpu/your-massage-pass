import { X, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompare, comparePath } from "@/lib/compare";

/**
 * Sticky bottom bar listing the studios picked for comparison.
 * Hidden when nothing is selected. Disabled until at least two are chosen.
 */
export default function CompareBar({ className = "pb-3" }: { className?: string }) {
  const { items, remove, clear } = useCompare();
  const navigate = useNavigate();
  if (items.length === 0) return null;

  const ready = items.length >= 2;

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 px-3 pointer-events-none ${className}`}>
      <div className="pointer-events-auto mx-auto max-w-[1100px] rounded-3xl border border-[#E6DCCF] bg-card/98 backdrop-blur shadow-elegant p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> Compare
          </span>

          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
            {items.map((it) => (
              <span
                key={it.key}
                className="inline-flex items-center gap-1.5 max-w-[200px] rounded-full bg-secondary px-3 py-1.5 text-xs text-foreground"
              >
                <span className="truncate">{it.name}</span>
                <button
                  type="button"
                  onClick={() => remove(it.key)}
                  aria-label={`Remove ${it.name} / Quitar ${it.name}`}
                  className="h-5 w-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear <span className="text-muted-foreground/70">· Borrar</span>
            </button>
            {ready ? (
              <button
                type="button"
                onClick={() => navigate(comparePath(items.map((i) => i.key)))}
                className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:opacity-90 transition"
              >
                Compare ({items.length})
              </button>
            ) : (
              <span className="inline-flex flex-col justify-center rounded-full border border-dashed border-primary/50 bg-primary/5 px-4 py-2 min-h-11 text-left animate-pulse-once">
                <span className="text-xs font-semibold text-primary leading-tight">
                  Pick another studio to compare prices
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Elige otro estudio para comparar precios
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
