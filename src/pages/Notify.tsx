import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { trackFunnel } from "@/lib/funnel";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";
const SUPPORT_WHATSAPP = "https://wa.me/34612474827";

const COPY = {
  en: {
    title: "Join Massage Club",
    sub: "Free. We'll email you when we get a good price on the massage you want, in your part of Madrid.",
    wantQ: "Which massage do you like?",
    areaQ: "Where are you?",
    areaPlaceholder: "Choose an area",
    somewhereElse: "Somewhere else",
    name: "Name",
    email: "Email",
    whatsapp: "WhatsApp",
    contactHelper: "Either one is enough.",
    consentLabel: "Yes, Massage Club can message me about massages and offers in Madrid.",
    consentNotePre: "You can unsubscribe any time. We never sell your details. ",
    privacy: "Privacy",
    consentError: "Please tick this so we can message you.",
    contactError: "We need a WhatsApp or email to reach you",
    submit: "Join",
    submitting: "Joining…",
    successTitle: "You're in.",
    successSub: "We'll be in touch when we have something good for you.",
    sendError: "Could not send. Message us at +34 612 474 827.",
  },
  es: {
    title: "Únete a Massage Club",
    sub: "Gratis. Te escribimos cuando consigamos un buen precio en el masaje que quieres, en tu zona de Madrid.",
    wantQ: "¿Qué masaje te gusta?",
    areaQ: "¿Dónde estás?",
    areaPlaceholder: "Elige una zona",
    somewhereElse: "Otra zona",
    name: "Nombre",
    email: "Email",
    whatsapp: "WhatsApp",
    contactHelper: "Con uno de los dos vale.",
    consentLabel: "Sí, Massage Club puede escribirme sobre masajes y ofertas en Madrid.",
    consentNotePre: "Puedes darte de baja cuando quieras. Nunca vendemos tus datos. ",
    privacy: "Privacidad",
    consentError: "Marca esto para que podamos escribirte.",
    contactError: "Necesitamos un WhatsApp o email para escribirte",
    submit: "Únete",
    submitting: "Entrando…",
    successTitle: "¡Ya estás dentro!",
    successSub: "Te escribimos cuando tengamos algo bueno para ti.",
    sendError: "No se pudo enviar. Escríbenos al +34 612 474 827.",
  },
} as const;

type PageLang = keyof typeof COPY;
type Status = "idle" | "loading" | "success" | "error";

const WANT_OPTIONS = [
  { value: "relaxing", en: "Relaxing", es: "Relajante" },
  { value: "deep-tissue", en: "Deep tissue", es: "Descontracturante" },
  { value: "thai", en: "Thai", es: "Tailandés" },
  { value: "sports", en: "Sports", es: "Deportivo" },
  { value: "hot-stone", en: "Hot stone", es: "Piedras calientes" },
  { value: "not-sure", en: "Not sure", es: "No lo sé" },
] as const;

const AREA_OPTIONS = [
  "Centro",
  "Chamberí",
  "Salamanca",
  "Retiro",
  "La Latina",
  "Malasaña",
  "Chamartín",
  "Argüelles",
  "Tetuán",
] as const;

export default function Notify() {
  const { i18n } = useTranslation();
  const resolved = (i18n.resolvedLanguage || "en").slice(0, 2);
  const lang: PageLang = resolved === "es" ? "es" : "en";
  const t = COPY[lang] ?? COPY.en;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [wantSel, setWantSel] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [consentError, setConsentError] = useState(false);
  const [contactError, setContactError] = useState(false);

  // Restore persisted page language (default English) and keep <html lang> + mc_lang in sync.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mc_lang");
      if ((saved === "en" || saved === "es") && saved !== resolved) {
        i18n.changeLanguage(saved);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("mc_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(false);
    setConsentError(false);

    if (!phone.trim() && !email.trim()) {
      setContactError(true);
      return;
    }
    if (!consent) {
      setConsentError(true);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "waitlist",
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          want: wantSel.length ? wantSel.join(", ") : undefined,
          area: area || undefined,
          lang,
          consent: true,
          consent_text: t.consentLabel,
          source: "join",
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        trackFunnel("deals_signup_ok", {
          source: "join",
          want: wantSel.length ? wantSel.join(", ") : null,
          area: area || null,
        });
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <Helmet>
        <title>Join Massage Club</title>
        <meta name="description" content="Free. We'll message you when we find massages worth booking in Madrid." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-b border-border bg-background sticky top-0 z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-semibold text-foreground" style={{ letterSpacing: 0.2 }}>
              Massage Club
            </span>
          </Link>
          <LanguageFlagToggle />
        </header>

        <main className="max-w-xl mx-auto px-4 py-6 md:py-10">
          <Card className="rounded-2xl shadow-soft border-border/60">
            <CardContent className="p-6 md:p-8">
              {status === "success" ? (
                <div className="text-center py-8 animate-fade-up">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-5">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                    {t.successTitle}
                  </h1>
                  <p className="text-[15px] text-muted-foreground">
                    {t.successSub}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center mb-2">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                      {t.title}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {t.sub}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[15px]">
                        {t.name}
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[15px]">
                        {t.email}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[15px]">
                        {t.whatsapp}
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+34 600 000 000"
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground -mt-2">
                      {t.contactHelper}
                    </p>

                    {contactError && (
                      <div className="flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {t.contactError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-[15px]">{t.wantQ}</Label>
                      <div className="flex flex-wrap gap-2">
                        {WANT_OPTIONS.map((o) => {
                          const active = wantSel.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() =>
                                setWantSel((prev) =>
                                  active ? prev.filter((v) => v !== o.value) : [...prev, o.value],
                                )
                              }
                              className={`h-10 px-4 rounded-full border text-sm font-medium transition ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-foreground/80 hover:border-primary/40"
                              }`}
                            >
                              {lang === "es" ? o.es : o.en}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area" className="text-[15px]">
                        {t.areaQ}
                      </Label>
                      <select
                        id="area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base md:text-sm"
                      >
                        <option value="">{t.areaPlaceholder}</option>
                        {AREA_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                        <option value="Somewhere else">{t.somewhereElse}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="consent"
                          checked={consent}
                          onCheckedChange={(checked) => {
                            setConsent(checked === true);
                            if (checked) setConsentError(false);
                          }}
                          className="mt-0.5 h-5 w-5"
                          aria-invalid={consentError}
                        />
                        <Label htmlFor="consent" className="text-sm font-normal leading-snug cursor-pointer">
                          {t.consentLabel}
                        </Label>
                      </div>
                      {consentError && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          {t.consentError}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground pl-8">
                        {t.consentNotePre}
                        <Link to="/privacy" className="underline hover:text-foreground">
                          {t.privacy}
                        </Link>
                      </p>
                    </div>
                  </div>

                  {status === "error" && (
                    <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-medium mb-1">{t.sendError}</p>
                      <p className="opacity-90">
                        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline">
                          WhatsApp
                        </a>{" "}
                        +34 612 474 827
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    loading={status === "loading"}
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? t.submitting : t.submit}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
