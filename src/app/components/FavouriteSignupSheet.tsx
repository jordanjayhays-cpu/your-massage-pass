import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarCheck, Clock, Sparkles, X } from "lucide-react";
import { trackEvent } from "@/lib/siteVisit";
import {
  bumpSessionSaveCount,
  dismissSignupPromptForSession,
  markFavouriteSignupIntent,
  shouldShowSignupPrompt,
  toggleFavourite,
  useFavourites,
} from "@/lib/favourites";

/**
 * Favourites, value first.
 * Saving always works, signed in or not. The toast and the sheet are offers,
 * never walls: nothing here blocks browsing, the map, or a booking.
 */
export function useFavouriteAction() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").slice(0, 2) === "es";
  const favourites = useFavourites();
  const [promptOpen, setPromptOpen] = useState(false);

  const goCreate = useCallback(() => {
    markFavouriteSignupIntent();
    navigate("/login?create=1");
  }, [navigate]);

  const toggle = useCallback(
    (studio: Parameters<typeof toggleFavourite>[0]) => {
      const res = toggleFavourite(studio);
      if (!res.saved) return;

      toast(
        es
          ? "Guardado. Crea tu perfil gratis para tener tu lista en cualquier dispositivo."
          : "Saved. Create a free profile to keep your list on any device.",
        {
          action: {
            label: es ? "Crear perfil" : "Create profile",
            onClick: goCreate,
          },
        },
      );

      const count = bumpSessionSaveCount();
      if (shouldShowSignupPrompt(count)) {
        trackEvent("favourite_signup_prompt_shown", { meta: { saves: count } });
        setPromptOpen(true);
      }
    },
    [es, goCreate],
  );

  const isFavourite = useCallback(
    (key: string) => favourites.some((f) => f.key === key),
    [favourites],
  );

  const sheet = promptOpen ? (
    <FavouriteSignupSheet
      es={es}
      onCreate={() => {
        setPromptOpen(false);
        goCreate();
      }}
      onDismiss={() => {
        dismissSignupPromptForSession();
        setPromptOpen(false);
      }}
    />
  ) : null;

  return { favourites, isFavourite, toggle, sheet };
}

function FavouriteSignupSheet({
  es,
  onCreate,
  onDismiss,
}: {
  es: boolean;
  onCreate: () => void;
  onDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;

  const benefits = es
    ? [
        "Tu lista de estudios guardados en cualquier dispositivo",
        "Tus preferencias de masaje listas al reservar",
        "Tus reservas y recordatorios en un solo sitio",
      ]
    : [
        "Your saved studios on any device",
        "Your massage preferences ready when you book",
        "Your bookings and reminders in one place",
      ];
  const icons = [Sparkles, Clock, CalendarCheck];

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-[#E5DDD3] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#2b2b2b]">
              {es ? "Guarda tu lista para siempre" : "Keep your list for good"}
            </h2>
            <p className="text-sm text-[#7A7068] mt-0.5">
              {es
                ? "Crea un perfil gratis en 20 segundos."
                : "Create a free profile in 20 seconds."}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={es ? "Cerrar" : "Close"}
            className="h-9 w-9 shrink-0 rounded-full bg-[#F7F4F0] flex items-center justify-center text-[#7A7068]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-2.5">
          {benefits.map((text, i) => {
            const Icon = icons[i];
            return (
              <li key={text} className="flex items-start gap-2.5 text-sm text-[#5a4736]">
                <Icon className="h-4 w-4 text-[#C4622D] mt-0.5 flex-shrink-0" />
                <span>{text}</span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onCreate}
          className="mt-5 h-12 w-full rounded-full bg-[#C4622D] text-white font-semibold shadow-lg"
        >
          {es ? "Crear perfil gratis" : "Create a free profile"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 h-11 w-full text-sm text-[#7A7068] underline underline-offset-4 hover:text-[#C4622D]"
        >
          {es ? "Ahora no" : "Not now"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default FavouriteSignupSheet;
