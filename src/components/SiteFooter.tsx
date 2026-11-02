import { Link } from "react-router-dom";
import { useFlowLang } from "@/lib/flowLang";
import { cn } from "@/lib/utils";
import { SITE_COPY } from "@/lib/siteChrome";

const linkCls =
  "inline-flex min-h-[32px] items-center text-small text-foreground underline-offset-4 transition-colors duration-state hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

/**
 * One footer for every customer page from 900px up (desktop fix F12): inside
 * the same 1120px container as SiteHeader, so its left edge matches the logo.
 * Three columns: Massage Club and one line; Massages; Studios. Legal links and
 * the support address sit in the bottom row. Every link is a massageclub.io
 * page or the support address.
 *
 * Below 900px it renders nothing visible: phones keep the footers they have.
 * "/reserve" is public/go.html, outside the router, so it is a plain link.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  const lang = useFlowLang();
  const t = SITE_COPY[lang];
  const year = new Date().getFullYear();

  return (
    <footer data-site-footer="" className={cn("hidden desk:block bg-background", className)}>
      <div className="max-w-page mx-auto px-5">
        <div className="border-t border-border pt-12 pb-10 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-10">
          <div className="max-w-[360px]">
            <a href="/" aria-label={t.home} className="inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <img src="/brand/mc-avatar-terracotta.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
              <span className="text-[17px] leading-6 font-semibold tracking-tight text-foreground">Massage Club</span>
            </a>
            <p className="mt-3 text-small text-muted-foreground">{t.oneLine}</p>
          </div>

          <nav aria-label={t.massages}>
            <h2 className="font-body text-small font-semibold tracking-normal text-foreground">
              {t.massages}
            </h2>
            <ul className="mt-3 space-y-1">
              <li>
                <a href="/reserve?src=footer" className={linkCls}>{t.book}</a>
              </li>
              <li>
                <Link to="/studios" className={linkCls}>{t.allStudios}</Link>
              </li>
              <li>
                <Link to="/how-it-works" className={linkCls}>{t.howItWorks}</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.studiosHeading}>
            <h2 className="font-body text-small font-semibold tracking-normal text-foreground">
              {t.studiosHeading}
            </h2>
            <ul className="mt-3 space-y-1">
              <li>
                <Link to="/for-studios" className={linkCls}>{t.forStudios}</Link>
              </li>
              <li>
                <Link to="/partner/login" className={linkCls}>{t.studioLogin}</Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-border py-6 flex items-center justify-between gap-6 text-caption font-normal text-muted-foreground">
          <p>© {year} Massage Club · Madrid</p>
          <ul className="flex items-center gap-5">
            <li>
              <Link to="/privacy" className="underline-offset-4 hover:text-primary hover:underline transition-colors duration-state">{t.privacy}</Link>
            </li>
            <li>
              <Link to="/terms" className="underline-offset-4 hover:text-primary hover:underline transition-colors duration-state">{t.terms}</Link>
            </li>
            <li>
              <a href="mailto:support@massageclub.io" className="underline-offset-4 hover:text-primary hover:underline transition-colors duration-state">support@massageclub.io</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
