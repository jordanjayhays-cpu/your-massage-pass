import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";
import AccountOfferBlock from "@/components/AccountOfferBlock";
import {
  bumpSessionSaveCount,
  dismissSignupPromptForSession,
  markFavouriteSignupIntent,
  toggleFavourite,
  useFavourites,
} from "@/lib/favourites";

/**
 * Favourites, value first.
 * Saving always works, signed in or not. The account offer is an inline block
 * below the list, never a modal: nothing here blocks browsing or a booking.
 */
export function useFavouriteAction() {
  const { i18n } = useTranslation();
  const es = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2) === "es";
  const favourites = useFavourites();
  const [promptOpen, setPromptOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const toggle = useCallback(
    (studio: Parameters<typeof toggleFavourite>[0]) => {
      const res = toggleFavourite(studio);
      if (!res.saved) return;

      toast(es ? "Guardado" : "Saved");

      const count = bumpSessionSaveCount();
      if (signedIn === false) {
        markFavouriteSignupIntent();
        if (!promptOpen) {
          trackEvent("favourite_signup_prompt_shown", { meta: { saves: count } });
          setPromptOpen(true);
        }
      }
    },
    [es, promptOpen, signedIn],
  );

  const isFavourite = useCallback(
    (key: string) => favourites.some((f) => f.key === key),
    [favourites],
  );

  const sheet = promptOpen && signedIn === false ? (
    <div className="mt-6">
      <AccountOfferBlock variant="save" source="favourites" />
      <button
        type="button"
        onClick={() => {
          dismissSignupPromptForSession();
          setPromptOpen(false);
        }}
        className="mt-2 w-full text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
      >
        {es ? "Ahora no" : "Not now"}
      </button>
    </div>
  ) : null;

  return { favourites, isFavourite, toggle, sheet };
}

export default useFavouriteAction;
