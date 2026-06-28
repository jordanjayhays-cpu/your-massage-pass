import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import es from "./es.json";
import zh from "./zh.json";
import fr from "./fr.json";
import de from "./de.json";
import pt from "./pt.json";
import it from "./it.json";
import ar from "./ar.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      zh: { translation: zh },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      it: { translation: it },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "es", "zh", "fr", "de", "pt", "it", "ar"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "mm-lang",
    },
    interpolation: { escapeValue: false },
  });

// Set <html dir> for RTL languages like Arabic
const applyDir = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
};
applyDir(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", applyDir);

export default i18n;

