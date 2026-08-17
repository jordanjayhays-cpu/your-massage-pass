import { useEffect } from "react";

export default function ConfirmHoursRedirect() {
  useEffect(() => {
    const target = `https://jglftdstrowwckwqmpue.supabase.co/functions/v1/confirm-hours${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  return (
    <div className="min-h-screen bg-background" aria-live="polite" aria-busy="true">
      <span className="sr-only">Redirecting…</span>
    </div>
  );
}
