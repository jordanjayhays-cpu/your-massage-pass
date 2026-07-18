import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import es from "./es.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "mm-lang",
    },
    interpolation: { escapeValue: false },
  });

const applyDir = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.dir = "ltr";
  document.documentElement.lang = lng;
};
applyDir(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", applyDir);

export default i18n;
