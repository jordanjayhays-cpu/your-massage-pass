import { useEffect } from "react";

export default function BookingActionRedirect() {
  useEffect(() => {
    const search = window.location.search;
    const hash = window.location.hash;
    const target = `https://jglftdstrowwckwqmqpue.supabase.co/functions/v1/booking-action${search}${hash}`;
    window.location.replace(target);
  }, []);

  return (
    <div className="min-h-screen bg-background" aria-live="polite" aria-busy="true">
      <span className="sr-only">Redirecting…</span>
    </div>
  );
}
