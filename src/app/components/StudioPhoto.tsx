import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaceTile } from "./PlaceTile";
import { sizedPhoto } from "@/lib/studioImages";

export type StockLabelSize = "sm" | "md" | "lg";

const LABEL_CLASS: Record<StockLabelSize, string> = {
  // 56 to 64px thumbnails: two short lines at most ("Photo d'illustration").
  sm: "max-w-[calc(100%-8px)] rounded px-1 py-px text-[9px]",
  md: "max-w-[calc(100%-12px)] rounded-md px-1.5 py-0.5 text-[10px]",
  lg: "max-w-[calc(100%-24px)] rounded-md px-2 py-1 text-xs",
};

/** Bottom left corner by default; a page can move it clear of its own overlays. */
const LABEL_POS: Record<StockLabelSize, string> = {
  sm: "bottom-1 left-1",
  md: "bottom-1.5 left-1.5",
  lg: "bottom-3 left-3",
};

/**
 * "Stock photo" in the photo's corner. Every stock picture carries it, so no
 * stock photo is ever taken for the studio's own room. Hidden from screen
 * readers because the picture itself is decorative (alt="").
 */
export function StockLabel({ size = "md", position }: { size?: StockLabelSize; position?: string }) {
  const { t } = useTranslation();
  return (
    <span
      aria-hidden="true"
      data-testid="stock-label"
      className={`pointer-events-none absolute z-[1] bg-black/60 font-medium leading-tight text-white ${LABEL_CLASS[size]} ${position ?? LABEL_POS[size]}`}
    >
      {t("app.common.stockPhoto", "Stock photo")}
    </span>
  );
}

/**
 * The picture for a studio, filling its positioned parent:
 * 1. its own photo (alt = the studio's name), no label;
 * 2. else its stock photo (alt="", decorative) with the "Stock photo" label;
 * 3. else, or when a picture fails to load, its letter tile (PlaceTile).
 */
export function StudioPhoto({
  name,
  hood = null,
  ownImage,
  stockImage,
  width = 480,
  label = "md",
  labelPosition,
  eager = false,
  imgClassName = "",
}: {
  name: string;
  hood?: string | null;
  ownImage?: string | null;
  stockImage?: string | null;
  /** Width in CSS pixels times the screen density, for the stock CDN. */
  width?: number;
  label?: StockLabelSize;
  /** Tailwind position classes for the label, e.g. "bottom-12 left-4". */
  labelPosition?: string;
  eager?: boolean;
  imgClassName?: string;
}) {
  // The URLs that failed, so a new URL (another studio) is tried afresh.
  const [failed, setFailed] = useState<string[]>([]);
  const own = ownImage && !failed.includes(ownImage) ? ownImage : null;
  const stock = !own && stockImage && !failed.includes(stockImage) ? stockImage : null;
  const imgClass = `absolute inset-0 h-full w-full object-cover ${imgClassName}`;

  if (own) {
    return (
      <img
        key={own}
        src={own}
        alt={name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={imgClass}
        onError={() => setFailed((f) => [...f, own])}
      />
    );
  }
  if (stock) {
    return (
      <>
        <img
          key={stock}
          src={sizedPhoto(stock, width)}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          data-stock-photo={stock}
          className={imgClass}
          onError={() => setFailed((f) => [...f, stock])}
        />
        <StockLabel size={label} position={labelPosition} />
      </>
    );
  }
  return <PlaceTile name={name} hood={hood} />;
}

export default StudioPhoto;
