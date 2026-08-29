import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { useFlowLang, pickCopy } from "@/lib/flowLang";

const isVideo = (url: string) => /\.(mp4|webm)(\?.*)?$/i.test(url);

const GALLERY_COPY = {
  en: { title: "Photos", video: "Video", openPhoto: "Open photo", close: "Close" },
  es: { title: "Fotos", video: "Vídeo", openPhoto: "Abrir foto", close: "Cerrar" },
  fr: { title: "Photos", video: "Vidéo", openPhoto: "Ouvrir la photo", close: "Fermer" },
  de: { title: "Fotos", video: "Video", openPhoto: "Foto öffnen", close: "Schließen" },
  it: { title: "Foto", video: "Video", openPhoto: "Apri foto", close: "Chiudi" },
  pt: { title: "Fotos", video: "Vídeo", openPhoto: "Abrir foto", close: "Fechar" },
  zh: { title: "照片", video: "视频", openPhoto: "打开照片", close: "关闭" },
} as const;

interface Props {
  items: string[];
  /** Optional override for the section heading; localized by default. */
  title?: string;
}

/**
 * Studio media strip: horizontally swipeable rounded thumbnails.
 * Videos render inline (muted, controls, never autoplay); images open in a
 * simple lightbox on tap. Mobile-first, cream/terracotta brand.
 */
export default function StudioGallery({ items, title }: Props) {
  const lang = useFlowLang();
  const copy = pickCopy(GALLERY_COPY, lang);
  const heading = title ?? copy.title;
  const media = (items || []).filter(u => typeof u === "string" && u.trim().length > 0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!media.length) return null;

  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-gray-800 mb-2">{heading}</p>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-3 snap-x snap-mandatory">
        {media.map((url, i) =>
          isVideo(url) ? (
            <div
              key={i}
              className="relative h-40 w-64 flex-shrink-0 snap-start rounded-2xl overflow-hidden border border-[#EADFD2] bg-black"
            >
              <video
                src={url}
                muted
                playsInline
                controls
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                <Play size={10} /> {copy.video}
              </span>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(url)}
              aria-label={copy.openPhoto}
              className="h-40 w-64 flex-shrink-0 snap-start rounded-2xl overflow-hidden border border-[#EADFD2] bg-[#F6EFE6]"
            >
              <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          )
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={copy.close}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 text-gray-900 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <X size={18} />
          </button>
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
