import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";
import AccountOfferBlock from "@/components/AccountOfferBlock";
import { useFlowLang } from "@/lib/flowLang";
import {
  bumpSessionSaveCount,
  dismissSignupPromptForSession,
  markFavouriteSignupIntent,
  toggleFavourite,
  useFavourites,
} from "@/lib/favourites";

const COPY = {
  en: { saved: "Saved", notNow: "Not now" },
  es: { saved: "Guardado", notNow: "Ahora no" },
  fr: { saved: "Enregistré", notNow: "Pas maintenant" },
  de: { saved: "Gespeichert", notNow: "Jetzt nicht" },
  it: { saved: "Salvato", notNow: "Non ora" },
  pt: { saved: "Guardado", notNow: "Agora não" },
  zh: { saved: "已保存", notNow: "暂时不用" },
} as const;

/**
 * Favourites, value first.
 * Saving always works, signed in or not. The account offer is an inline block
 * below the list, never a modal: nothing here blocks browsing or a booking.
 */
export function useFavouriteAction() {
  const lang = useFlowLang();
  const c = COPY[lang];
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

      toast(c.saved);

      const count = bumpSessionSaveCount();
      if (signedIn === false) {
        markFavouriteSignupIntent();
        if (!promptOpen) {
          trackEvent("favourite_signup_prompt_shown", { meta: { saves: count } });
          setPromptOpen(true);
        }
      }
    },
    [c.saved, promptOpen, signedIn],
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
        {c.notNow}
      </button>
    </div>
  ) : null;

  return { favourites, isFavourite, toggle, sheet };
}

export default useFavouriteAction;
