import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const HERO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDxeaNyLnXkeBT2dbpMX2zYNIXLilfjVHy2-ZYdxxt-Qz96RWXVq8ByRIFbypkRZAFsvCYxOUnaj7G0ehW0VPaxP8RE0nks98I9JHL5vxlzFO8kSNuYBqf7wSkzD54uJ3PIN5137TDMdzYAkcbmQPLOi3N4Mlkt8VMgYCPUThkf5Um1vQ4HcYfR17UMpgGa0FTsHTlyXvD5STZOzFyet02k1u8FhrOLN2JiHK8_1dsZNOF_D_oZXuxWZj7hXSJr2j8I4jsAuy49e3mK";

const FEATURED_SLUGS = ["art-thai-massage", "templo-del-masaje", "hammam-al-andalus-madrid"];

type FeaturedStudio = {
  slug: string;
  business_name: string;
  address: string | null;
  price_from: number | null;
};


const STEPS = [
  { n: "01", t: "Browse studios", d: "Explore Madrid's top massage studios. No account needed to look around." },
  { n: "02", t: "Pick your time", d: "See real availability. Book the slot that fits your day." },
  { n: "03", t: "Walk in & relax", d: "Confirmation by email. Pay at the studio. That's it." },
];

export default function Web() {
  const [studios, setStudios] = useState<FeaturedStudio[]>([]);

  useEffect(() => {
    document.title = "Massage Club — Madrid's best massages, booked in seconds";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "Browse Madrid's top-rated massage studios and book in seconds. No account needed. Pay at the studio."
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("partners")
        .select("slug, business_name, address, price_from")
        .in("slug", FEATURED_SLUGS);
      if (cancelled || !data) return;
      // Preserve the FEATURED_SLUGS order.
      const ordered = FEATURED_SLUGS
        .map((s) => data.find((d: any) => d.slug === s))
        .filter(Boolean) as FeaturedStudio[];
      setStudios(ordered);
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <div className="min-h-screen bg-[#F7F4F0] text-[#1f1b19]" style={{ fontFamily: "Outfit, system-ui, sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=EB+Garamond:wght@500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#F7F4F0]/80 border-b border-[#ebe0dd]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[#99420d]">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="text-2xl" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
              Massage Club
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#56433a]">
            <a href="#studios" className="hover:text-[#99420d]">Studios</a>
            <a href="#how" className="hover:text-[#99420d]">How it works</a>
            <a href="#partners" className="hover:text-[#99420d]">For studios</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-sm text-[#56433a] hover:text-[#99420d] hidden sm:inline">Sign in</Link>
            <Link
              to="/app"
              className="bg-[#99420d] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#C4622D] transition"
            >
              Browse studios
            </Link>
          </div>
        </div>
      </header>


      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] uppercase text-[#99420d] font-semibold mb-6">
              <span className="w-8 h-px bg-[#99420d]" /> Madrid · 2026
            </span>
            <h1
              className="text-5xl lg:text-7xl leading-[1.05] text-[#1f1b19] mb-6"
              style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}
            >
              Madrid's best massages, booked in seconds.
            </h1>
            <p className="text-lg text-[#7A7068] max-w-xl mb-8">
              Browse top-rated studios near you. No account needed to look around — pay at the studio.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                to="/app/massages"
                className="bg-[#99420d] text-white px-7 h-12 rounded-full inline-flex items-center font-medium hover:bg-[#C4622D] shadow-[0_8px_24px_rgba(153,66,13,0.25)] transition"
              >
                Browse studios — no account needed
              </Link>
              <Link
                to="/"
                className="border border-[#dcc1b5] bg-white/50 backdrop-blur px-7 h-12 rounded-full inline-flex items-center font-medium text-[#1f1b19] hover:bg-white transition"
              >
                Continue with Google
              </Link>
            </div>
            <div className="flex items-center gap-6 text-sm text-[#56433a]">
              <div className="flex items-center gap-1">
                <span className="text-[#E0A458]">★</span>
                <span className="font-medium">4.8</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-[#dcc1b5]" />
              <span>12+ studios · Madrid</span>
              <span className="w-1 h-1 rounded-full bg-[#dcc1b5]" />
              <span>Pay at studio</span>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-[40px] overflow-hidden shadow-[0_30px_80px_rgba(158,77,34,0.18)]">
              <img src={HERO_IMG} alt="Serene Madrid massage studio" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 hidden md:flex items-center gap-3 max-w-[260px]">
              <div className="w-10 h-10 rounded-full bg-[#ffdbcc] flex items-center justify-center text-[#99420d]">✓</div>
              <div>
                <div className="text-sm font-medium">Booked in 18 seconds</div>
                <div className="text-xs text-[#7A7068]">Average across the network</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured studios */}
      <section id="studios" className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs tracking-[0.15em] uppercase text-[#99420d] font-semibold">Studios near you</span>
            <h2 className="text-3xl lg:text-4xl mt-2" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
              Loved by locals
            </h2>
          </div>
          <Link to="/app/massages" className="text-sm text-[#99420d] hover:underline hidden md:inline">
            See all 12 →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {studios.map((s) => (
            <article
              key={s.slug}
              className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(31,27,25,0.05)] hover:shadow-[0_20px_50px_rgba(31,27,25,0.1)] transition group"
            >
              <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#ffdbcc] via-[#f5c5b0] to-[#e8a88a] flex items-center justify-center">
                <img
                  src="/brand/mc-avatar-cream.png"
                  alt=""
                  className="w-20 h-20 rounded-full object-cover opacity-90 group-hover:scale-110 transition duration-700"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
                    {s.business_name}
                  </h3>
                </div>
                <p className="text-sm text-[#7A7068] mb-3">{s.address || "Madrid"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#56433a]">Massage · Madrid</span>
                  <span className="text-base font-medium text-[#99420d]">
                    {s.price_from != null ? `from €${s.price_from}` : "—"}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-[#f1e6e2] flex items-center justify-between">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#ffdbcc] text-[#C4622D] font-medium">
                    Pay at studio
                  </span>
                  <Link to={`/book/${s.slug}`} className="text-sm font-medium text-[#99420d] hover:underline">
                    Book →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>


      {/* How it works */}
      <section id="how" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-14">
            <span className="text-xs tracking-[0.15em] uppercase text-[#99420d] font-semibold">How it works</span>
            <h2 className="text-3xl lg:text-5xl mt-2" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
              From sore to sorted in three steps.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.n}>
                <div
                  className="text-5xl text-[#ffb693] mb-4"
                  style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}
                >
                  {step.n}
                </div>
                <h3 className="text-xl mb-2" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
                  {step.t}
                </h3>
                <p className="text-[#7A7068] leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner CTA */}
      <section id="partners" className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <div className="rounded-[40px] bg-gradient-to-br from-[#99420d] to-[#b95925] text-white p-10 lg:p-16 grid lg:grid-cols-2 gap-10 items-center overflow-hidden relative">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <span className="text-xs tracking-[0.15em] uppercase text-[#ffdbcc] font-semibold">For studios</span>
            <h2 className="text-3xl lg:text-5xl mt-3 mb-4" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600 }}>
              List your studio in minutes.
            </h2>
            <p className="text-white/85 text-lg mb-8 max-w-md">
              Get discovered by clients looking for a great massage in Madrid. Manage bookings, calendar and clients
              in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/partner/onboarding"
                className="bg-white text-[#99420d] px-7 h-12 rounded-full inline-flex items-center font-medium hover:bg-[#fff8f6] transition"
              >
                Become a partner
              </Link>
              <Link
                to="/partner/login"
                className="border border-white/30 text-white px-7 h-12 rounded-full inline-flex items-center font-medium hover:bg-white/10 transition"
              >
                Partner login
              </Link>
            </div>
          </div>
          <ul className="space-y-4 relative">
            {[
              "Real-time calendar sync with Google",
              "Branded booking link for WhatsApp & Maps",
              "Client profiles, health notes & preferences",
              "No setup fees · Pay only when you get booked",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3 text-white/95">
                <span className="mt-1 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-sm">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#ebe0dd] bg-[#F7F4F0]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 grid sm:grid-cols-3 gap-8 text-sm text-[#56433a]">
          <div>
            <div className="text-[#99420d] mb-2" style={{ fontFamily: "EB Garamond, serif", fontWeight: 600, fontSize: 22 }}>
              ✦ Massage Club
            </div>
            <p className="text-[#7A7068]">Madrid's best massages, booked in seconds.</p>
          </div>
          <div>
            <div className="font-medium text-[#1f1b19] mb-3">Explore</div>
            <ul className="space-y-2">
              <li><Link to="/app/massages" className="hover:text-[#99420d]">Studios</Link></li>
              <li><a href="#how" className="hover:text-[#99420d]">How it works</a></li>
              <li><Link to="/app/bookings" className="hover:text-[#99420d]">My bookings</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-[#1f1b19] mb-3">For studios</div>
            <ul className="space-y-2">
              <li><Link to="/partner/onboarding" className="hover:text-[#99420d]">Become a partner</Link></li>
              <li><Link to="/partner/login" className="hover:text-[#99420d]">Partner login</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#ebe0dd] py-6 text-center text-xs text-[#7A7068]">
          © {new Date().getFullYear()} Massage Club · Madrid
        </div>
      </footer>
    </div>
  );
}
