import { X, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompare, comparePath } from "@/lib/compare";
import { useFlowLang } from "@/lib/flowLang";

const COPY = {
  en: { compare: "Compare", clear: "Clear", compareN: (n: number) => `Compare (${n})`, pick: "Pick another studio to compare prices", remove: (name: string) => `Remove ${name}` },
  es: { compare: "Comparar", clear: "Borrar", compareN: (n: number) => `Comparar (${n})`, pick: "Elige otro estudio para comparar precios", remove: (name: string) => `Quitar ${name}` },
  fr: { compare: "Comparer", clear: "Effacer", compareN: (n: number) => `Comparer (${n})`, pick: "Choisissez un autre institut pour comparer les prix", remove: (name: string) => `Retirer ${name}` },
  de: { compare: "Vergleichen", clear: "Leeren", compareN: (n: number) => `Vergleichen (${n})`, pick: "Wähle ein weiteres Studio zum Preisvergleich", remove: (name: string) => `${name} entfernen` },
  it: { compare: "Confronta", clear: "Cancella", compareN: (n: number) => `Confronta (${n})`, pick: "Scegli un altro centro per confrontare i prezzi", remove: (name: string) => `Rimuovi ${name}` },
  pt: { compare: "Comparar", clear: "Limpar", compareN: (n: number) => `Comparar (${n})`, pick: "Escolhe outro estúdio para comparar preços", remove: (name: string) => `Remover ${name}` },
  zh: { compare: "比较", clear: "清除", compareN: (n: number) => `比较 (${n})`, pick: "再选一家门店来比较价格", remove: (name: string) => `移除 ${name}` },
} as const;

/**
 * Sticky bottom bar listing the studios picked for comparison.
 * Hidden when nothing is selected. Disabled until at least two are chosen.
 */
export default function CompareBar({ className = "pb-3" }: { className?: string }) {
  const { items, remove, clear } = useCompare();
  const navigate = useNavigate();
  const lang = useFlowLang();
  const t = COPY[lang];
  if (items.length === 0) return null;

  const ready = items.length >= 2;

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 px-3 pointer-events-none ${className}`}>
      <div className="pointer-events-auto mx-auto max-w-[1100px] rounded-3xl border border-[#E6DCCF] bg-card/98 backdrop-blur shadow-elegant p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> {t.compare}
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
                  aria-label={t.remove(it.name)}
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
              {t.clear}
            </button>
            {ready ? (
              <button
                type="button"
                onClick={() => navigate(comparePath(items.map((i) => i.key)))}
                className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:opacity-90 transition"
              >
                {t.compareN(items.length)}
              </button>
            ) : (
              <span className="inline-flex flex-col justify-center rounded-full border border-dashed border-primary/50 bg-primary/5 px-4 py-2 min-h-11 text-left animate-pulse-once">
                <span className="text-xs font-semibold text-primary leading-tight">
                  {t.pick}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
