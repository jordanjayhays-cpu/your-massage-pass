import { useState } from "react";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import HowItWorksVideo from "@/components/HowItWorksVideo";
import { pickCopy } from "@/lib/flowLang";
import { trackEvent } from "@/lib/siteVisit";

// How it works, on a studio's own page, above its menu (24 Nov, Jordan:
// "let's put how it works above the service line just so they understand how
// it works"). The steps are this page's flow, not the multi-studio one: the
// customer picks this studio, we ask it, and only if it cannot fit them do we
// ask others nearby (the page's waitTime copy says the same). The film opens
// in a dialog and loads only then.

const COPY = {
  en: {
    title: "How it works",
    watch: "Watch · 22 s",
    steps: [
      ["Pick a massage and a time", "One request, in English."],
      ["We ask the studio for you", "In Spanish, so you don't have to."],
      ["They answer with a time and price", "If they can't fit you, we ask other good studios nearby."],
      ["You tap Yes", "Nothing is booked until you do. You pay at the studio."],
    ],
  },
  es: {
    title: "Cómo funciona",
    watch: "Ver · 22 s",
    steps: [
      ["Elige masaje y hora", "Una sola petición."],
      ["Preguntamos al centro por ti", "Para que no tengas que hacerlo tú."],
      ["Te responden con hora y precio", "Si no pueden, preguntamos a otros buenos centros cerca."],
      ["Tú tocas Sí", "No se reserva nada hasta entonces. Pagas en el centro."],
    ],
  },
  fr: {
    title: "Comment ça marche",
    watch: "Voir · 22 s",
    steps: [
      ["Choisissez un massage et une heure", "Une seule demande."],
      ["Nous demandons au centre pour vous", "En espagnol, pour que vous n'ayez pas à le faire."],
      ["Il répond avec une heure et un prix", "S'il ne peut pas, nous demandons à d'autres bons centres à côté."],
      ["Vous touchez Oui", "Rien n'est réservé avant. Vous payez au centre."],
    ],
  },
  de: {
    title: "So funktioniert es",
    watch: "Ansehen · 22 s",
    steps: [
      ["Massage und Uhrzeit wählen", "Eine einzige Anfrage."],
      ["Wir fragen das Studio für dich", "Auf Spanisch, damit du es nicht musst."],
      ["Es antwortet mit Uhrzeit und Preis", "Wenn es nicht passt, fragen wir andere gute Studios in der Nähe."],
      ["Du tippst Ja", "Vorher ist nichts gebucht. Du zahlst im Studio."],
    ],
  },
  it: {
    title: "Come funziona",
    watch: "Guarda · 22 s",
    steps: [
      ["Scegli massaggio e orario", "Una sola richiesta."],
      ["Chiediamo noi al centro", "In spagnolo, così non devi farlo tu."],
      ["Risponde con orario e prezzo", "Se non può, chiediamo ad altri buoni centri vicini."],
      ["Tocchi Sì", "Prima non è prenotato nulla. Paghi al centro."],
    ],
  },
  pt: {
    title: "Como funciona",
    watch: "Ver · 22 s",
    steps: [
      ["Escolhe a massagem e a hora", "Um só pedido."],
      ["Perguntamos ao estúdio por ti", "Em espanhol, para não teres de o fazer."],
      ["Respondem com hora e preço", "Se não puderem, perguntamos a outros bons estúdios perto."],
      ["Tocas em Sim", "Nada fica reservado antes disso. Pagas no estúdio."],
    ],
  },
  zh: {
    title: "使用方法",
    watch: "观看 · 22 秒",
    steps: [
      ["选择按摩和时间", "只需一个请求。"],
      ["我们替您询问按摩店", "用西班牙语，您不必亲自去问。"],
      ["按摩店回复时间和价格", "如果没空，我们会询问附近其他好的按摩店。"],
      ["您点击“是”", "在此之前不会预订任何东西。您在店里付款。"],
    ],
  },
} as const;

export default function HowItWorksStrip({ lang, where, className = "" }: { lang: string; where: string; className?: string }) {
  const t = pickCopy(COPY, lang);
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="mc-hiw-title" className={`rounded-2xl border border-[#E6DCCF] bg-white p-4 min-[900px]:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="mc-hiw-title" className="font-display text-lg min-[900px]:text-xl font-semibold text-[#2b2b2b]">{t.title}</h2>
        <button
          type="button"
          onClick={() => { setOpen(true); trackEvent("how_video_open", { meta: { where } }); }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#211C1A] py-1.5 pl-1.5 pr-3 text-sm font-semibold text-white"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B85C38]">
            <Play className="h-3 w-3 translate-x-[1px] fill-white" aria-hidden="true" />
          </span>
          {t.watch}
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 min-[900px]:grid-cols-4">
        {t.steps.map(([title, sub], i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B85C38] text-xs font-bold text-white">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-[#2b2b2b]">{title}</p>
              <p className="mt-0.5 hidden text-xs leading-snug text-[#8a7460] min-[900px]:block">{sub}</p>
            </div>
          </li>
        ))}
      </ol>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[360px] border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{t.title}</DialogTitle>
          {open && <HowItWorksVideo lang={lang} where={where} autoStart />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
