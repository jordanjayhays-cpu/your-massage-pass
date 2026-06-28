import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

type Lang = "es" | "en";

const LANGS: { code: Lang; flag: string; native: string }[] = [
  { code: "es", flag: "🇪🇸", native: "Español" },
  { code: "en", flag: "🇬🇧", native: "English" },
];

async function persistPreferredLanguage(lang: Lang) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_language: lang }).eq("id", user.id);
  } catch {
    // non-fatal — localStorage already saved via i18next
  }
}

/**
 * Compact pill toggle — for app headers / always-visible placements.
 * Shows both flags side by side; active one is highlighted.
 */
export function LanguageFlagToggle({
  className = "",
  variant = "compact",
}: {
  className?: string;
  variant?: "compact" | "large";
}) {
  const { i18n } = useTranslation();
  const current: Lang = i18n.resolvedLanguage === "es" ? "es" : "en";

  const set = (lang: Lang) => {
    if (lang === current) return;
    i18n.changeLanguage(lang);
    void persistPreferredLanguage(lang);
  };

  if (variant === "large") {
    return (
      <div className={`flex gap-3 ${className}`}>
        {LANGS.map((l) => {
          const active = current === l.code;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => set(l.code)}
              aria-pressed={active}
              aria-label={l.native}
              className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-full border transition-all ${
                active
                  ? "bg-[#211C1A] text-[#F7F4F0] border-[#211C1A] shadow-[0_8px_20px_-10px_rgba(33,28,26,0.5)]"
                  : "bg-white text-[#211C1A] border-[#E5DDD3] hover:border-[#C4622D]/50"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>{l.flag}</span>
              <span className="text-sm font-medium">{l.native}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // compact pill — for headers
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-[#E5DDD3] bg-white/90 backdrop-blur p-0.5 shadow-sm ${className}`}
      role="group"
      aria-label="Language / Idioma"
    >
      {LANGS.map((l) => {
        const active = current === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => set(l.code)}
            aria-pressed={active}
            aria-label={l.native}
            title={l.native}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-medium transition-colors ${
              active ? "bg-[#211C1A] text-[#F7F4F0]" : "text-[#7A7068] hover:text-[#211C1A]"
            }`}
          >
            <span className="text-base leading-none" aria-hidden>{l.flag}</span>
            <span className="hidden sm:inline">{l.native}</span>
          </button>
        );
      })}
    </div>
  );
}

export default LanguageFlagToggle;
