import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";

import {
  COMPLIMENT_TAGS, ISSUE_TAGS, reviewTagLabel, suggestDisplayName,
} from "@/lib/reviews";
import { toFlowLang, type FlowLang } from "@/lib/flowLang";

const FN_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/review";


const LAST_STEP = 8;

type Pressure = "too_soft" | "perfect" | "too_strong";

function sanitize(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300);
}

type FetchResp = {
  studio?: string;
  slug?: string;
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  lang?: string;
  status?: string;
  cancelled?: boolean;
  review?: {
    rating?: number;
    would_return?: boolean | null;
    pressure_feedback?: Pressure | null;
    cleanliness?: number | null;
    ambience?: number | null;
    comment?: string | null;
    tags?: string[] | null;
    private_note?: string | null;
    display_name?: string | null;
    custom_tag?: string | null;
  } | null;
};

const COPY = {
  en: {
    pageTitle: "Leave a review - Massage Club",
    pageDesc: "Tell us about your massage.",
    loading: "Loading…",
    invalid: "Invalid link",
    invalidSub: "We could not find that booking.",
    cancelled: "This booking was cancelled",
    back: "Back",
    skip: "Skip",
    continue: "Continue",
    finish: "Finish",
    sending: "Saving…",
    error: "Could not save. Please try again.",
    s1: (what: string, where: string) => (what ? `How was your ${what} at ${where}?` : `How was your massage at ${where}?`),
    s1sub: "Tap a star",
    s2: "How was the pressure?",
    s2sub: "Only you and Massage Club see how you answer this.",
    tooSoft: "Too soft",
    justRight: "Just right",
    tooFirm: "Too firm",
    s3: "How clean was the studio?",
    s4: "How was the atmosphere?",
    starsSub: "Tap a star",
    s5good: "What stood out?",
    s5bad: "What could have been better?",
    s5sub: "Tap any that apply",
    other: "Other",
    otherPh: "Tell us in a word or two",

    s6: "Share your experience",
    s6sub: "This appears on the studio's page.",
    s6ph: "What would you tell a friend about this massage?",
    nameLabel: "Shown as",
    namePh: "Massage Club client",
    s7: "Anything just for us?",
    s7sub: "Just for Massage Club. The studio never sees this.",
    s7ph: "Anything you would rather not say publicly",
    s8: (studio: string) => `Would you go back to ${studio}?`,
    yes: "Yes",
    no: "No",
    thanksTitle: "Thank you",
    thanksBody: "Thanks, your review helps other people find great massages.",
    bookNext: "Book your next massage",
    bookAgainWa: "https://wa.me/34613977900?text=Hi%2C%20I%20want%20to%20book%20again",
    browse: "Browse studios",
  },
  es: {
    pageTitle: "Deja tu opinión - Massage Club",
    pageDesc: "Cuéntanos qué tal tu masaje.",
    loading: "Cargando…",
    invalid: "Enlace no válido",
    invalidSub: "No encontramos esa reserva.",
    cancelled: "Esta reserva fue cancelada",
    back: "Atrás",
    skip: "Saltar",
    continue: "Continuar",
    finish: "Terminar",
    sending: "Guardando…",
    error: "No se pudo guardar. Inténtalo de nuevo.",
    s1: (what: string, where: string) => (what ? `¿Qué tal tu ${what} en ${where}?` : `¿Qué tal tu masaje en ${where}?`),
    s1sub: "Toca una estrella",
    s2: "¿Qué tal la presión?",
    s2sub: "Esto solo lo vemos tú y Massage Club.",
    tooSoft: "Muy suave",
    justRight: "Perfecta",
    tooFirm: "Muy fuerte",
    s3: "¿Qué tal la limpieza?",
    s4: "¿Qué tal el ambiente?",
    starsSub: "Toca una estrella",
    s5good: "¿Qué destacarías?",
    s5bad: "¿Qué se podría mejorar?",
    s5sub: "Toca lo que aplique",
    other: "Otro",
    otherPh: "Cuéntanoslo en pocas palabras",

    s6: "Cuenta tu experiencia",
    s6sub: "Se muestra en la página del estudio.",
    s6ph: "¿Qué le contarías a un amigo sobre este masaje?",
    nameLabel: "Se muestra como",
    namePh: "Cliente de Massage Club",
    s7: "¿Algo solo para nosotros?",
    s7sub: "Solo para Massage Club. El estudio nunca lo ve.",
    s7ph: "Algo que prefieras no decir en público",
    s8: (studio: string) => `¿Volverías a ${studio}?`,
    yes: "Sí",
    no: "No",
    thanksTitle: "Gracias",
    thanksBody: "Gracias, tu opinión ayuda a otras personas a encontrar buenos masajes.",
    bookNext: "Reserva tu próximo masaje",
    bookAgainWa: "https://wa.me/34613977900?text=Hola%2C%20quiero%20reservar%20otra%20vez",
    browse: "Ver estudios",
  },
  fr: {
    pageTitle: "Laisser un avis - Massage Club",
    pageDesc: "Parlez-nous de votre massage.",
    loading: "Chargement…",
    invalid: "Lien non valide",
    invalidSub: "Nous n'avons pas trouvé cette réservation.",
    cancelled: "Cette réservation a été annulée",
    back: "Retour",
    skip: "Passer",
    continue: "Continuer",
    finish: "Terminer",
    sending: "Enregistrement…",
    error: "Impossible d'enregistrer. Veuillez réessayer.",
    s1: (what: string, where: string) => (what ? `Comment était votre ${what} chez ${where} ?` : `Comment était votre massage chez ${where} ?`),
    s1sub: "Touchez une étoile",
    s2: "Comment était la pression ?",
    s2sub: "Seuls vous et Massage Club voyez votre réponse.",
    tooSoft: "Trop légère",
    justRight: "Parfaite",
    tooFirm: "Trop forte",
    s3: "Le studio était-il propre ?",
    s4: "Comment était l'ambiance ?",
    starsSub: "Touchez une étoile",
    s5good: "Qu'est-ce qui vous a marqué ?",
    s5bad: "Qu'est-ce qui aurait pu être mieux ?",
    s5sub: "Touchez tout ce qui s'applique",
    other: "Autre",
    otherPh: "Dites-nous en quelques mots",

    s6: "Partagez votre expérience",
    s6sub: "Ceci apparaît sur la page du studio.",
    s6ph: "Que diriez-vous à un ami à propos de ce massage ?",
    nameLabel: "Affiché comme",
    namePh: "Client Massage Club",
    s7: "Quelque chose juste pour nous ?",
    s7sub: "Uniquement pour Massage Club. Le studio ne voit jamais ceci.",
    s7ph: "Quelque chose que vous préférez ne pas dire publiquement",
    s8: (studio: string) => `Retourneriez-vous chez ${studio} ?`,
    yes: "Oui",
    no: "Non",
    thanksTitle: "Merci",
    thanksBody: "Merci, votre avis aide d'autres personnes à trouver de bons massages.",
    bookNext: "Réservez votre prochain massage",
    bookAgainWa: "https://wa.me/34613977900?text=Bonjour%2C%20je%20veux%20r%C3%A9server%20%C3%A0%20nouveau",
    browse: "Voir les studios",
  },
  de: {
    pageTitle: "Bewertung abgeben - Massage Club",
    pageDesc: "Erzähl uns von deiner Massage.",
    loading: "Wird geladen…",
    invalid: "Ungültiger Link",
    invalidSub: "Wir konnten diese Buchung nicht finden.",
    cancelled: "Diese Buchung wurde storniert",
    back: "Zurück",
    skip: "Überspringen",
    continue: "Weiter",
    finish: "Fertig",
    sending: "Wird gespeichert…",
    error: "Konnte nicht gespeichert werden. Bitte versuche es erneut.",
    s1: (what: string, where: string) => (what ? `Wie war deine ${what} bei ${where}?` : `Wie war deine Massage bei ${where}?`),
    s1sub: "Tippe auf einen Stern",
    s2: "Wie war der Druck?",
    s2sub: "Nur du und Massage Club sehen deine Antwort.",
    tooSoft: "Zu sanft",
    justRight: "Genau richtig",
    tooFirm: "Zu stark",
    s3: "Wie sauber war das Studio?",
    s4: "Wie war die Atmosphäre?",
    starsSub: "Tippe auf einen Stern",
    s5good: "Was hat dir besonders gefallen?",
    s5bad: "Was hätte besser sein können?",
    s5sub: "Tippe alles Zutreffende an",
    other: "Sonstiges",
    otherPh: "Sag es uns in ein paar Worten",

    s6: "Teile deine Erfahrung",
    s6sub: "Das erscheint auf der Seite des Studios.",
    s6ph: "Was würdest du einem Freund über diese Massage erzählen?",
    nameLabel: "Angezeigt als",
    namePh: "Massage Club Kunde",
    s7: "Etwas nur für uns?",
    s7sub: "Nur für Massage Club. Das Studio sieht das nie.",
    s7ph: "Etwas, das du lieber nicht öffentlich sagen möchtest",
    s8: (studio: string) => `Würdest du wieder zu ${studio} gehen?`,
    yes: "Ja",
    no: "Nein",
    thanksTitle: "Danke",
    thanksBody: "Danke, deine Bewertung hilft anderen, tolle Massagen zu finden.",
    bookNext: "Buche deine nächste Massage",
    bookAgainWa: "https://wa.me/34613977900?text=Hallo%2C%20ich%20m%C3%B6chte%20wieder%20buchen",
    browse: "Studios ansehen",
  },
  it: {
    pageTitle: "Lascia una recensione - Massage Club",
    pageDesc: "Raccontaci del tuo massaggio.",
    loading: "Caricamento…",
    invalid: "Link non valido",
    invalidSub: "Non abbiamo trovato quella prenotazione.",
    cancelled: "Questa prenotazione è stata annullata",
    back: "Indietro",
    skip: "Salta",
    continue: "Continua",
    finish: "Termina",
    sending: "Salvataggio…",
    error: "Impossibile salvare. Riprova.",
    s1: (what: string, where: string) => (what ? `Com'è stato il tuo ${what} da ${where}?` : `Com'è stato il tuo massaggio da ${where}?`),
    s1sub: "Tocca una stella",
    s2: "Com'era la pressione?",
    s2sub: "Solo tu e Massage Club vedete questa risposta.",
    tooSoft: "Troppo leggera",
    justRight: "Perfetta",
    tooFirm: "Troppo forte",
    s3: "Quanto era pulito lo studio?",
    s4: "Com'era l'atmosfera?",
    starsSub: "Tocca una stella",
    s5good: "Cosa ti è piaciuto di più?",
    s5bad: "Cosa si sarebbe potuto migliorare?",
    s5sub: "Tocca tutto ciò che si applica",
    other: "Altro",
    otherPh: "Raccontacelo in poche parole",

    s6: "Condividi la tua esperienza",
    s6sub: "Questo appare sulla pagina dello studio.",
    s6ph: "Cosa diresti a un amico di questo massaggio?",
    nameLabel: "Mostrato come",
    namePh: "Cliente Massage Club",
    s7: "Qualcosa solo per noi?",
    s7sub: "Solo per Massage Club. Lo studio non lo vede mai.",
    s7ph: "Qualcosa che preferisci non dire pubblicamente",
    s8: (studio: string) => `Torneresti da ${studio}?`,
    yes: "Sì",
    no: "No",
    thanksTitle: "Grazie",
    thanksBody: "Grazie, la tua recensione aiuta altre persone a trovare ottimi massaggi.",
    bookNext: "Prenota il tuo prossimo massaggio",
    bookAgainWa: "https://wa.me/34613977900?text=Ciao%2C%20vorrei%20prenotare%20di%20nuovo",
    browse: "Sfoglia gli studi",
  },
  pt: {
    pageTitle: "Deixe uma avaliação - Massage Club",
    pageDesc: "Conte-nos sobre a sua massagem.",
    loading: "A carregar…",
    invalid: "Link inválido",
    invalidSub: "Não encontramos essa reserva.",
    cancelled: "Esta reserva foi cancelada",
    back: "Voltar",
    skip: "Saltar",
    continue: "Continuar",
    finish: "Concluir",
    sending: "A guardar…",
    error: "Não foi possível guardar. Tenta novamente.",
    s1: (what: string, where: string) => (what ? `Como foi a sua ${what} em ${where}?` : `Como foi a sua massagem em ${where}?`),
    s1sub: "Toque numa estrela",
    s2: "Como foi a pressão?",
    s2sub: "Só tu e a Massage Club veem esta resposta.",
    tooSoft: "Muito suave",
    justRight: "Perfeita",
    tooFirm: "Muito forte",
    s3: "Quão limpo estava o estúdio?",
    s4: "Como foi o ambiente?",
    starsSub: "Toque numa estrela",
    s5good: "O que se destacou?",
    s5bad: "O que poderia ter sido melhor?",
    s5sub: "Toque em tudo o que se aplica",
    other: "Outro",
    otherPh: "Diz-nos em poucas palavras",

    s6: "Partilha a tua experiência",
    s6sub: "Isto aparece na página do estúdio.",
    s6ph: "O que dirias a um amigo sobre esta massagem?",
    nameLabel: "Mostrado como",
    namePh: "Cliente Massage Club",
    s7: "Algo só para nós?",
    s7sub: "Só para a Massage Club. O estúdio nunca vê isto.",
    s7ph: "Algo que preferes não dizer publicamente",
    s8: (studio: string) => `Voltarias a ${studio}?`,
    yes: "Sim",
    no: "Não",
    thanksTitle: "Obrigado",
    thanksBody: "Obrigado, a tua avaliação ajuda outras pessoas a encontrar boas massagens.",
    bookNext: "Reserva a tua próxima massagem",
    bookAgainWa: "https://wa.me/34613977900?text=Ol%C3%A1%2C%20quero%20reservar%20novamente",
    browse: "Ver estúdios",
  },
  zh: {
    pageTitle: "留下评价 - Massage Club",
    pageDesc: "告诉我们你的按摩体验。",
    loading: "加载中…",
    invalid: "链接无效",
    invalidSub: "我们找不到该预约。",
    cancelled: "该预约已取消",
    back: "返回",
    skip: "跳过",
    continue: "继续",
    finish: "完成",
    sending: "保存中…",
    error: "保存失败，请重试。",
    s1: (what: string, where: string) => (what ? `你在${where}的${what}怎么样？` : `你在${where}的按摩怎么样？`),
    s1sub: "点击星星",
    s2: "力度怎么样？",
    s2sub: "只有你和 Massage Club 能看到这个答案。",
    tooSoft: "太轻",
    justRight: "刚刚好",
    tooFirm: "太重",
    s3: "工作室干净吗？",
    s4: "氛围怎么样？",
    starsSub: "点击星星",
    s5good: "哪些方面很突出？",
    s5bad: "哪些方面可以改进？",
    s5sub: "点击所有适用的选项",
    other: "其他",
    otherPh: "用几个词告诉我们",

    s6: "分享你的体验",
    s6sub: "这会显示在工作室的页面上。",
    s6ph: "你会怎么向朋友介绍这次按摩？",
    nameLabel: "显示为",
    namePh: "Massage Club 客户",
    s7: "有什么只想告诉我们的吗？",
    s7sub: "仅供 Massage Club 查看，工作室看不到这个。",
    s7ph: "你不想公开说的内容",
    s8: (studio: string) => `你还会再去${studio}吗？`,
    yes: "会",
    no: "不会",
    thanksTitle: "谢谢",
    thanksBody: "谢谢你的评价，这能帮助其他人找到好的按摩体验。",
    bookNext: "预约下一次按摩",
    bookAgainWa: "https://wa.me/34613977900?text=%E4%BD%A0%E5%A5%BD%EF%BC%8C%E6%88%91%E6%83%B3%E5%86%8D%E6%AC%A1%E9%A2%84%E7%BA%A6",
    browse: "浏览工作室",
  },
} as const;

/** Big tappable star row. */
function StarRow({
  value, onPick,
}: { value: number; onPick: (n: number) => void }) {
  return (
    <div className="flex justify-center gap-1 min-[420px]:gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-label={`${n} / 5`}
          className="px-0.5 leading-none transition-transform active:scale-90"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "clamp(2.6rem, 13vw, 3.6rem)",
            color: n <= value ? "#B85C38" : "#DFD3C3",
          }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export default function Review() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const token = sanitize(params.get("token"));
  const preR = Number(params.get("r"));
  const preselectedR = preR >= 1 && preR <= 5 ? Math.floor(preR) : 0;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FetchResp | null>(null);
  const [fatal, setFatal] = useState<"invalid" | "cancelled" | null>(null);
  const [lang, setLang] = useState<FlowLang>("en");

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [rating, setRating] = useState(preselectedR);
  const [pressure, setPressure] = useState<Pressure | "">("");
  const [cleanliness, setCleanliness] = useState(0);
  const [ambience, setAmbience] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [otherOn, setOtherOn] = useState(false);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [done, setDone] = useState(false);
  const jumped = useRef(false);

  const t = COPY[lang];

  useEffect(() => {
    document.title = t.pageTitle;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", t.pageDesc);
  }, [t.pageTitle, t.pageDesc]);

  useEffect(() => {
    if (!token) { setFatal("invalid"); setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        if (!r.ok) { setFatal("invalid"); setLoading(false); return; }
        const j: FetchResp = await r.json();
        setData(j);
        setLang(toFlowLang(j.lang));
        if (j.cancelled) { setFatal("cancelled"); setLoading(false); return; }
        setDisplayName(suggestDisplayName(j.name));
        const rev = j.review;
        if (rev) {
          if (rev.rating) setRating(rev.rating);
          if (rev.pressure_feedback) setPressure(rev.pressure_feedback);
          if (rev.cleanliness) setCleanliness(Number(rev.cleanliness));
          if (rev.ambience) setAmbience(Number(rev.ambience));
          if (Array.isArray(rev.tags)) setTags(rev.tags.filter(Boolean));
          if (rev.custom_tag) { setCustomTag(String(rev.custom_tag)); setOtherOn(true); }
          if (rev.comment) setComment(rev.comment);
          if (rev.private_note) setPrivateNote(rev.private_note);
          if (rev.display_name) setDisplayName(rev.display_name);
          if (typeof rev.would_return === "boolean") setWouldReturn(rev.would_return);
        }
      } catch {
        setFatal("invalid");
      }
      setLoading(false);
    })();
  }, [token]);

  /** Persist everything we know so far. Fire and forget unless it is the final save. */
  const save = async (patch: Record<string, unknown> = {}, final = false) => {
    const score = rating || Number(patch.rating) || 0;
    if (score < 1) return true;
    const body = {
      token,
      rating,
      pressure_feedback: pressure || null,
      cleanliness: cleanliness || null,
      ambience: ambience || null,
      tags,
      custom_tag: customTag.trim() || null,
      comment: comment.trim() || null,
      display_name: displayName.trim() || null,
      private_note: privateNote.trim() || null,
      would_return: wouldReturn,
      lang,
      ...patch,
    };
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 404) { setFatal("invalid"); return false; }
      if (r.status === 409) { setFatal("cancelled"); return false; }
      if (!r.ok) { if (final) setErrMsg(t.error); return false; }
      return true;
    } catch {
      if (final) setErrMsg(t.error);
      return false;
    }
  };

  const goNext = (patch: Record<string, unknown> = {}) => {
    setErrMsg("");
    setDir(1);
    void save(patch);                     // incremental, non-blocking
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const goBack = () => { setErrMsg(""); setDir(-1); setStep((s) => Math.max(1, s - 1)); };

  const finish = async (patch: Record<string, unknown> = {}) => {
    setSaving(true);
    setErrMsg("");
    const ok = await save(patch, true);
    setSaving(false);
    if (ok) setDone(true);
  };

  // Email deep link with &r= skips the first screen.
  useEffect(() => {
    if (!loading && !fatal && preselectedR && !jumped.current) {
      jumped.current = true;
      setStep(2);
      void save({ rating: preselectedR });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, fatal, preselectedR]);

  const pickStars = (n: number, set: (v: number) => void, field?: string) => {
    set(n);
    window.setTimeout(() => {
      if (step === LAST_STEP) return;
      goNext(field ? { [field]: n } : {});
    }, 240);
  };

  const toggleTag = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const studio = sanitize(data?.studio) || "—";
  const service = sanitize(data?.service);
  const chipKeys: readonly string[] = rating >= 4 ? COMPLIMENT_TAGS : ISSUE_TAGS;
  const privateScreen = step === 7;

  /* ── Shells ─────────────────────────────────────────────── */

  const Centered = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[100dvh] bg-[#FAF6F0] flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">{children}</div>
    </div>
  );

  if (loading) {
    return <Centered><p className="text-[#8A7460]">{t.loading}</p></Centered>;
  }
  if (fatal === "invalid") {
    return (
      <Centered>
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="font-display text-2xl font-bold text-[#3D2B1F]">{t.invalid}</h1>
        <p className="mt-1 text-sm text-[#8A7460]">{t.invalidSub}</p>
      </Centered>
    );
  }
  if (fatal === "cancelled") {
    return (
      <Centered>
        <div className="text-5xl mb-3">🗓️</div>
        <h1 className="font-display text-2xl font-bold text-[#3D2B1F]">{t.cancelled}</h1>
      </Centered>
    );
  }
  if (done) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF6F0] flex flex-col items-center justify-center px-6 text-center animate-wizard-in-right">
        <div className="max-w-sm w-full">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#B85C38]/10">
            <Sparkles className="text-[#B85C38]" size={28} />
          </div>
          <h1 className="font-display text-3xl font-bold text-[#3D2B1F]">{t.thanksTitle}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5C5349]">{t.thanksBody}</p>
          <a
            href={t.bookAgainWa}
            target="_blank"

            rel="noopener noreferrer"
            className="mt-8 block w-full rounded-full bg-[#B85C38] px-6 py-4 text-base font-semibold text-white"
          >
            {t.bookNext}
          </a>
          <a href="/studios" className="mt-4 inline-block text-sm font-semibold text-[#B85C38] underline underline-offset-4">
            {t.browse}
          </a>
        </div>
      </div>
    );
  }

  const canContinue =
    step === 1 ? rating >= 1 :
    step === 6 ? true :
    true;

  return (
    <div className={`min-h-[100dvh] flex flex-col ${privateScreen ? "bg-[#F3EBE2]" : "bg-[#FAF6F0]"} transition-colors duration-300`}>
      {/* Progress + back */}
      <header className="sticky top-0 z-10 px-4 pt-3 pb-2 backdrop-blur-sm">
        <div className="h-1 w-full rounded-full bg-[#E7DCCE]">
          <div
            className="h-1 rounded-full bg-[#B85C38] transition-all duration-300"
            style={{ width: `${(step / LAST_STEP) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex h-8 items-center">
          {step > 1 ? (
            <button type="button" onClick={goBack} aria-label={t.back}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[#3D2B1F] active:bg-[#3D2B1F]/5">
              <ArrowLeft size={20} />
            </button>
          ) : <span className="h-9 w-9" />}
          <span className="ml-auto truncate text-xs text-[#8A7460]">{studio}</span>
        </div>
      </header>

      {/* One question per screen */}
      <main className="flex-1 overflow-hidden px-6">
        <div
          key={step}
          className={dir === 1 ? "animate-wizard-in-right" : "animate-wizard-in-left"}
        >
          <div className="mx-auto w-full max-w-md pt-8 min-[720px]:pt-16 pb-40">
            {step === 1 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">
                  {t.s1(service, studio)}
                </h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s1sub}</p>
                <div className="mt-10">
                  <StarRow value={rating} onPick={(n) => { setRating(n); window.setTimeout(() => goNext({ rating: n }), 240); }} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s2}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s2sub}</p>
                <div className="mt-8 space-y-3">
                  {([
                    ["too_soft", t.tooSoft],
                    ["perfect", t.justRight],
                    ["too_strong", t.tooFirm],
                  ] as [Pressure, string][]).map(([v, label]) => {
                    const on = pressure === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setPressure(v); window.setTimeout(() => goNext({ pressure_feedback: v }), 240); }}
                        className={`w-full rounded-2xl border-2 px-5 py-5 text-left text-lg font-semibold transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s3}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.starsSub}</p>
                <div className="mt-10">
                  <StarRow value={cleanliness} onPick={(n) => pickStars(n, setCleanliness, "cleanliness")} />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s4}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.starsSub}</p>
                <div className="mt-10">
                  <StarRow value={ambience} onPick={(n) => pickStars(n, setAmbience, "ambience")} />
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">
                  {rating >= 4 ? t.s5good : t.s5bad}
                </h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s5sub}</p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  {chipKeys.map((key) => {
                    const on = tags.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleTag(key)}
                        className={`rounded-full border px-4 py-3 text-[15px] font-medium transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {reviewTagLabel(key, lang)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setOtherOn((v) => !v)}
                    className={`rounded-full border px-4 py-3 text-[15px] font-medium transition ${
                      otherOn ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                    }`}
                  >
                    {t.other}
                  </button>
                </div>
                {otherOn && (
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value.slice(0, 60))}
                    placeholder={t.otherPh}
                    maxLength={60}
                    className="mt-4 w-full rounded-2xl border border-[#E7DCCE] bg-white px-4 py-3 text-[15px] text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                  />
                )}
              </>
            )}

            {step === 6 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s6}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s6sub}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                  rows={6}
                  placeholder={t.s6ph}
                  className="mt-6 w-full rounded-2xl border border-[#E7DCCE] bg-white p-4 text-[15px] leading-relaxed text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
                <label className="mt-6 block text-sm font-semibold text-[#3D2B1F]">{t.nameLabel}</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                  placeholder={t.namePh}
                  className="mt-2 w-full rounded-2xl border border-[#E7DCCE] bg-white px-4 py-3 text-[15px] text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
              </>
            )}

            {step === 7 && (
              <>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#3D2B1F]/8">
                  <Lock size={18} className="text-[#3D2B1F]" />
                </div>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s7}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s7sub}</p>
                <textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value.slice(0, 1000))}
                  rows={6}
                  placeholder={t.s7ph}
                  className="mt-6 w-full rounded-2xl border border-[#E0D4C4] bg-[#FBF7F2] p-4 text-[15px] leading-relaxed text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
              </>
            )}

            {step === 8 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s8(studio)}</h1>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[{ v: true, l: t.yes }, { v: false, l: t.no }].map((o) => {
                    const on = wouldReturn === o.v;
                    return (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setWouldReturn((prev) => (prev === o.v ? null : o.v))}
                        className={`rounded-2xl border-2 px-4 py-7 text-lg font-semibold transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {errMsg && <p className="mt-6 text-sm text-[#B23A3A]">{errMsg}</p>}
          </div>
        </div>
      </main>

      {/* Pinned action */}
      <footer className="sticky bottom-0 border-t border-[#EADFD1] bg-[inherit] px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => (step === LAST_STEP ? finish() : goNext())}
            className={`w-full rounded-full px-6 py-4 text-base font-semibold text-white transition ${
              canContinue && !saving ? "bg-[#B85C38]" : "bg-[#DFD3C3] cursor-not-allowed"
            }`}
          >
            {saving ? t.sending : step === LAST_STEP ? t.finish : t.continue}
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => (step === LAST_STEP ? finish() : goNext())}
              className="mx-auto mt-3 block text-sm text-[#8A7460] underline underline-offset-4"
            >
              {t.skip}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
