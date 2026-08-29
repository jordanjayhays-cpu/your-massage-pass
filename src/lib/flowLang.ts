import { useTranslation } from "react-i18next";

/**
 * The languages the booking flow is fully translated into.
 * Keep this in sync with `LANGS` in src/components/LanguageFlagToggle.tsx.
 */
export const FLOW_LANGS = ["en", "es", "fr", "de", "it", "pt", "zh"] as const;
export type FlowLang = (typeof FLOW_LANGS)[number];

/** Narrow any raw language string ("de-AT", "pt-BR", undefined) to a supported flow language. */
export function toFlowLang(raw?: string | null): FlowLang {
  const base = (raw || "en").toLowerCase().slice(0, 2);
  return (FLOW_LANGS as readonly string[]).includes(base) ? (base as FlowLang) : "en";
}

/** Current UI language, always one of the supported flow languages. */
export function useFlowLang(): FlowLang {
  const { i18n } = useTranslation();
  return toFlowLang(i18n.resolvedLanguage || i18n.language);
}

/** Copy tables are keyed by language; this always returns a usable entry. */
export type CopyMap<T> = Record<FlowLang, T>;

export function pickCopy<T>(map: Partial<CopyMap<T>> & { en: T }, lang: string | undefined): T {
  return map[toFlowLang(lang)] ?? map.en;
}
