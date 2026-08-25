import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  poster: string;
  /** Max width of the phone frame. */
  size?: "sm" | "md";
  className?: string;
  label?: string;
  onClick?: () => void;
  /** Replaces the default max-width classes. */
  widthClass?: string;
  onError?: () => void;
}

/**
 * Vertical 9:16 explainer clip in a phone-sized frame.
 * Autoplays only while at least 50% visible; pauses when out of view.
 * Respects prefers-reduced-motion by showing controls and never autoplaying.
 */
export function AutoplayVideo({
  src,
  poster,
  size = "md",
  className = "",
  label = "Video",
  onClick,
  widthClass,
  onError,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            el.play().catch(() => {
              /* autoplay can be blocked, ignore */
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const width = widthClass ?? (size === "sm" ? "max-w-[240px] min-[900px]:max-w-[280px]" : "max-w-[300px] min-[900px]:max-w-[340px]");

  return (
    <div
      className={`mx-auto w-full ${width} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        aria-label={label}
        playsInline
        muted
        loop
        preload="metadata"
        controls={reduced}
        onError={onError}
        className="w-full aspect-[9/16] rounded-[22px] border object-cover"
        style={{ borderColor: "#E6DED4", background: "#000" }}
      />
    </div>
  );
}

export default AutoplayVideo;
