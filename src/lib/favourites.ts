/**
 * Studio favourites.
 *
 * Value-first: a logged-out visitor can always save a studio. The list lives in
 * localStorage so it survives the session, and it is migrated into the account
 * the first time the visitor signs in. Saving is never blocked by a signup wall.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";

const LS_KEY = "mc_favourites";
const EVT = "mc-favourites-change";
const SS_SAVE_COUNT = "mc_fav_saves";
const SS_PROMPT_DISMISSED = "mc_fav_prompt_off";
const SS_PROMPT_SHOWN = "mc_fav_prompt_shown";
const LS_PENDING_SIGNUP = "mc_fav_signup_pending";

export type FavouriteEntry = {
  key: string;
  name: string;
  slug?: string | null;
  partnerId?: string | null;
};

type StudioLike = {
  slug?: string | null;
  partner_id?: string | null;
  id?: string | null;
  studio?: string | null;
  name?: string | null;
};

/** Canonical key for a studio: its slug, else the partner id, else the id. */
export function favouriteKey(s: StudioLike | null | undefined): string {
  if (!s) return "";
  return ((s.slug || "").trim() || s.partner_id || s.id || "").toString();
}

export function favouriteName(s: StudioLike | null | undefined): string {
  return (s?.studio || s?.name || "Studio").toString();
}

export function loadFavourites(): FavouriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.key === "string" && e.key)
      .map((e) => ({
        key: String(e.key),
        name: String(e.name || "Studio"),
        slug: e.slug ?? null,
        partnerId: e.partnerId ?? null,
      }));
  } catch {
    return [];
  }
}

function saveFavourites(list: FavouriteEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function isFavourited(key: string): boolean {
  if (!key) return false;
  return loadFavourites().some((f) => f.key === key);
}

/** Saves the favourite to the signed-in account, best effort. */
async function persistToAccount(entry: FavouriteEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("favourites").upsert(
      {
        user_id: user.id,
        studio_key: entry.key,
        studio_name: entry.name,
      },
      { onConflict: "user_id,studio_key" },
    );
  } catch {
    /* favourites are a nice-to-have, never break the screen */
  }
}

async function removeFromAccount(key: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("favourites").delete().eq("user_id", user.id).eq("studio_key", key);
  } catch {
    /* ignore */
  }
}

/**
 * Toggles a studio favourite. Optimistic and instant: the local list is the
 * source of truth for the UI, the account write happens in the background.
 */
export function toggleFavourite(studio: StudioLike): { saved: boolean; key: string; name: string } {
  const key = favouriteKey(studio);
  const name = favouriteName(studio);
  if (!key) return { saved: false, key: "", name };

  const list = loadFavourites();
  const exists = list.some((f) => f.key === key);
  if (exists) {
    saveFavourites(list.filter((f) => f.key !== key));
    void removeFromAccount(key);
    return { saved: false, key, name };
  }

  const entry: FavouriteEntry = {
    key,
    name,
    slug: (studio.slug || null) as string | null,
    partnerId: (studio.partner_id || null) as string | null,
  };
  saveFavourites([entry, ...list]);
  void persistToAccount(entry);
  trackEvent("favourite_added", { slug: entry.slug, meta: { studio: name } });
  return { saved: true, key, name };
}

/** Saves in this session, used to time the soft create-profile prompt. */
export function bumpSessionSaveCount(): number {
  try {
    const next = Number(sessionStorage.getItem(SS_SAVE_COUNT) || "0") + 1;
    sessionStorage.setItem(SS_SAVE_COUNT, String(next));
    return next;
  } catch {
    return 1;
  }
}

/** True once per session, on the second save, unless the visitor said "Not now". */
export function shouldShowSignupPrompt(saveCount: number): boolean {
  if (saveCount < 2) return false;
  try {
    if (sessionStorage.getItem(SS_PROMPT_DISMISSED) === "1") return false;
    if (sessionStorage.getItem(SS_PROMPT_SHOWN) === "1") return false;
    sessionStorage.setItem(SS_PROMPT_SHOWN, "1");
  } catch {
    /* ignore */
  }
  return true;
}

export function dismissSignupPromptForSession() {
  try {
    sessionStorage.setItem(SS_PROMPT_DISMISSED, "1");
  } catch {
    /* ignore */
  }
}

/** Marks that the visitor left for signup from a favourites prompt. */
export function markFavouriteSignupIntent() {
  try {
    localStorage.setItem(LS_PENDING_SIGNUP, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Called after sign-in: pushes any local favourites into the account so the
 * list is never lost, and closes the funnel when the signup came from a
 * favourites prompt.
 */
export async function migrateFavouritesToAccount(): Promise<void> {
  const list = loadFavourites();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (list.length) {
      await supabase.from("favourites").upsert(
        list.map((f) => ({ user_id: user.id, studio_key: f.key, studio_name: f.name })),
        { onConflict: "user_id,studio_key" },
      );
    }
    // Pull the account list back so other devices' saves show up here too.
    const { data } = await supabase
      .from("favourites")
      .select("studio_key, studio_name")
      .eq("user_id", user.id);
    if (Array.isArray(data)) {
      const merged = new Map<string, FavouriteEntry>();
      list.forEach((f) => merged.set(f.key, f));
      (data as { studio_key: string; studio_name: string | null }[]).forEach((r) => {
        if (!r.studio_key) return;
        if (!merged.has(r.studio_key)) {
          merged.set(r.studio_key, { key: r.studio_key, name: r.studio_name || "Studio" });
        }
      });
      saveFavourites([...merged.values()]);
    }
  } catch {
    /* ignore */
  }

  try {
    if (localStorage.getItem(LS_PENDING_SIGNUP) === "1") {
      localStorage.removeItem(LS_PENDING_SIGNUP);
      trackEvent("favourite_signup_completed", { meta: { migrated: list.length } });
    }
  } catch {
    /* ignore */
  }
}

/** Reactive favourites list, kept in sync across components and tabs. */
export function useFavourites(): FavouriteEntry[] {
  const [list, setList] = useState<FavouriteEntry[]>(() => loadFavourites());
  useEffect(() => {
    const sync = () => setList(loadFavourites());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}
