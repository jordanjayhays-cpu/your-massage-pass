import { useEffect, useState } from "react";
import { AutoplayVideo } from "./AutoplayVideo";

const BASE =
  "https://jglftdstrowwckwqmpue.supabase.co/storage/v1/object/public/media";

interface Props {
  slug: string;
  /** "page" = 260px mobile / 300px desktop, "overlay" = 200px. */
  variant?: "page" | "overlay";
  className?: string;
}

/**
 * Vertical 9:16 clip for a massage type, by slug convention.
 * Hides itself silently when the file is missing or fails to load.
 */
export function MassageTypeVideo({ slug, variant = "page", className = "" }: Props) {
  const src = `${BASE}/type-${slug}.mp4`;
  const poster = `${BASE}/type-${slug}-poster.jpg`;
  const [state, setState] = useState<"checking" | "ok" | "missing">("checking");

  useEffect(() => {
    let alive = true;
    setState("checking");
    fetch(src, { method: "HEAD" })
      .then((r) => alive && setState(r.ok ? "ok" : "missing"))
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [src]);

  if (state !== "ok") return null;

  const width =
    variant === "overlay"
      ? "max-w-[200px]"
      : "max-w-[260px] min-[900px]:max-w-[300px]";

  return (
    <AutoplayVideo
      key={src}
      src={src}
      poster={poster}
      widthClass={width}
      className={className}
      label={`${slug} massage`}
    />
  );
}

export default MassageTypeVideo;
