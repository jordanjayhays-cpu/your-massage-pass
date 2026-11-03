import { Link, useLocation } from "react-router-dom";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { useFlowLang } from "@/lib/flowLang";
import { SITE_COPY, useSignedIn } from "@/lib/siteChrome";
import { cn } from "@/lib/utils";

function isActive(pathname: string, prefixes: string[], exact: string[] = []) {
  return exact.includes(pathname) || prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Small copy of the logo (64px, about 1 KB) for the 32px header and 28px
 *  footer marks. Lazy: phones never show either, and a lazy image inside a
 *  display:none header is not downloaded (the 1024px PNG was 243 KB). */
export const SITE_LOGO_SRC = "/brand/mc-avatar-terracotta-64.webp";

/** Active and hover text: #A34A22, 5.4:1 on the cream page and 5.3:1 on the
 *  #FBF1EB tint. Terracotta #C4622D is 3.8:1, under AA for 15px text. */
const ACTION_TEXT = "text-[#A34A22] decoration-[#A34A22]";

/**
 * One header for every customer page from 900px up (design system 3.3, desktop
 * fix F11): 64px tall, inside the 1120px page container with 20px gutters, so
 * the logo starts where the page content starts. Logo on the left; Studios,
 * How it works, For studios, Sign in and the language picker on the right.
 *
 * Below 900px it renders nothing visible: phones and tablets keep the headers
 * each page already has. In the app shell (MobileFrame) it is the first flex
 * item above the scroller; on pages that scroll the window it is sticky.
 */
export function SiteHeader({ className = "" }: { className?: string }) {
  const lang = useFlowLang();
  const t = SITE_COPY[lang];
  const { pathname } = useLocation();
  const signedIn = useSignedIn();

  const links: { to: string; label: string; match: string[]; exact?: string[] }[] = [
    // "/massages" itself redirects to the list; /massages/swedish and the
    // other massage-type guides are not the studio list.
    { to: "/studios", label: t.studios, match: ["/studios"], exact: ["/massages"] },
    { to: "/how-it-works", label: t.howItWorks, match: ["/how-it-works"] },
    { to: "/for-studios", label: t.forStudios, match: ["/for-studios", "/para-estudios"] },
  ];

  const account = signedIn
    ? { to: "/app/profile", label: t.myAccount, match: ["/app/profile", "/profile", "/app/bookings", "/bookings"] }
    : { to: "/login", label: t.signIn, match: ["/login"] };
  const accountActive = isActive(pathname, account.match);

  return (
    <header
      data-site-header=""
      className={cn(
        "hidden desk:block h-16 sticky top-0 z-header flex-shrink-0 bg-background border-b border-border",
        className,
      )}
    >
      <div className="max-w-page mx-auto px-5 h-full flex items-center justify-between gap-6">
        {/* A plain link on purpose: on book.massageclub.io "/" opens the request
            flow (/reserve, a page outside the router), so a full load is needed. */}
        <a
          href="/"
          aria-label={t.home}
          className="group flex items-center gap-2.5 rounded-full pr-2 h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={SITE_LOGO_SRC}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="text-[17px] leading-6 font-semibold tracking-tight text-foreground group-hover:text-[#A34A22] transition-colors duration-state">
            Massage Club
          </span>
        </a>

        <nav aria-label={t.nav} className="flex items-center gap-1">
          <ul className="flex items-center gap-1">
            {links.map((l) => {
              const active = isActive(pathname, l.match, l.exact);
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center rounded-full px-3 text-label underline-offset-[6px] decoration-2 transition-colors duration-state",
                      "hover:text-[#A34A22] hover:underline hover:decoration-[#A34A22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? `${ACTION_TEXT} underline` : "text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            to={account.to}
            aria-current={accountActive ? "page" : undefined}
            className={cn(
              "ml-2 inline-flex h-10 items-center rounded-full border px-4 text-label transition-colors duration-state",
              "hover:bg-brand-tint hover:border-[#A34A22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // #8F847B is the control edge from design system 3.1 (3.65:1 on
              // white); --input still holds the old sand value until the codemod.
              accountActive ? "border-[#A34A22] text-[#A34A22] bg-brand-tint" : "border-[#8F847B] text-foreground bg-card",
              // Keep the width steady while the session loads.
              signedIn === null && "invisible",
            )}
          >
            {account.label}
          </Link>
          <LanguageFlagToggle className="ml-2" />
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
