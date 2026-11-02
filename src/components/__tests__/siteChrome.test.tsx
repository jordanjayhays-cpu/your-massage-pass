import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_COPY } from "@/lib/siteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteChrome } from "@/components/SiteChrome";
import { NOT_FOUND_DESK_COPY } from "@/pages/NotFound";
import { FLOW_LANGS } from "@/lib/flowLang";

// House rules for the shared desktop header and footer (CLAUDE.md, design
// system 6.3): no em or en dashes, no promise that anyone speaks English, no
// instant or confirmed booking, no deals, and links to our own pages only.
const BANNED = [
  /[–—]/,
  /\p{L} - \p{L}/u,
  /instant/i,
  /confirmed/i,
  /english[- ]speaking/i,
  /\bdeals?\b/i,
  /\boffers?\b/i,
  /\bpartner\b/i,
  /detox|toxin|immun/i,
];

function problems(texts: string[]) {
  return texts.filter((t) => BANNED.some((re) => re.test(t)));
}

describe("SiteHeader and SiteFooter copy", () => {
  it("has every string in all seven languages, within the rules", () => {
    const keys = Object.keys(SITE_COPY.en);
    for (const lang of FLOW_LANGS) {
      const t = SITE_COPY[lang] as Record<string, string>;
      expect(Object.keys(t).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(t[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(problems(Object.values(t)), lang).toEqual([]);
    }
  });

  it("uses the agreed English and Spanish labels", () => {
    expect([SITE_COPY.en.studios, SITE_COPY.en.howItWorks, SITE_COPY.en.forStudios, SITE_COPY.en.signIn]).toEqual([
      "Studios", "How it works", "For studios", "Sign in",
    ]);
    expect([SITE_COPY.es.studios, SITE_COPY.es.howItWorks, SITE_COPY.es.forStudios, SITE_COPY.es.signIn]).toEqual([
      "Centros", "Cómo funciona", "Para centros", "Entrar",
    ]);
  });

  it("keeps the not-found copy within the rules", () => {
    for (const lang of FLOW_LANGS) expect(problems(Object.values(NOT_FOUND_DESK_COPY[lang])), lang).toEqual([]);
  });
});

describe("SiteHeader and SiteFooter links", () => {
  const hrefs = (root: HTMLElement) => [...root.querySelectorAll("a")].map((a) => a.getAttribute("href") || "");

  it("link only to massageclub.io pages or the support address", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/studios"]}>
        <SiteHeader />
        <SiteFooter />
      </MemoryRouter>,
    );
    const all = hrefs(container);
    expect(all.length).toBeGreaterThan(8);
    for (const h of all) expect(h === "mailto:support@massageclub.io" || h.startsWith("/"), h).toBe(true);
    expect(all).toEqual(expect.arrayContaining(["/", "/studios", "/how-it-works", "/for-studios", "/privacy", "/terms", "/partner/login"]));
  });

  it("are hidden below 900px (phones keep their own header and footer)", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteHeader />
        <SiteFooter />
      </MemoryRouter>,
    );
    const header = container.querySelector("[data-site-header]")!;
    const footer = container.querySelector("[data-site-footer]")!;
    expect(header.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(header.className).toMatch(/desk:block/);
    expect(footer.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(footer.className).toMatch(/desk:block/);
  });

  it("marks the current section", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/how-it-works"]}>
        <SiteHeader />
      </MemoryRouter>,
    );
    const current = container.querySelector('a[aria-current="page"]');
    expect(current?.getAttribute("href")).toBe("/how-it-works");
  });
});

describe("SiteChrome", () => {
  it("draws the header and footer once, even when nested", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteChrome>
          <SiteChrome>
            <p>page</p>
          </SiteChrome>
        </SiteChrome>
      </MemoryRouter>,
    );
    expect(container.querySelectorAll("[data-site-header]").length).toBe(1);
    expect(container.querySelectorAll("[data-site-footer]").length).toBe(1);
  });
});
