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
import ar from "./ar.json";

const SUPPORTED = ["es", "en", "fr", "de", "it", "pt", "zh", "ar"] as const;

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
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED as unknown as string[],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "mm-lang",
    },
    interpolation: { escapeValue: false },
  });

// First-visit auto-detect: if no mm-lang set, pick from navigator against SUPPORTED (default en).
try {
  if (typeof window !== "undefined" && !localStorage.getItem("mm-lang")) {
    const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
    const picked = (SUPPORTED as readonly string[]).includes(nav) ? nav : "en";
    if (picked !== i18n.resolvedLanguage) i18n.changeLanguage(picked);
  }
} catch { /* ignore */ }

const applyDir = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
};
applyDir(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", applyDir);

export default i18n;
