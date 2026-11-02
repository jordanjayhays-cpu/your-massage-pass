import { useEffect, type ReactElement, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * One front door: "/", "/start", "/book" and "/booking" open the request flow
 * at /reserve (public/go.html through the vercel.json rewrite).
 *
 * KEEP IN SYNC with the inline redirect script in index.html (right after the
 * viewport meta). That script runs before the bundle on a full page load; this
 * module covers client-side navigations, which never reach index.html.
 * Same rules in both places.
 */

/** Path (without trailing slash) to the `src` value go.html reports. */
const PATH_SRC: Record<string, string> = {
  "/": "home",
  "/start": "start",
  "/book": "book",
  "/booking": "book",
};

/** Supabase auth redirects land on "/" with these in the hash: Login must handle them. */
const AUTH_HASH = /access_token|refresh_token|error_description|type=(signup|magiclink|recovery|invite)/;

/** Supabase auth redirects (PKCE, OTP links) land on "/" with these in the query. */
const AUTH_QUERY_KEYS = ["code", "token", "token_hash", "error"];

/** Google Ads click ids: a visitor carrying one is counted as src=google. */
const AD_CLICK_KEYS = ["gclid", "gbraid", "wbraid"];

const SESSION_KEY = /^sb-.*-auth-token$/;

/** True when the browser holds a Supabase session (a signed-in visitor keeps Login on "/"). */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && SESSION_KEY.test(k)) return true;
    }
  } catch {
    /* storage blocked: treat as signed out */
  }
  return false;
}

/**
 * Where a visit to `pathname` should go instead, or null to render the page
 * that is routed there today. Pure, so it is unit tested.
 */
export function requestFlowTarget(
  pathname: string,
  search: string,
  hash: string,
  hostname: string,
  hasSession: boolean,
): string | null {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  const mapped = PATH_SRC[p];
  if (!mapped) return null;

  // Jordan's Lovable editor previews keep the React pages.
  if ((hostname || "").indexOf("lovable") !== -1) return null;

  const params = new URLSearchParams(search || "");
  if (params.get("stay") === "1") return null;

  if (p === "/") {
    if (AUTH_HASH.test(hash || "")) return null;
    if (AUTH_QUERY_KEYS.some((k) => params.has(k))) return null;
    if (hasSession) return null;
  }

  if (!params.get("src")) {
    const fromAd = AD_CLICK_KEYS.some((k) => params.get(k));
    params.set("src", fromAd ? "google" : mapped);
  }
  return "/reserve?" + params.toString();
}

/** The target for the current browser location (used by the routes below). */
export function currentRequestFlowTarget(pathname: string, search: string, hash: string): string | null {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return requestFlowTarget(pathname, search, hash, hostname, hasStoredSession());
}

/**
 * Full page load of the request flow for the current route. Renders nothing
 * while it leaves; `replace` so Back skips the hop. When the rules say stay
 * (Lovable preview, ?stay=1, a sign-in link on "/"), it renders `fallback`.
 */
export function RequestFlowRedirect({ fallback = null }: { fallback?: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const target = currentRequestFlowTarget(pathname, search, hash);

  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);

  return target ? null : ((fallback ?? null) as ReactElement | null);
}
