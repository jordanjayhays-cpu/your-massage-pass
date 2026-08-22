/**
 * "Book again" entry points for returning customers.
 *
 * Rendered only when someone is signed in and has a booking that was not
 * cancelled. Every variant deep links into the studio's booking wizard with the
 * same service preselected, landing on the "Day and time" step.
 */
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { studioImage, studioImageFallback } from "@/lib/studioImages";
import { bookAgainHref, useLastBooking, type LastBooking } from "@/lib/useLastBooking";

const photoFor = (b: LastBooking, width = 200) =>
  studioImage({ id: b.partnerId, name: b.studioName, imageUrl: b.coverUrl, services: [b.serviceName] }, width);

/** Compact card for the top of the public home page. */
export function BookAgainCard({ className = "" }: { className?: string }) {
  const { lastBooking } = useLastBooking();
  if (!lastBooking) return null;

  return (
    <Link
      to={bookAgainHref(lastBooking)}
      className={`group flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-soft motion-safe:transition hover:border-primary hover:bg-accent/40 ${className}`}
    >
      <img
        src={photoFor(lastBooking)}
        alt=""
        className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
        onError={(e) => studioImageFallback(e, 200)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <RotateCcw className="h-3.5 w-3.5" /> Book again
        </span>
        <span className="block text-[11px] text-muted-foreground leading-tight">Reservar otra vez</span>
        <span className="block text-sm text-foreground truncate mt-0.5">
          {lastBooking.serviceName} at {lastBooking.studioName}
        </span>
      </span>
    </Link>
  );
}

/** Small chip, styled like the map's locate chip, for the studios page. */
export function BookAgainChip({ className = "" }: { className?: string }) {
  const { lastBooking } = useLastBooking();
  if (!lastBooking) return null;

  return (
    <Link
      to={bookAgainHref(lastBooking)}
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/95 pl-3 pr-4 py-1.5 shadow-soft backdrop-blur-sm motion-safe:transition hover:bg-card ${className}`}
    >
      <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <RotateCcw className="h-3 w-3 text-primary" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
          Book again at {lastBooking.studioName}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          Reservar otra vez en {lastBooking.studioName}
        </span>
      </span>
    </Link>
  );
}
