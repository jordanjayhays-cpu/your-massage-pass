import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Check, MapPin, Sparkles, Infinity as InfinityIcon, Heart } from "lucide-react";
import madridHero from "@/assets/madrid-hero.jpg";

const SHOPS = [
  { name: "Casa Cibeles", district: "Centro", specialty: "Swedish & Aromaterapia" },
  { name: "El Retiro Wellness", district: "Retiro", specialty: "Deep Tissue" },
  { name: "Salamanca Spa Real", district: "Salamanca", specialty: "Hot Stone" },
  { name: "Chamberí Manos", district: "Chamberí", specialty: "Sports Recovery" },
  { name: "Malasaña Holístico", district: "Malasaña", specialty: "Thai & Shiatsu" },
  { name: "La Latina Termas", district: "La Latina", specialty: "Lomi Lomi" },
  { name: "Chueca Body Studio", district: "Chueca", specialty: "Reflexology" },
  { name: "Las Letras Zen", district: "Barrio de las Letras", specialty: "Craniosacral" },
];

const FAQS = [
  { q: "¿Cómo funciona la suscripción?", a: "Pagas €79 al mes y reservas masajes ilimitados en cualquiera de nuestros estudios asociados en Madrid. Sin pagos por visita." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. No hay contratos ni permanencia. Cancela desde la app en un clic." },
  { q: "¿Qué tipos de masaje están incluidos?", a: "Todos: sueco, descontracturante, deportivo, tailandés, piedras calientes, reflexología y más, según el estudio." },
  { q: "¿Puedo ir todos los días?", a: "Sí. Reservas ilimitadas, sujeto a disponibilidad de cada estudio." },
];

const Index = () => {
  const [email, setEmail] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Introduce un email válido");
      return;
    }
    toast.success("¡Bienvenido! Te avisamos cuando abramos plazas.");
    setEmail("");
  };

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
              Massage Madrid
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-primary-foreground/90">
            <a href="#estudios" className="hover:text-accent transition-colors">Estudios</a>
            <a href="#como-funciona" className="hover:text-accent transition-colors">Cómo funciona</a>
            <a href="#faq" className="hover:text-accent transition-colors">FAQ</a>
          </nav>
          <Button asChild variant="secondary" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-gold">
            <a href="#join">Únete</a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[100vh] flex items-center overflow-hidden">
        <img
          src={madridHero}
          alt="Vista nocturna de Madrid con la fuente de Cibeles"
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
                Solo en Madrid · Plazas limitadas
              </span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground text-balance leading-[1.05] mb-6">
              Madrid se relaja
              <span className="block italic font-normal text-accent">sin límites.</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/85 max-w-2xl mb-10 text-balance leading-relaxed">
              Una suscripción. Masajes ilimitados en los mejores estudios de la capital.
              De Salamanca a Malasaña, tu cuerpo merece más.
            </p>

            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-background/95 border-0 text-foreground placeholder:text-muted-foreground"
                aria-label="Tu email"
              />
              <Button type="submit" size="lg" className="h-12 bg-gradient-gold text-foreground hover:opacity-90 shadow-gold font-semibold whitespace-nowrap">
                Reserva tu plaza
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-6 mt-8 text-sm text-primary-foreground/80">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Sin permanencia</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Cancela cuando quieras</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Precio de lanzamiento</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-gradient-royal text-primary-foreground py-12 border-y-4 border-accent">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: "8+", l: "Estudios en Madrid" },
            { n: "€79", l: "Al mes, todo incluido" },
            { n: "∞", l: "Masajes al mes" },
            { n: "9", l: "Distritos cubiertos" },
          ].map((s) => (
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
            <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">Cómo funciona</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance">
              Tres pasos. Cero excusas.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Heart, title: "Suscríbete", desc: "€79 al mes. Sin contratos, sin sorpresas. Cancela cuando quieras." },
              { icon: MapPin, title: "Elige estudio", desc: "Reserva en cualquier estudio asociado de Madrid desde la app." },
              { icon: InfinityIcon, title: "Disfruta sin límite", desc: "Vuelve tantas veces como quieras. Tu cuerpo lo agradecerá." },
            ].map((step, i) => (
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
              <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">Nuestros estudios</p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance">
                Los mejores manos de Madrid, en un solo pase.
              </h2>
            </div>
            <p className="text-muted-foreground md:max-w-sm">
              Estudios cuidadosamente seleccionados en los barrios con más vida de la capital.
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
                <p className="text-sm text-muted-foreground">{shop.specialty}</p>
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
            <p className="text-sm uppercase tracking-[0.2em] text-accent font-semibold mb-3">Precio de lanzamiento</p>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-balance mb-6">
              Una tarifa. Toda la ciudad.
            </h2>

            <Card className="p-10 bg-card/95 backdrop-blur text-foreground border-accent/30 shadow-elegant mt-12 text-left">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display text-6xl font-bold text-primary">€79</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">Precio de fundadores · Subirá pronto</p>

              <ul className="space-y-3 mb-8">
                {[
                  "Masajes ilimitados en todos los estudios",
                  "Reserva en cualquier momento desde la app",
                  "Acceso a todos los tipos de masaje",
                  "Sin contrato, cancela cuando quieras",
                  "Soporte personal para cualquier duda",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-foreground" />
                    </div>
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  aria-label="Email para unirte"
                />
                <Button type="submit" size="lg" className="h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant font-semibold">
                  Reserva tu plaza de fundador
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-background">
        <div className="container max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">Preguntas frecuentes</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-12 text-balance">
            Todo lo que necesitas saber.
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
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
            <span className="font-display text-lg font-semibold">Massage Madrid</span>
          </div>
          <p className="text-sm text-primary-foreground/70">
            Hecho con calma en Madrid · jordan@massagepass.io
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
