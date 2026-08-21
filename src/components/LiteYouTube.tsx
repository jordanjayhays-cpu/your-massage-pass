import { useState } from "react";
import { Play } from "lucide-react";
import { sendTrack } from "@/lib/siteVisit";

interface LiteYouTubeProps {
  /** YouTube video id */
  id: string;
  /** Accessible/video title */
  title: string;
  /** Optional heading rendered above the player */
  heading?: string;
  className?: string;
}

/**
 * Facade YouTube embed: renders a static thumbnail only.
 * No request is made to youtube.com / google.com until the visitor clicks play.
 */
export function LiteYouTube({ id, title, heading, className = "" }: LiteYouTubeProps) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  const handlePlay = () => {
    setPlaying(true);
    try {
      sendTrack({
        event: "video_play",
        path: typeof window !== "undefined" ? window.location.pathname : "/",
        meta: { video: "promo" },
      });
    } catch {
      /* never block playback */
    }
  };

  return (
    <div className={className}>
      {heading ? (
        <h2 className="text-[11px] uppercase tracking-[0.3em] text-[#7A7068] mb-3">{heading}</h2>
      ) : null}
      <div className="relative w-full overflow-hidden rounded-[24px] bg-black aspect-video shadow-sm">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E0A458] focus-visible:ring-offset-2"
          >
            <img
              src={thumb}
              onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
              alt={title}
              loading="lazy"
              width={1280}
              height={720}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35 motion-reduce:transition-none" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#C4622D] shadow-lg transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
              <Play className="h-7 w-7 translate-x-[2px] fill-current text-[#F7F4F0]" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default LiteYouTube;
