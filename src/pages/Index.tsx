import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Check, MapPin, Sparkles, Infinity as InfinityIcon, Heart, Bell, User, Gift, Star } from "lucide-react";
import madridHero from "@/assets/madrid-hero.jpg";
import { LanguageToggle } from "@/components/LanguageToggle";
import { saveLead } from "@/lib/supabase";

const SHOPS = [
  { name: "Casa Cibeles", district: "Centro", specialtyKey: "swedish" },
  { name: "El Retiro Wellness", district: "Retiro", specialtyKey: "deep" },
  { name: "Salamanca Spa Real", district: "Salamanca", specialtyKey: "stone" },
  { name: "Chamberí Manos", district: "Chamberí", specialtyKey: "sports" },
  { name: "Malasaña Holístico", district: "Malasaña", specialtyKey: "thai" },
  { name: "La Latina Termas", district: "La Latina", specialtyKey: "lomi" },
  { name: "Chueca Body Studio", district: "Chueca", specialtyKey: "reflex" },
  { name: "Las Letras Zen", district: "Barrio de las Letras", specialtyKey: "cranio" },
] as const;

const Index = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error(t("toast.invalid"));
      return;
    }
    setLoading(true);
    const ok = await saveLead(email, "", "landing_page");
    setLoading(false);
    if (ok) {
      toast.success("You're in! Check your email for next steps.");
      setEmail("");
    } else {
      toast.error("Something went wrong. Try again.");
    }
  };

  const stats = [
    { n: "8+", l: t("stats.studios") },
    { n: "€79", l: t("stats.price") },
    { n: "∞", l: t("stats.massages") },
    { n: "9", l: t("stats.districts") },
  ];

  const steps = [
    { icon: Heart, title: t("how.step1.title"), desc: t("how.step1.desc") },
    { icon: MapPin, title: t("how.step2.title"), desc: t("how.step2.desc") },
    { icon: InfinityIcon, title: t("how.step3.title"), desc: t("how.step3.desc") },
  ];

  const features = [
    "Unlimited massages per month",
    "Access all 8+ partner studios",
    "Same-day booking available",
    "Cancel anytime — no questions",
    "Your preferences saved everywhere",
    "Automated reminders (SMS + email)",
    "Referral credits (€10 per friend)",
    "Instant booking confirmation",
  ];

  const faqs = [1, 2, 3, 4].map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }));

  // Features learned from booking platform research
  const platformFeatures = [
    {
      icon: Bell,
      title: "Automated reminders",
      titleEs: "Recordatorios automáticos",
      desc: "Never miss an appointment. We send you SMS + email reminders 24h and 1h before — like Fresha and Jane App do.",
      descEs: "Nunca pierdas una cita. Te enviamos recordatorios por SMS y email 24h y 1h antes.",
      highlight: "No more no-shows"
    },
    {
      icon: User,
      title: "Your personal profile",
      titleEs: "Tu perfil personal",
      desc: "Your massage history, preferred pressure, allergies, favorite therapists — all saved in one place. Book anywhere and your preferences follow you.",
      descEs: "Tu historial de masajes, presión preferida, alergias, terapeutas favoritos — todo en un solo lugar.",
      highlight: "Preferences travel with you"
    },
    {
      icon: Gift,
      title: "Referral credits",
      titleEs: "Créditos por referrals",
      desc: "Share with a friend. They get €10 off their first month. You get €10 credit. Everyone wins — modeled after Fresha's referral system.",
      descEs: "Recomienda a un amigo. Ellos reciben €10 de descuento en su primer mes. Tú recibes €10 de crédito.",
      highlight: "€10 for you, €10 for them"
    },
    {
      icon: Star,
      title: "Instant booking",
      titleEs: "Reserva instantánea",
      desc: "Real-time availability at every partner studio. Book in 2 taps. Get confirmed instantly — no phone calls, no waiting.",
      descEs: "Disponibilidad en tiempo real en cada estudio parceiro. Reserva en 2 clics. Confirmación instantánea.",
      highlight: "2 taps. Done."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="container flex items-center justify-between py-6">
          <a href="#" className="flex items-center gap-2 text-primary-foreground">
            <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
              <span className="font-display font-bold text-foreground">M</span>
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-primary-foreground">
              Massage Club
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-primary-foreground/90">
            <a href="#estudios" className="hover:text-accent transition-colors">{t("nav.studios")}</a>
            <a href="#como-funciona" className="hover:text-accent transition-colors">{t("nav.how")}</a>
            <a href="#faq" className="hover:text-accent transition-colors">{t("nav.faq")}</a>
            <a href="/partner/onboarding" className="text-accent hover:text-accent/80 transition-colors font-semibold">List your studio</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <a href="/app">Open app</a>
            </Button>
            <Button asChild variant="secondary" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
              <a href="#join">{t("nav.join")}</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[100vh] flex items-center overflow-hidden">
        <img
          src={madridHero}
          alt="Madrid skyline at dusk with Cibeles fountain"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/85 via-foreground/60 to-foreground/90" />

        <div className="container relative z-10 pt-32 pb-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-foreground/30 backdrop-blur-sm px-4 py-1.5 mb-8">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium uppercase tracking-widest text-primary-foreground">
                {t("hero.badge")}
              </span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground text-balance leading-[1.05] mb-6">
              {t("hero.title1")}
              <span className="block italic font-normal text-accent">{t("hero.title2")}</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/85 max-w-2xl mb-10 text-balance leading-relaxed">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <form onSubmit={handleJoin} className="flex-1 flex gap-2">
                <Input
                  type="email"
                  placeholder={t("hero.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-background/95 border-0 text-foreground placeholder:text-muted-foreground"
                  aria-label="Email"
                />
                <Button type="submit" size="lg" className="h-12 bg-gradient-gold text-foreground hover:opacity-90 shadow-gold font-semibold whitespace-nowrap">
                  {t("hero.cta")}
                </Button>
              </form>
              <a href="/app" className="h-12 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center font-semibold text-sm transition">
                Book now →
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-6 mt-8 text-sm text-primary-foreground/80">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {t("hero.perks.noCommitment")}</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {t("hero.perks.cancel")}</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {t("hero.perks.launch")}</div>
              <a href="/partner/onboarding" className="flex items-center gap-2 ml-4 text-accent font-semibold hover:text-accent/80 transition-colors">
                Are you a studio? List here →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-gradient-royal text-primary-foreground py-12 border-y-4 border-accent">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="font-display text-4xl md:text-5xl font-bold text-accent">{s.n}</div>
              <div className="text-sm uppercase tracking-wider mt-2 text-primary-foreground/80">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-24 bg-gradient-warm">
        <div className="container">
          <div className="max-w-2xl mb-16">
            <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("how.kicker")}</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance">
              {t("how.title")}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <Card key={step.title} className="p-8 bg-card border-border shadow-soft hover:shadow-elegant transition-all duration-500 group">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-14 w-14 rounded-full bg-gradient-royal flex items-center justify-center shadow-elegant group-hover:scale-110 transition-transform">
                    <step.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <span className="font-display text-5xl font-bold text-accent/40">0{i + 1}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Studios */}
      <section id="estudios" className="py-24 bg-background">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("studios.kicker")}</p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance">
                {t("studios.title")}
              </h2>
            </div>
            <p className="text-muted-foreground md:max-w-sm">
              {t("studios.subtitle")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHOPS.map((shop) => (
              <Card
                key={shop.name}
                className="p-6 bg-card border-border hover:border-primary hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3">
                  <MapPin className="h-3 w-3" />
                  {shop.district}
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {shop.name}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`studios.specialties.${shop.specialtyKey}`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Platform features section — learned from Fresha, Jane App, Booksy */}
      <section className="py-24 bg-gradient-warm border-t-4 border-accent">
        <div className="container">
          <div className="max-w-2xl mb-16">
            <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">What you get</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance">
              Everything the best booking platforms offer — in one membership
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              We studied Fresha, Jane App, Booksy and Mindbody. Then we put everything that matters into Massage Club — and made it simple.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {platformFeatures.map((f) => (
              <Card key={f.title} className="p-8 bg-card border-border shadow-soft hover:shadow-elegant transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 rounded-full bg-gradient-gold/20 blur-2xl group-hover:bg-gradient-gold/30 transition-all" />
                <div className="h-12 w-12 rounded-xl bg-gradient-royal flex items-center justify-center shadow-elegant mb-5">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="inline-block rounded-full bg-accent/10 text-accent text-xs font-bold px-3 py-1 mb-3">
                  {f.highlight}
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="join" className="py-24 bg-gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, hsl(var(--accent)) 0%, transparent 50%)" }} />
        <div className="container relative">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-accent font-semibold mb-3">{t("pricing.kicker")}</p>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-balance mb-6">
              {t("pricing.title")}
            </h2>

            <Card className="p-10 bg-card/95 backdrop-blur text-foreground border-accent/30 shadow-elegant mt-12 text-left">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display text-6xl font-bold text-primary">€79</span>
                <span className="text-muted-foreground">{t("pricing.perMonth")}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">{t("pricing.founder")}</p>

              <ul className="space-y-3 mb-8">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-foreground" />
                    </div>
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <form onSubmit={handleJoin} className="flex flex-col gap-3">
                  <Input
                    type="email"
                    placeholder={t("hero.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                    aria-label="Email"
                  />
                  <Button type="submit" size="lg" className="h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant font-semibold">
                    {t("pricing.cta")}
                  </Button>
                </form>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <a href="/app" className="block w-full h-12 bg-gradient-gold text-foreground hover:opacity-90 rounded-xl flex items-center justify-center font-semibold text-base transition">
                  Open the app →
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-background">
        <div className="container max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("faq.kicker")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-12 text-balance">
            {t("faq.title")}
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="font-display text-lg text-left hover:text-primary">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-primary-foreground py-12 border-t-4 border-accent">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center">
              <span className="font-display font-bold text-foreground text-sm">M</span>
            </div>
            <span className="font-display text-lg font-semibold">Massage Club</span>
          </div>
          <p className="text-sm text-primary-foreground/70">
            {t("footer")} · jordan@massageclub.io
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
