import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { conciergeWhatsappUrl } from "@/app/lib/whatsapp";
import { trackEvent } from "@/lib/siteVisit";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

/**
 * The one customer-facing "WhatsApp us" control.
 * Tap reveals two quick questions (massage type + area), then opens a chat
 * with OUR concierge number with a prefilled message.
 *
 * Never use this for chats with a STUDIO's number - those keep their own
 * Spanish relay links.
 */

/** @deprecated use FlowLang */
export type AskLang = FlowLang;

const MASSAGE_CHIPS: Record<FlowLang, ReadonlyArray<{ kind: string; label: string }>> = {
  en: [
    { kind: "relaxing", label: "Relaxing" },
    { kind: "deep", label: "Deep tissue" },
    { kind: "thai", label: "Thai" },
    { kind: "sports", label: "Sports" },
    { kind: "unsure", label: "Not sure" },
  ],
  es: [
    { kind: "relaxing", label: "Relajante" },
    { kind: "deep", label: "Descontracturante" },
    { kind: "thai", label: "Tailandés" },
    { kind: "sports", label: "Deportivo" },
    { kind: "unsure", label: "No lo sé" },
  ],
  fr: [
    { kind: "relaxing", label: "Relaxant" },
    { kind: "deep", label: "Tissus profonds" },
    { kind: "thai", label: "Thaï" },
    { kind: "sports", label: "Sportif" },
    { kind: "unsure", label: "Je ne sais pas" },
  ],
  de: [
    { kind: "relaxing", label: "Entspannend" },
    { kind: "deep", label: "Tiefengewebe" },
    { kind: "thai", label: "Thai" },
    { kind: "sports", label: "Sport" },
    { kind: "unsure", label: "Nicht sicher" },
  ],
  it: [
    { kind: "relaxing", label: "Rilassante" },
    { kind: "deep", label: "Tessuti profondi" },
    { kind: "thai", label: "Thailandese" },
    { kind: "sports", label: "Sportivo" },
    { kind: "unsure", label: "Non sono sicuro" },
  ],
  pt: [
    { kind: "relaxing", label: "Relaxante" },
    { kind: "deep", label: "Tecidos profundos" },
    { kind: "thai", label: "Tailandesa" },
    { kind: "sports", label: "Desportiva" },
    { kind: "unsure", label: "Não sei" },
  ],
  zh: [
    { kind: "relaxing", label: "放松按摩" },
    { kind: "deep", label: "深层组织按摩" },
    { kind: "thai", label: "泰式按摩" },
    { kind: "sports", label: "运动按摩" },
    { kind: "unsure", label: "不确定" },
  ],
};

const TYPE_WORDS: Record<string, Record<FlowLang, string>> = {
  relaxing: {
    en: "a relaxing massage", es: "un masaje relajante", fr: "un massage relaxant",
    de: "eine Entspannungsmassage", it: "un massaggio rilassante", pt: "uma massagem relaxante", zh: "放松按摩",
  },
  deep: {
    en: "a deep tissue massage", es: "un masaje descontracturante", fr: "un massage tissus profonds",
    de: "eine Tiefengewebsmassage", it: "un massaggio ai tessuti profondi", pt: "uma massagem de tecidos profundos", zh: "深层组织按摩",
  },
  thai: {
    en: "a thai massage", es: "un masaje tailandés", fr: "un massage thaï",
    de: "eine Thai-Massage", it: "un massaggio thailandese", pt: "uma massagem tailandesa", zh: "泰式按摩",
  },
  sports: {
    en: "a sports massage", es: "un masaje deportivo", fr: "un massage sportif",
    de: "eine Sportmassage", it: "un massaggio sportivo", pt: "uma massagem desportiva", zh: "运动按摩",
  },
};

const LABELS: Record<FlowLang, {
  trigger: string; q1: string; q2: string; areaPlaceholder: string; unsure: string; open: string;
}> = {
  en: {
    trigger: "Prefer to chat? Message us on WhatsApp",
    q1: "What massage do you want?",
    q2: "What area are you in?",
    areaPlaceholder: "e.g. Chamberi, Sol, Parla",
    unsure: "Not sure",
    open: "Open WhatsApp",
  },
  es: {
    trigger: "¿Prefieres escribirnos? Mándanos un WhatsApp",
    q1: "¿Qué masaje quieres?",
    q2: "¿En qué zona estás?",
    areaPlaceholder: "p. ej. Chamberí, Sol, Parla",
    unsure: "No lo sé",
    open: "Abrir WhatsApp",
  },
  fr: {
    trigger: "Vous préférez discuter ? Écrivez-nous sur WhatsApp",
    q1: "Quel massage souhaitez-vous ?",
    q2: "Dans quel quartier êtes-vous ?",
    areaPlaceholder: "ex. Chamberi, Sol, Parla",
    unsure: "Je ne sais pas",
    open: "Ouvrir WhatsApp",
  },
  de: {
    trigger: "Lieber chatten? Schreib uns auf WhatsApp",
    q1: "Welche Massage möchtest du?",
    q2: "In welchem Viertel bist du?",
    areaPlaceholder: "z. B. Chamberi, Sol, Parla",
    unsure: "Nicht sicher",
    open: "WhatsApp öffnen",
  },
  it: {
    trigger: "Preferisci chattare? Scrivici su WhatsApp",
    q1: "Che massaggio vuoi?",
    q2: "In che zona ti trovi?",
    areaPlaceholder: "es. Chamberi, Sol, Parla",
    unsure: "Non sono sicuro",
    open: "Apri WhatsApp",
  },
  pt: {
    trigger: "Prefere conversar? Escreve-nos no WhatsApp",
    q1: "Que massagem queres?",
    q2: "Em que zona estás?",
    areaPlaceholder: "ex. Chamberi, Sol, Parla",
    unsure: "Não sei",
    open: "Abrir WhatsApp",
  },
  zh: {
    trigger: "更喜欢聊天？在 WhatsApp 上给我们留言",
    q1: "您想要哪种按摩？",
    q2: "您在哪个区域？",
    areaPlaceholder: "例如 Chamberi、Sol、Parla",
    unsure: "不确定",
    open: "打开 WhatsApp",
  },
};

/** Prefilled WhatsApp text built from the two answers. */
export function buildAskText(
  lang: FlowLang,
  kind: string,
  area: string,
  studioName?: string | null,
  note?: string,
): string {
  const suffix = note ? ` ${note}` : "";
  const studio = (studioName || "").trim();
  const es = lang === "es";
  if (kind === "unsure") {
    const base = studio
      ? es
        ? `Hola, quiero reservar un masaje en ${studio} pero no sé qué tipo.`
        : `Hi, I'd like to book a massage at ${studio} but I'm not sure which type.`
      : es
        ? "Hola, quiero reservar un masaje pero no sé qué tipo."
        : "Hi, I'd like to book a massage but I'm not sure which type.";
    return base + suffix;
  }
  const typeWord = TYPE_WORDS[kind]?.[lang] ?? TYPE_WORDS.relaxing[lang];
  if (studio) {
    return (es
      ? `Hola, quiero reservar ${typeWord} en ${studio}.`
      : `Hi, I'd like to book ${typeWord} at ${studio}.`) + suffix;
  }
  const cleanArea = area.trim();
  if (cleanArea) {
    return (es
      ? `Hola, quiero reservar ${typeWord} en ${cleanArea}.`
      : `Hi, I'd like to book ${typeWord} in ${cleanArea}.`) + suffix;
  }
  return (es
    ? `Hola, quiero reservar ${typeWord}.`
    : `Hi, I'd like to book ${typeWord}.`) + suffix;
}

/** Page language, resolved from i18n (mc_lang is kept in sync elsewhere). */
export function useAskLang(): FlowLang {
  return useFlowLang();
}

export type WhatsAppAskButtonProps = {
  /** Which page/surface this button lives on - logged with the event. */
  source: string;
  /** When set, the area question is skipped and the studio is named in the message. */
  studioName?: string | null;
  /** Optional extra sentence appended to the prefill, e.g. "I saw you on Facebook." */
  note?: string;
  lang?: FlowLang;
  label?: string;
  className?: string;
  /** Render the questions in a fixed bottom sheet instead of inline. */
  sheet?: boolean;
  /** Custom trigger. Receives the toggle handler and the open state. */
  renderTrigger?: (args: { open: () => void; isOpen: boolean }) => React.ReactNode;
  /** Extra metadata to attach to the wa_prefill event. */
  meta?: Record<string, unknown>;
};

export default function WhatsAppAskButton({
  source,
  studioName,
  note,
  lang: langProp,
  label,
  className,
  sheet,
  renderTrigger,
  meta,
}: WhatsAppAskButtonProps) {
  const detected = useAskLang();
  const lang = langProp ?? detected;
  const t = LABELS[lang] ?? LABELS.en;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [areaUnsure, setAreaUnsure] = useState(false);
  const askArea = !studioName;

  const submit = () => {
    const chosenArea = areaUnsure ? "" : area;
    trackEvent("wa_prefill", {
      meta: {
        source,
        page: typeof window !== "undefined" ? window.location.pathname : null,
        lang,
        massage_type: type,
        area: askArea ? chosenArea || null : null,
        studio: studioName || null,
        ...(meta || {}),
      },
    });
    const text = buildAskText(lang, type!, chosenArea, studioName, note);
    window.open(conciergeWhatsappUrl(text), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const questions = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-left">
      <p className="text-sm font-semibold text-foreground">{t.q1}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(MASSAGE_CHIPS[lang] ?? MASSAGE_CHIPS.en).map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => setType(c.kind)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
              type === c.kind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {askArea && (
        <>
          <p className="mt-4 text-sm font-semibold text-foreground">{t.q2}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={area}
              disabled={areaUnsure}
              onChange={(e) => {
                setArea(e.target.value);
                setAreaUnsure(false);
              }}
              placeholder={t.areaPlaceholder}
              className="flex-1 min-w-0 h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => {
                setAreaUnsure((v) => !v);
                if (!areaUnsure) setArea("");
              }}
              className={`shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition ${
                areaUnsure
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {t.unsure}
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        disabled={!type}
        onClick={submit}
        className="mt-4 w-full h-12 rounded-full bg-[#25D366] text-white text-base font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        <MessageCircle className="h-5 w-5" />
        {t.open}
      </button>
    </div>
  );

  return (
    <div className={className}>
      {renderTrigger ? (
        renderTrigger({ open: () => setOpen((v) => !v), isOpen: open })
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-border bg-card text-base font-semibold text-foreground hover:border-primary/50 transition"
        >
          <MessageCircle className="h-5 w-5 text-primary" />
          {label ?? t.trigger}
        </button>
      )}

      {open && !sheet && <div className="mt-4">{questions}</div>}

      {open && sheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[520px] p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            {questions}
          </div>
        </div>
      )}
    </div>
  );
}
