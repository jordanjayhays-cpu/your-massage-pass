import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { useSiteVisit } from "@/lib/siteVisit";

/**
 * The static tags in index.html would otherwise sit alongside the per-route
 * ones Helmet injects (Helmet only dedupes tags it owns). Park them while a
 * guide page is mounted and put them back on unmount.
 */
function useSuppressStaticHead() {
  useEffect(() => {
    const selectors = [
      'meta[name="description"]:not([data-rh])',
      'link[rel="canonical"]:not([data-rh])',
      'meta[property="og:title"]:not([data-rh])',
      'meta[property="og:description"]:not([data-rh])',
      'meta[property="og:url"]:not([data-rh])',
      'meta[name="twitter:title"]:not([data-rh])',
      'meta[name="twitter:description"]:not([data-rh])',
    ];
    const parked: { el: Element; next: Node | null; parent: Node }[] = [];
    for (const sel of selectors) {
      document.head.querySelectorAll(sel).forEach((el) => {
        parked.push({ el, next: el.nextSibling, parent: el.parentNode! });
        el.remove();
      });
    }
    return () => {
      for (const { el, next, parent } of parked) parent.insertBefore(el, next);
    };
  }, []);
}


const SITE = "https://book.massageclub.io";

export const GUIDES: { path: string; label: string }[] = [
  { path: "/massage-in-english-madrid", label: "Massage in English, Madrid" },
  { path: "/guides/massage-prices-madrid", label: "Massage prices in Madrid" },
  { path: "/guides/deep-tissue-massage-madrid", label: "Deep tissue massage Madrid" },
  { path: "/madrid/chamberi", label: "Massage in Chamberí" },
  { path: "/guides/is-massage-good-for-you", label: "Is massage good for you?" },
];

export default function GuideLayout({
  path,
  title,
  description,
  jsonLd,
  children,
}: {
  path: string;
  title: string;
  description: string;
  jsonLd?: Record<string, unknown>;
  children: ReactNode;
}) {
  useSiteVisit(path);
  useSuppressStaticHead();
  const url = `${SITE}${path}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {jsonLd && (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        )}
      </Helmet>

      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/brand/mc-avatar-terracotta.png" alt="Massage Club" className="h-8 w-8 rounded-full" />
            <span className="font-display text-lg tracking-tight text-foreground">Massage Club</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageFlagToggle />
            <Link
              to="/partner"
              className="hidden sm:inline-flex h-9 px-4 rounded-full border border-border/80 text-foreground text-[11px] font-bold tracking-[0.12em] uppercase hover:bg-accent transition items-center"
            >
              For studios
            </Link>
            <Link
              to="/app"
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tracking-[0.12em] uppercase shadow-soft hover:opacity-90 transition inline-flex items-center gap-1.5"
            >
              Open app <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">{children}</main>

      <footer className="border-t border-border/60 bg-background mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary mb-2">Guides</p>
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {GUIDES.map((g) => (
                <li key={g.path}>
                  <Link to={g.path} className="hover:text-primary transition underline-offset-2 hover:underline">
                    {g.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Massage Club · Madrid <span className="mx-1">·</span>{" "}
            <Link to="/privacy" className="hover:text-primary transition underline-offset-2 hover:underline">
              Privacy
            </Link>
            <span className="mx-1">·</span>{" "}
            <Link to="/terms" className="hover:text-primary transition underline-offset-2 hover:underline">
              Terms
            </Link>
            <span className="mx-1">·</span>{" "}
            <a href="mailto:support@massageclub.io" className="hover:text-primary transition underline-offset-2 hover:underline">
              support@massageclub.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export function CalmaCard({ note }: { note?: string }) {
  return (
    <aside className="my-8 rounded-2xl border border-border/60 bg-card shadow-soft p-5">
      <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary">Bookable in English</p>
      <h2 className="font-display text-2xl text-foreground mt-1">Calma Madrid</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Chamberí · C. de Domenico Scarlatti 5 · near metro Ríos Rosas · ★ 4.9 on Google
      </p>
      <p className="text-sm text-foreground/85 mt-3">
        {note ??
          "Deep tissue (Masaje Descontracturante, 60 min · €85), Kobido facial (60 min · €45) and relaxing rituals. Book online in English — you pay at the studio."}
      </p>
      <Link
        to="/spa-calma"
        className="mt-4 inline-flex h-10 px-5 items-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold tracking-[0.12em] uppercase shadow-soft hover:opacity-90 transition"
      >
        View Calma Madrid
      </Link>
    </aside>
  );
}

export function GuideLinks({ exclude }: { exclude: string }) {
  return (
    <nav className="mt-10 border-t border-border/60 pt-6">
      <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary mb-2">Keep reading</p>
      <ul className="space-y-1 text-sm">
        {GUIDES.filter((g) => g.path !== exclude).map((g) => (
          <li key={g.path}>
            <Link to={g.path} className="text-foreground hover:text-primary underline-offset-2 hover:underline transition">
              {g.label}
            </Link>
          </li>
        ))}
        <li>
          <Link to="/spa-calma" className="text-foreground hover:text-primary underline-offset-2 hover:underline transition">
            Calma Madrid — book a massage
          </Link>
        </li>
      </ul>
    </nav>
  );
}
