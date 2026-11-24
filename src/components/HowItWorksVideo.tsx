import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { trackEvent } from "@/lib/siteVisit";

// The 22 second "how it works" film (23 Nov, Jordan: "put this on the
// website so people can see how it works", "in a few different places").
// The request comes in, Massage Club asks several studios, they answer with
// a time and a price, the customer taps Yes on the best one. Nothing loads
// until the visitor taps play (preload none), so it costs pages nothing.
// The film is in English; other languages say so under it. The play
// label sits above the film's own "Made-up example" line, not on it.

const COPY = {
  en: { watch: "Watch how it works", note: "Made-up example. Real offers show the studio's real price.", label: "Video: how Massage Club works" },
  es: { watch: "Mira cómo funciona", note: "Ejemplo inventado, vídeo en inglés. Las ofertas reales muestran el precio real del centro.", label: "Vídeo: cómo funciona Massage Club" },
  fr: { watch: "Voir comment ça marche", note: "Exemple fictif, vidéo en anglais. Les vraies offres affichent le vrai prix du centre.", label: "Vidéo : comment fonctionne Massage Club" },
  de: { watch: "So funktioniert es", note: "Erfundenes Beispiel, Video auf Englisch. Echte Angebote zeigen den echten Preis des Studios.", label: "Video: So funktioniert Massage Club" },
  it: { watch: "Guarda come funziona", note: "Esempio inventato, video in inglese. Le offerte vere mostrano il prezzo reale del centro.", label: "Video: come funziona Massage Club" },
  pt: { watch: "Vê como funciona", note: "Exemplo inventado, vídeo em inglês. As ofertas reais mostram o preço real do estúdio.", label: "Vídeo: como funciona a Massage Club" },
  zh: { watch: "看看如何运作", note: "虚构示例，视频为英文。真实报价显示按摩店的真实价格。", label: "视频：Massage Club 如何运作" },
} as const;

type Lang = keyof typeof COPY;

export default function HowItWorksVideo({
  lang = "en",
  where,
  className = "",
  autoStart = false,
}: {
  lang?: string;
  where: string;
  className?: string;
  /** Start playing at once (a dialog opened by a tap). */
  autoStart?: boolean;
}) {
  const key = String(lang || "en").slice(0, 2) as Lang;
  const t = COPY[key] ?? COPY.en;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const start = () => {
    setPlaying(true);
    trackEvent("how_video_play", { meta: { where, lang: key } });
    ref.current?.play().catch(() => {
      /* the controls are showing, a second tap plays it */
    });
  };

  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <figure className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div
        className="relative overflow-hidden rounded-3xl border border-[#E6DCCF] bg-[#F7F4F0] shadow-soft"
        style={{ aspectRatio: "9 / 16" }}
      >
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
          src="/media/how-it-works.mp4"
          poster="/media/how-it-works.jpg"
          preload="none"
          playsInline
          controls={playing}
          aria-label={t.label}
        />
        {!playing && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-[#211C1A]/60 via-[#211C1A]/10 to-transparent pb-[16%] text-white"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B85C38] shadow-lg">
              <Play className="h-7 w-7 translate-x-[2px] fill-white" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold drop-shadow">{t.watch} · 22 s</span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">{t.note}</figcaption>
    </figure>
  );
}
