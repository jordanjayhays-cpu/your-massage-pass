import { MapPin } from "lucide-react";

/**
 * A studio with no photo of its own: its initial and neighbourhood on a warm,
 * map-like tile. Honest about what we have, instead of a stock picture that
 * reads as the studio's room. Fills its positioned parent.
 * Used by the /studios cards and the /compare columns.
 */
export function PlaceTile({ name, hood }: { name: string; hood: string | null }) {
  const initial = (name || "").trim().charAt(0).toUpperCase() || "M";
  return (
    <div
      aria-hidden="true"
      data-testid="place-tile"
      className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#9A4A2C]"
      style={{
        backgroundColor: "#F3E6DA",
        backgroundImage:
          "linear-gradient(rgba(154,74,44,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(154,74,44,.09) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <span className="font-display text-3xl font-semibold leading-none">{initial}</span>
      {hood && (
        <span className="flex max-w-[88px] items-center gap-0.5 px-1 text-[11px] font-semibold leading-tight text-[#5E4A3D]">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{hood}</span>
        </span>
      )}
    </div>
  );
}

export default PlaceTile;
