import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

const COPY: Record<FlowLang, { code: string; title: string; link: string }> = {
  en: { code: "404", title: "Oops! Page not found", link: "Return to Home" },
  es: { code: "404", title: "¡Vaya! Página no encontrada", link: "Volver al inicio" },
  fr: { code: "404", title: "Oups ! Page introuvable", link: "Retour à l'accueil" },
  de: { code: "404", title: "Hoppla! Seite nicht gefunden", link: "Zurück zur Startseite" },
  it: { code: "404", title: "Ops! Pagina non trovata", link: "Torna alla home" },
  pt: { code: "404", title: "Ups! Página não encontrada", link: "Voltar ao início" },
  zh: { code: "404", title: "哎呀！页面未找到", link: "返回首页" },
};

const NotFound = () => {
  const location = useLocation();
  const lang = useFlowLang();
  const t = COPY[lang];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t.code}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t.title}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t.link}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
