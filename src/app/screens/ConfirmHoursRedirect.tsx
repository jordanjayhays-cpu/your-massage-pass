import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ConfirmHoursRedirect() {
  const { studioId } = useParams<{ studioId?: string }>();

  useEffect(() => {
    const search = window.location.search;
    const hash = window.location.hash;
    let target: string;

    if (studioId) {
      const rest = search ? `&${search.slice(1)}` : "";
      target = `https://jglftdstrowwckwqmpue.supabase.co/functions/v1/confirm-hours?slug=${encodeURIComponent(studioId)}${rest}${hash}`;
    } else {
      target = `https://jglftdstrowwckwqmpue.supabase.co/functions/v1/confirm-hours${search}${hash}`;
    }

    window.location.replace(target);
  }, [studioId]);

  return (
    <div className="min-h-screen bg-background" aria-live="polite" aria-busy="true">
      <span className="sr-only">Redirecting…</span>
    </div>
  );
}
