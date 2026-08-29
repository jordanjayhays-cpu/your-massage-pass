import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import AccountHeaderLink from "@/components/AccountHeaderLink";
import BookFlowWizard, { BOOK_FLOW_COPY, useBookFlowLang } from "@/components/BookFlowWizard";

export default function BookFlow() {
  const lang = useBookFlowLang();
  const t = BOOK_FLOW_COPY[lang] ?? BOOK_FLOW_COPY.en;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{t.seoTitle}</title>
        <meta name="description" content={t.seoDesc} />
        <link rel="canonical" href="https://book.massageclub.io/book" />
      </Helmet>

      <header className="border-b border-border/60 bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg tracking-tight text-foreground">
            Massage Club
          </Link>
          <div className="flex items-center gap-3">
            <AccountHeaderLink />
            <LanguageFlagToggle variant="compact" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-32 pt-6">
        <BookFlowWizard source="book-flow" lang={lang} />
      </main>
    </div>
  );
}
