import i18n from "@/i18n";
import { supabase } from "@/lib/supabase";

export type PartnerLang = "es" | "en";

export const LANG_STORAGE_KEY = "mm-lang";

/** Default for partners: Spanish unless the browser is clearly English. */
export function defaultPartnerLang(): PartnerLang {
  try {
    const nav = (navigator.language || "es").toLowerCase();
    if (nav.startsWith("en")) return "en";
  } catch { /* ignore */ }
  return "es";
}

/** Switch the UI language now and remember it locally. */
export function applyPartnerLang(lang: PartnerLang) {
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
  if (i18n.resolvedLanguage !== lang) i18n.changeLanguage(lang);
}

/** Read the signed-in partner's preferred_language and apply it. */
export async function loadPartnerLang(): Promise<PartnerLang | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("partners")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();
    const lang = (data as any)?.preferred_language as PartnerLang | undefined;
    if (lang === "es" || lang === "en") {
      applyPartnerLang(lang);
      return lang;
    }
  } catch { /* ignore */ }
  return null;
}

/** Persist the partner's language choice (and apply it). */
export async function savePartnerLang(lang: PartnerLang) {
  applyPartnerLang(lang);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("partners").update({ preferred_language: lang }).eq("id", user.id);
  } catch { /* ignore */ }
}
