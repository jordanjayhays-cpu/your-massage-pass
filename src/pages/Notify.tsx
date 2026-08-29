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
import { FLOW_LANGS, useFlowLang, type FlowLang } from "@/lib/flowLang";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";
const SUPPORT_WHATSAPP = "https://wa.me/34613977900";

const COPY: Record<FlowLang, {
  metaTitle: string;
  metaDesc: string;
  title: string;
  sub: string;
  wantQ: string;
  areaQ: string;
  areaPlaceholder: string;
  somewhereElse: string;
  name: string;
  email: string;
  whatsapp: string;
  contactHelper: string;
  consentLabel: string;
  consentNotePre: string;
  privacy: string;
  consentError: string;
  contactError: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successSub: string;
  sendError: string;
}> = {
  en: {
    metaTitle: "Join Massage Club",
    metaDesc: "Free. We'll message you when we find massages worth booking in Madrid.",
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
    sendError: "Could not send. Message us at +34 613 97 79 00.",
  },
  es: {
    metaTitle: "Únete a Massage Club",
    metaDesc: "Gratis. Te avisamos cuando encontremos masajes que merezca la pena reservar en Madrid.",
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
    sendError: "No se pudo enviar. Escríbenos al +34 613 97 79 00.",
  },
  fr: {
    metaTitle: "Rejoindre Massage Club",
    metaDesc: "Gratuit. On vous écrit quand on trouve des massages qui valent le coup à Madrid.",
    title: "Rejoins Massage Club",
    sub: "Gratuit. On t'envoie un email quand on a un bon prix sur le massage que tu veux, dans ton quartier de Madrid.",
    wantQ: "Quel massage te plaît ?",
    areaQ: "Où es-tu ?",
    areaPlaceholder: "Choisis un quartier",
    somewhereElse: "Ailleurs",
    name: "Nom",
    email: "Email",
    whatsapp: "WhatsApp",
    contactHelper: "L'un des deux suffit.",
    consentLabel: "Oui, Massage Club peut m'écrire à propos des massages et offres à Madrid.",
    consentNotePre: "Tu peux te désinscrire à tout moment. On ne vend jamais tes données. ",
    privacy: "Confidentialité",
    consentError: "Coche cette case pour qu'on puisse t'écrire.",
    contactError: "Il nous faut un WhatsApp ou un email pour te joindre",
    submit: "Rejoindre",
    submitting: "Inscription…",
    successTitle: "C'est fait.",
    successSub: "On te contacte dès qu'on a quelque chose de bien pour toi.",
    sendError: "Envoi impossible. Écris-nous au +34 613 97 79 00.",
  },
  de: {
    metaTitle: "Massage Club beitreten",
    metaDesc: "Kostenlos. Wir melden uns, wenn wir eine gute Massage in Madrid für dich finden.",
    title: "Tritt Massage Club bei",
    sub: "Kostenlos. Wir schreiben dir, sobald wir einen guten Preis für die gewünschte Massage in deiner Gegend von Madrid haben.",
    wantQ: "Welche Massage magst du?",
    areaQ: "Wo bist du?",
    areaPlaceholder: "Gegend wählen",
    somewhereElse: "Woanders",
    name: "Name",
    email: "E-Mail",
    whatsapp: "WhatsApp",
    contactHelper: "Eins von beiden reicht.",
    consentLabel: "Ja, Massage Club darf mir über Massagen und Angebote in Madrid schreiben.",
    consentNotePre: "Du kannst dich jederzeit abmelden. Wir verkaufen deine Daten nie. ",
    privacy: "Datenschutz",
    consentError: "Bitte häkchen, damit wir dir schreiben können.",
    contactError: "Wir brauchen WhatsApp oder E-Mail, um dich zu erreichen",
    submit: "Beitreten",
    submitting: "Wird angemeldet…",
    successTitle: "Du bist dabei.",
    successSub: "Wir melden uns, sobald wir etwas Gutes für dich haben.",
    sendError: "Senden fehlgeschlagen. Schreib uns an +34 613 97 79 00.",
  },
  it: {
    metaTitle: "Unisciti a Massage Club",
    metaDesc: "Gratis. Ti scriviamo quando troviamo massaggi da prenotare a Madrid.",
    title: "Unisciti a Massage Club",
    sub: "Gratis. Ti scriviamo quando troviamo un buon prezzo per il massaggio che vuoi, nella tua zona di Madrid.",
    wantQ: "Che massaggio ti piace?",
    areaQ: "Dove ti trovi?",
    areaPlaceholder: "Scegli una zona",
    somewhereElse: "Altra zona",
    name: "Nome",
    email: "Email",
    whatsapp: "WhatsApp",
    contactHelper: "Ne basta uno dei due.",
    consentLabel: "Sì, Massage Club può scrivermi su massaggi e offerte a Madrid.",
    consentNotePre: "Puoi disiscriverti quando vuoi. Non vendiamo mai i tuoi dati. ",
    privacy: "Privacy",
    consentError: "Spunta questa casella così possiamo scriverti.",
    contactError: "Ci serve un WhatsApp o un'email per contattarti",
    submit: "Iscriviti",
    submitting: "Iscrizione…",
    successTitle: "Fatto.",
    successSub: "Ti scriviamo appena abbiamo qualcosa di buono per te.",
    sendError: "Invio non riuscito. Scrivici al +34 613 97 79 00.",
  },
  pt: {
    metaTitle: "Junta-te ao Massage Club",
    metaDesc: "Grátis. Escrevemos-te quando encontrarmos massagens que valem a pena em Madrid.",
    title: "Junta-te ao Massage Club",
    sub: "Grátis. Enviamos-te um email quando conseguirmos um bom preço na massagem que queres, na tua zona de Madrid.",
    wantQ: "Que massagem gostas?",
    areaQ: "Onde estás?",
    areaPlaceholder: "Escolhe uma zona",
    somewhereElse: "Outra zona",
    name: "Nome",
    email: "Email",
    whatsapp: "WhatsApp",
    contactHelper: "Basta um dos dois.",
    consentLabel: "Sim, o Massage Club pode escrever-me sobre massagens e ofertas em Madrid.",
    consentNotePre: "Podes cancelar quando quiseres. Nunca vendemos os teus dados. ",
    privacy: "Privacidade",
    consentError: "Marca esta caixa para podermos escrever-te.",
    contactError: "Precisamos de um WhatsApp ou email para te contactar",
    submit: "Juntar-me",
    submitting: "A entrar…",
    successTitle: "Já estás dentro.",
    successSub: "Entramos em contacto quando tivermos algo bom para ti.",
    sendError: "Não foi possível enviar. Escreve-nos para +34 613 97 79 00.",
  },
  zh: {
    metaTitle: "加入 Massage Club",
    metaDesc: "免费。我们在马德里找到值得预订的按摩时会通知你。",
    title: "加入 Massage Club",
    sub: "免费。当我们在你所在的马德里区域找到心仪按摩的优惠价格时，会发邮件通知你。",
    wantQ: "你喜欢哪种按摩？",
    areaQ: "你在哪个区域？",
    areaPlaceholder: "选择区域",
    somewhereElse: "其他区域",
    name: "姓名",
    email: "邮箱",
    whatsapp: "WhatsApp",
    contactHelper: "填一个就够了。",
    consentLabel: "是的，Massage Club 可以就马德里的按摩和优惠给我发消息。",
    consentNotePre: "你可以随时取消订阅。我们绝不会出售你的信息。",
    privacy: "隐私政策",
    consentError: "请勾选此项，以便我们联系你。",
    contactError: "我们需要 WhatsApp 或邮箱才能联系你",
    submit: "加入",
    submitting: "加入中…",
    successTitle: "加入成功。",
    successSub: "有好消息时我们会联系你。",
    sendError: "发送失败，请通过 +34 613 97 79 00 联系我们。",
  },
};

type Status = "idle" | "loading" | "success" | "error";

const WANT_OPTIONS = [
  { value: "relaxing", en: "Relaxing", es: "Relajante", fr: "Relaxant", de: "Entspannend", it: "Rilassante", pt: "Relaxante", zh: "放松按摩" },
  { value: "deep-tissue", en: "Deep tissue", es: "Descontracturante", fr: "Tissus profonds", de: "Tiefengewebe", it: "Tessuti profondi", pt: "Tecidos profundos", zh: "深层组织" },
  { value: "thai", en: "Thai", es: "Tailandés", fr: "Thaï", de: "Thai", it: "Tailandese", pt: "Tailandesa", zh: "泰式" },
  { value: "sports", en: "Sports", es: "Deportivo", fr: "Sportif", de: "Sport", it: "Sportivo", pt: "Desportiva", zh: "运动按摩" },
  { value: "hot-stone", en: "Hot stone", es: "Piedras calientes", fr: "Pierres chaudes", de: "Hot Stone", it: "Pietre calde", pt: "Pedras quentes", zh: "热石" },
  { value: "not-sure", en: "Not sure", es: "No lo sé", fr: "Pas sûr", de: "Unsicher", it: "Non so", pt: "Não sei", zh: "不确定" },
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
  const lang = useFlowLang();
  const t = COPY[lang];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [wantSel, setWantSel] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [consentError, setConsentError] = useState(false);
  const [contactError, setContactError] = useState(false);

  // Restore persisted page language and keep <html lang> + mc_lang in sync.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mc_lang");
      if (saved && (FLOW_LANGS as readonly string[]).includes(saved) && saved !== lang) {
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
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDesc} />
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
                              {o[lang]}
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
                        +34 613 97 79 00
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
