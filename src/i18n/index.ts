import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import de from "./de.json";
import it from "./it.json";
import pt from "./pt.json";
import zh from "./zh.json";

// Arabic was only ever a stub (a handful of handoff keys) so it is not offered:
// a half-translated language reads worse than English. Re-add with a full ar.json.
const SUPPORTED = ["es", "en", "fr", "de", "it", "pt", "zh"] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      it: { translation: it },
      pt: { translation: pt },
      zh: { translation: zh },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED as unknown as string[],
    nonExplicitSupportedLngs: true,
    detection: {
      // ?lang=es on a link (bot, ads, emails) wins, then the visitor's saved
      // choice, then the browser. The link's language is saved, so a reload
      // without the parameter stays in that language.
      order: ["querystring", "localStorage", "navigator"],
      lookupQuerystring: "lang",
      caches: ["localStorage"],
      lookupLocalStorage: "mm-lang",
    },
    interpolation: { escapeValue: false },
  });

// First-visit auto-detect: if no mm-lang set, pick from navigator against SUPPORTED (default en).
// Skipped when the link carries ?lang=, which the detector above already applied.
const hasLangParam = (): boolean => {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("lang");
  } catch {
    return false;
  }
};
try {
  if (typeof window !== "undefined" && !hasLangParam() && !localStorage.getItem("mm-lang")) {
    const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
    const picked = (SUPPORTED as readonly string[]).includes(nav) ? nav : "en";
    if (picked !== i18n.resolvedLanguage) i18n.changeLanguage(picked);
  }
} catch { /* ignore */ }

const applyDir = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.dir = "ltr";
  document.documentElement.lang = lng;
};
applyDir(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", applyDir);

export default i18n;
