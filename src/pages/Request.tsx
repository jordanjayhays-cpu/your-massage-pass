import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";
const SUPPORT_WHATSAPP = "https://wa.me/34613977900";

const COPY: Record<FlowLang, {
  metaTitle: string;
  metaDesc: string;
  successTitle: string;
  successSub: string;
  headline: string;
  sub: string;
  wantLabel: string;
  wantPlaceholder: string;
  wantHelper: string;
  whenLabel: string;
  whenPlaceholder: string;
  areaLabel: string;
  areaPlaceholder: string;
  nameLabel: string;
  phoneLabel: string;
  emailLabel: string;
  contactHelper: string;
  notesLabel: string;
  notesPlaceholder: string;
  wantRequired: string;
  contactRequired: string;
  sendErrorTitle: string;
  whatsappLinkText: string;
  unknownError: string;
  networkError: string;
  sending: string;
  send: string;
}> = {
  en: {
    metaTitle: "Request a massage · Massage Club",
    metaDesc: "Tell us what massage you want and we will book it for you. No booking fee, you pay the studio directly.",
    successTitle: "Got it.",
    successSub: "We'll come back shortly with options and real prices.",
    headline: "Tell us what you want. We book it.",
    sub: "No booking fee. You pay the studio directly.",
    wantLabel: "What massage",
    wantPlaceholder: "Deep tissue, or just: my back hurts",
    wantHelper: "If you're not sure, just tell us what hurts.",
    whenLabel: "When",
    whenPlaceholder: "Tomorrow evening",
    areaLabel: "Area",
    areaPlaceholder: "Chamberí",
    nameLabel: "Name",
    phoneLabel: "WhatsApp",
    emailLabel: "Or email",
    contactHelper: "Either one is enough. We'll come back with options and prices.",
    notesLabel: "Notes",
    notesPlaceholder: "Allergies, pressure preference, anything else",
    wantRequired: "Please tell us what massage you want",
    contactRequired: "We need a WhatsApp or email to reach you",
    sendErrorTitle: "Could not send. Message us on WhatsApp at +34 613 97 79 00.",
    whatsappLinkText: "Message us on WhatsApp",
    unknownError: "Unknown error",
    networkError: "Network error",
    sending: "Sending…",
    send: "Send",
  },
  es: {
    metaTitle: "Pide un masaje · Massage Club",
    metaDesc: "Cuéntanos qué masaje quieres y te lo reservamos. Sin comisión de reserva, pagas directamente al estudio.",
    successTitle: "Recibido.",
    successSub: "Te escribimos enseguida con opciones y precios reales.",
    headline: "Dinos qué quieres. Nosotros lo reservamos.",
    sub: "Sin comisión de reserva. Pagas directamente al estudio.",
    wantLabel: "Qué masaje",
    wantPlaceholder: "Descontracturante, o simplemente: me duele la espalda",
    wantHelper: "Si no estás seguro, dinos qué te duele.",
    whenLabel: "Cuándo",
    whenPlaceholder: "Mañana por la tarde",
    areaLabel: "Zona",
    areaPlaceholder: "Chamberí",
    nameLabel: "Nombre",
    phoneLabel: "WhatsApp",
    emailLabel: "O email",
    contactHelper: "Con uno de los dos vale. Te escribimos con opciones y precios.",
    notesLabel: "Notas",
    notesPlaceholder: "Alergias, preferencia de presión, cualquier otra cosa",
    wantRequired: "Cuéntanos qué masaje quieres",
    contactRequired: "Necesitamos un WhatsApp o email para escribirte",
    sendErrorTitle: "No se pudo enviar. Escríbenos por WhatsApp al +34 613 97 79 00.",
    whatsappLinkText: "Escríbenos por WhatsApp",
    unknownError: "Error desconocido",
    networkError: "Error de red",
    sending: "Enviando…",
    send: "Enviar",
  },
  fr: {
    metaTitle: "Demander un massage · Massage Club",
    metaDesc: "Dis-nous quel massage tu veux, on le réserve pour toi. Pas de frais de réservation, tu paies directement l'institut.",
    successTitle: "C'est noté.",
    successSub: "On revient vite avec des options et des prix réels.",
    headline: "Dis-nous ce que tu veux. On réserve.",
    sub: "Pas de frais de réservation. Tu paies directement l'institut.",
    wantLabel: "Quel massage",
    wantPlaceholder: "Tissus profonds, ou juste : j'ai mal au dos",
    wantHelper: "Si tu n'es pas sûr, dis-nous simplement ce qui te fait mal.",
    whenLabel: "Quand",
    whenPlaceholder: "Demain soir",
    areaLabel: "Quartier",
    areaPlaceholder: "Chamberí",
    nameLabel: "Nom",
    phoneLabel: "WhatsApp",
    emailLabel: "Ou email",
    contactHelper: "L'un des deux suffit. On revient avec des options et des prix.",
    notesLabel: "Notes",
    notesPlaceholder: "Allergies, préférence de pression, autre chose",
    wantRequired: "Dis-nous quel massage tu veux",
    contactRequired: "Il nous faut un WhatsApp ou un email pour te joindre",
    sendErrorTitle: "Envoi impossible. Écris-nous sur WhatsApp au +34 613 97 79 00.",
    whatsappLinkText: "Écris-nous sur WhatsApp",
    unknownError: "Erreur inconnue",
    networkError: "Erreur réseau",
    sending: "Envoi…",
    send: "Envoyer",
  },
  de: {
    metaTitle: "Massage anfragen · Massage Club",
    metaDesc: "Sag uns, welche Massage du möchtest, wir buchen sie für dich. Keine Buchungsgebühr, du zahlst direkt im Studio.",
    successTitle: "Angekommen.",
    successSub: "Wir melden uns gleich mit Optionen und echten Preisen.",
    headline: "Sag uns, was du willst. Wir buchen es.",
    sub: "Keine Buchungsgebühr. Du zahlst direkt im Studio.",
    wantLabel: "Welche Massage",
    wantPlaceholder: "Tiefengewebe, oder einfach: mein Rücken tut weh",
    wantHelper: "Wenn du unsicher bist, sag uns einfach, was wehtut.",
    whenLabel: "Wann",
    whenPlaceholder: "Morgen Abend",
    areaLabel: "Gegend",
    areaPlaceholder: "Chamberí",
    nameLabel: "Name",
    phoneLabel: "WhatsApp",
    emailLabel: "Oder E-Mail",
    contactHelper: "Eins von beiden reicht. Wir melden uns mit Optionen und Preisen.",
    notesLabel: "Notizen",
    notesPlaceholder: "Allergien, Druckvorliebe, sonstiges",
    wantRequired: "Sag uns, welche Massage du möchtest",
    contactRequired: "Wir brauchen WhatsApp oder E-Mail, um dich zu erreichen",
    sendErrorTitle: "Senden fehlgeschlagen. Schreib uns auf WhatsApp an +34 613 97 79 00.",
    whatsappLinkText: "Schreib uns auf WhatsApp",
    unknownError: "Unbekannter Fehler",
    networkError: "Netzwerkfehler",
    sending: "Wird gesendet…",
    send: "Senden",
  },
  it: {
    metaTitle: "Richiedi un massaggio · Massage Club",
    metaDesc: "Dicci che massaggio vuoi e lo prenotiamo per te. Nessuna commissione, paghi direttamente al centro.",
    successTitle: "Ricevuto.",
    successSub: "Ti ricontattiamo a breve con opzioni e prezzi reali.",
    headline: "Dicci cosa vuoi. Lo prenotiamo noi.",
    sub: "Nessuna commissione di prenotazione. Paghi direttamente al centro.",
    wantLabel: "Che massaggio",
    wantPlaceholder: "Tessuti profondi, o semplicemente: mi fa male la schiena",
    wantHelper: "Se non sei sicuro, dicci solo cosa ti fa male.",
    whenLabel: "Quando",
    whenPlaceholder: "Domani sera",
    areaLabel: "Zona",
    areaPlaceholder: "Chamberí",
    nameLabel: "Nome",
    phoneLabel: "WhatsApp",
    emailLabel: "O email",
    contactHelper: "Ne basta uno dei due. Ti ricontattiamo con opzioni e prezzi.",
    notesLabel: "Note",
    notesPlaceholder: "Allergie, preferenza di pressione, altro",
    wantRequired: "Dicci che massaggio vuoi",
    contactRequired: "Ci serve un WhatsApp o un'email per contattarti",
    sendErrorTitle: "Invio non riuscito. Scrivici su WhatsApp al +34 613 97 79 00.",
    whatsappLinkText: "Scrivici su WhatsApp",
    unknownError: "Errore sconosciuto",
    networkError: "Errore di rete",
    sending: "Invio…",
    send: "Invia",
  },
  pt: {
    metaTitle: "Pede uma massagem · Massage Club",
    metaDesc: "Diz-nos que massagem queres e nós reservamos por ti. Sem taxa de reserva, pagas diretamente ao estúdio.",
    successTitle: "Recebido.",
    successSub: "Voltamos já com opções e preços reais.",
    headline: "Diz-nos o que queres. Nós reservamos.",
    sub: "Sem taxa de reserva. Pagas diretamente ao estúdio.",
    wantLabel: "Que massagem",
    wantPlaceholder: "Tecidos profundos, ou apenas: dói-me as costas",
    wantHelper: "Se não tens a certeza, diz-nos só o que dói.",
    whenLabel: "Quando",
    whenPlaceholder: "Amanhã à noite",
    areaLabel: "Zona",
    areaPlaceholder: "Chamberí",
    nameLabel: "Nome",
    phoneLabel: "WhatsApp",
    emailLabel: "Ou email",
    contactHelper: "Basta um dos dois. Voltamos com opções e preços.",
    notesLabel: "Notas",
    notesPlaceholder: "Alergias, preferência de pressão, outra coisa",
    wantRequired: "Diz-nos que massagem queres",
    contactRequired: "Precisamos de um WhatsApp ou email para te contactar",
    sendErrorTitle: "Não foi possível enviar. Escreve-nos no WhatsApp para +34 613 97 79 00.",
    whatsappLinkText: "Escreve-nos no WhatsApp",
    unknownError: "Erro desconhecido",
    networkError: "Erro de rede",
    sending: "A enviar…",
    send: "Enviar",
  },
  zh: {
    metaTitle: "预约按摩 · Massage Club",
    metaDesc: "告诉我们你想要的按摩，我们帮你预订。没有预订费，直接付款给按摩馆。",
    successTitle: "已收到。",
    successSub: "我们很快会带着选项和真实价格联系你。",
    headline: "告诉我们你想要什么，我们来预订。",
    sub: "没有预订费，直接付款给按摩馆。",
    wantLabel: "想要的按摩",
    wantPlaceholder: "深层组织按摩，或者只是：我背疼",
    wantHelper: "如果不确定，告诉我们哪里不舒服就行。",
    whenLabel: "时间",
    whenPlaceholder: "明天晚上",
    areaLabel: "区域",
    areaPlaceholder: "Chamberí",
    nameLabel: "姓名",
    phoneLabel: "WhatsApp",
    emailLabel: "或邮箱",
    contactHelper: "填一个就够了，我们会带着选项和价格联系你。",
    notesLabel: "备注",
    notesPlaceholder: "过敏、力度偏好或其他事项",
    wantRequired: "请告诉我们你想要的按摩",
    contactRequired: "我们需要 WhatsApp 或邮箱才能联系你",
    sendErrorTitle: "发送失败，请通过 WhatsApp 联系我们：+34 613 97 79 00。",
    whatsappLinkText: "通过 WhatsApp 联系我们",
    unknownError: "未知错误",
    networkError: "网络错误",
    sending: "发送中…",
    send: "发送",
  },
};

type Status = "idle" | "loading" | "success" | "error";

export default function Request() {
  const lang = useFlowLang();
  const t = COPY[lang];

  const [want, setWant] = useState("");
  const [when, setWhen] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationMsg, setValidationMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationMsg("");

    if (!want.trim()) {
      setValidationMsg(t.wantRequired);
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setValidationMsg(t.contactRequired);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          want: want.trim(),
          when: when.trim() || undefined,
          area: area.trim() || undefined,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          source: "web-request",
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: t.unknownError }));
      if (res.ok && data.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || t.unknownError);
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : t.networkError);
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
                      {t.headline}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {t.sub}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="want" className="text-[15px]">
                        {t.wantLabel} <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="want"
                        value={want}
                        onChange={(e) => setWant(e.target.value)}
                        placeholder={t.wantPlaceholder}
                        className="text-base md:text-sm min-h-[88px] rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.wantHelper}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="when" className="text-[15px]">
                        {t.whenLabel}
                      </Label>
                      <Input
                        id="when"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        placeholder={t.whenPlaceholder}
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area" className="text-[15px]">
                        {t.areaLabel}
                      </Label>
                      <Input
                        id="area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder={t.areaPlaceholder}
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[15px]">
                        {t.nameLabel}
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder=""
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-[15px]">
                          {t.phoneLabel}
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

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-[15px]">
                          {t.emailLabel}
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="h-12 text-base md:text-sm rounded-xl"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground -mt-2">
                      {t.contactHelper}
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-[15px]">
                        {t.notesLabel}
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t.notesPlaceholder}
                        className="text-base md:text-sm min-h-[80px] rounded-xl"
                      />
                    </div>
                  </div>

                  {validationMsg && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {validationMsg}
                    </div>
                  )}

                  {status === "error" && (
                    <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-medium mb-1">
                        {t.sendErrorTitle}
                      </p>
                      <p className="opacity-90">
                        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline">
                          {t.whatsappLinkText}
                        </a>{" "}
                        +34 613 97 79 00.
                      </p>
                      {errorMsg && <p className="mt-2 text-xs opacity-80">{errorMsg}</p>}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    loading={status === "loading"}
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? t.sending : t.send}
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
