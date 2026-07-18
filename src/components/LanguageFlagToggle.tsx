import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lang = "en" | "es";

type Option = {
  id: string;
  lang: Lang;
  countryCode: string;
  countryLabel: string;
  nativeLanguage: string;
};

const OPTIONS: Option[] = [
  { id: "en-US", lang: "en", countryCode: "us", countryLabel: "United States",  nativeLanguage: "English" },
  { id: "es-ES", lang: "es", countryCode: "es", countryLabel: "España",         nativeLanguage: "Español" },
  { id: "es-MX", lang: "es", countryCode: "mx", countryLabel: "México",         nativeLanguage: "Español" },
  { id: "en-GB", lang: "en", countryCode: "gb", countryLabel: "United Kingdom", nativeLanguage: "English" },
];



const STORAGE_KEY = "mm-country";

// Use SVG flags from flagcdn — emoji flags don't render on Windows/Chrome.
function flagUrl(code: string, size: 40 | 80 | 160 = 80) {
  return `https://flagcdn.com/w${size}/${code}.png`;
}
function flagSrcSet(code: string) {
  return `${flagUrl(code, 40)} 1x, ${flagUrl(code, 80)} 2x, ${flagUrl(code, 160)} 3x`;
}

function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <img
      src={flagUrl(code, 80)}
      srcSet={flagSrcSet(code)}
      alt=""
      aria-hidden
      className={`inline-block rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}

function pickInitialOption(currentLang: Lang): Option {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = OPTIONS.find((o) => o.id === saved);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return OPTIONS.find((o) => o.lang === currentLang) ?? OPTIONS[0];
}

async function persistPreferredLanguage(lang: Lang) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_language: lang }).eq("id", user.id);
  } catch {
    /* non-fatal */
  }
}

export function LanguageFlagToggle({
  className = "",
  variant = "compact",
}: {
  className?: string;
  variant?: "compact" | "large";
}) {
  const { i18n } = useTranslation();
  const resolved = (i18n.resolvedLanguage || "en") as Lang;
  const current: Lang = (["en","es"] as const).includes(resolved as any) ? (resolved as Lang) : "en";

  const [selected, setSelected] = useState<Option>(() => pickInitialOption(current));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep selected option in sync if language changes elsewhere.
  useEffect(() => {
    if (selected.lang !== current) {
      const fallback = OPTIONS.find((o) => o.lang === current);
      if (fallback) setSelected(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (opt: Option) => {
    setSelected(opt);
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, opt.id); } catch { /* ignore */ }
    if (opt.lang !== current) {
      i18n.changeLanguage(opt.lang);
      void persistPreferredLanguage(opt.lang);
    }
  };

  if (variant === "large") {
    return (
      <div className={`space-y-2 ${className}`}>
        {OPTIONS.map((o) => {
          const active = selected.id === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o)}
              aria-pressed={active}
              className={`w-full flex items-center gap-3 h-14 px-4 rounded-2xl border transition-all ${
                active
                  ? "bg-[#211C1A] text-[#F7F4F0] border-[#211C1A] shadow-[0_8px_20px_-10px_rgba(33,28,26,0.5)]"
                  : "bg-white text-[#211C1A] border-[#E5DDD3] hover:border-[#C4622D]/60"
              }`}
            >
              <Flag code={o.countryCode} className="h-6 w-9" />
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold leading-tight">{o.nativeLanguage}</div>
                <div className={`text-[11px] ${active ? "text-[#F7F4F0]/70" : "text-[#7A7068]"}`}>
                  {o.countryLabel}
                </div>
              </div>
              {active && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact: single flag pill, opens dropdown
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${selected.nativeLanguage} · ${selected.countryLabel}`}
        className="inline-flex items-center gap-1.5 h-9 pl-1.5 pr-2 rounded-full border border-[#E5DDD3] bg-white/95 backdrop-blur shadow-sm hover:border-[#C4622D]/50"
      >
        <Flag code={selected.countryCode} className="h-5 w-7" />
        <span className="text-[11px] font-semibold text-[#211C1A] hidden sm:inline">
          {selected.lang.toUpperCase()}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[#7A7068]" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-56 rounded-2xl border border-[#E5DDD3] bg-white shadow-[0_20px_50px_-20px_rgba(33,28,26,0.4)] overflow-hidden z-50"
        >
          {OPTIONS.map((o) => {
            const active = selected.id === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(o)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  active ? "bg-[#F7F4F0]" : "hover:bg-[#F7F4F0]/70"
                }`}
              >
                <Flag code={o.countryCode} className="h-5 w-7" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#211C1A] leading-tight">
                    {o.nativeLanguage}
                  </div>
                  <div className="text-[11px] text-[#7A7068] truncate">{o.countryLabel}</div>
                </div>
                {active && <Check className="h-4 w-4 text-[#C4622D]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageFlagToggle;
