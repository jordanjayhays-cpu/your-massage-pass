import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";
import { SiteChrome } from "@/components/SiteChrome";

// Phones and tablets keep the page as it was.
const COPY: Record<FlowLang, { code: string; title: string; link: string }> = {
  en: { code: "404", title: "Oops! Page not found", link: "Return to Home" },
  es: { code: "404", title: "¡Vaya! Página no encontrada", link: "Volver al inicio" },
  fr: { code: "404", title: "Oups ! Page introuvable", link: "Retour à l'accueil" },
  de: { code: "404", title: "Hoppla! Seite nicht gefunden", link: "Zurück zur Startseite" },
  it: { code: "404", title: "Ops! Pagina non trovata", link: "Torna alla home" },
  pt: { code: "404", title: "Ups! Página não encontrada", link: "Voltar ao início" },
  zh: { code: "404", title: "哎呀！页面未找到", link: "返回首页" },
};

// From 900px (desktop fix F16): one way on (ask studios through /reserve) and
// one way around (the studio list). No studio is named, as on the studio
// not-found page (StudioBookingPage, 31 Oct).
export const NOT_FOUND_DESK_COPY: Record<FlowLang, { title: string; line: string; ask: string; browse: string }> = {
  en: {
    title: "We couldn't find that page.",
    line: "The link may be old or mistyped. We can still ask professional massage studios near you.",
    ask: "Ask studios near me",
    browse: "Browse all studios",
  },
  es: {
    title: "No hemos encontrado esa página.",
    line: "Puede que el enlace sea antiguo o tenga un error. Aun así podemos preguntar a centros de masaje profesionales cerca de ti.",
    ask: "Preguntar a centros cerca de mí",
    browse: "Ver todos los centros",
  },
  fr: {
    title: "Nous n'avons pas trouvé cette page.",
    line: "Le lien est peut-être ancien ou mal saisi. Nous pouvons quand même demander à des centres de massage professionnels près de chez vous.",
    ask: "Demander aux centres proches",
    browse: "Voir tous les centres",
  },
  de: {
    title: "Diese Seite haben wir nicht gefunden.",
    line: "Der Link ist vielleicht alt oder falsch geschrieben. Wir können trotzdem professionelle Massagestudios in deiner Nähe fragen.",
    ask: "Studios in der Nähe fragen",
    browse: "Alle Studios ansehen",
  },
  it: {
    title: "Non abbiamo trovato questa pagina.",
    line: "Il link potrebbe essere vecchio o sbagliato. Possiamo comunque chiedere a centri di massaggio professionali vicino a te.",
    ask: "Chiedi ai centri vicini",
    browse: "Vedi tutti i centri",
  },
  pt: {
    title: "Não encontrámos esta página.",
    line: "O link pode ser antigo ou ter um erro. Mesmo assim, podemos perguntar a estúdios de massagem profissionais perto de ti.",
    ask: "Perguntar a estúdios perto de mim",
    browse: "Ver todos os estúdios",
  },
  zh: {
    title: "没有找到这个页面。",
    line: "链接可能已过期或输入有误。我们仍可以帮您询问附近的专业按摩店。",
    ask: "询问附近的按摩店",
    browse: "查看全部按摩店",
  },
};

const NotFound = () => {
  const location = useLocation();
  const lang = useFlowLang();
  const t = COPY[lang];
  const d = NOT_FOUND_DESK_COPY[lang];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // /reserve is public/go.html (outside the router): a plain link. go.html
  // reads the site's saved language; ?lang=es keeps Spanish for a fresh tab.
  const askHref = lang === "es" ? "/reserve?lang=es&src=404" : "/reserve?src=404";

  return (
    <SiteChrome>
      <div className="flex min-h-screen items-center justify-center bg-muted desk:hidden">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">{t.code}</h1>
          <p className="mb-4 text-xl text-muted-foreground">{t.title}</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            {t.link}
          </a>
        </div>
      </div>

      <main className="hidden desk:block bg-background">
        <div className="max-w-page mx-auto px-5 pt-24 pb-28">
          <div className="max-w-[560px] mx-auto text-center">
            <p className="text-caption text-muted-foreground">404</p>
            <h1 className="mt-2 text-h1 text-foreground">{d.title}</h1>
            <p className="mt-4 text-lead text-muted-foreground">{d.line}</p>
            <div className="mt-8 flex items-center justify-center gap-6">
              <a
                href={askHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-button text-primary-foreground transition-colors duration-state hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {d.ask}
              </a>
              <Link
                to="/studios"
                className="inline-flex h-11 items-center text-label text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {d.browse}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
};

export default NotFound;
